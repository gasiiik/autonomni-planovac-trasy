<?php
// Uživatelské účty (dobrovolné): registrace, přihlášení a data účtu - oblíbená místa a moje výlety.
// Web funguje i bez účtu; přihlášený uživatel má data uložená na serveru (na všech zařízeních).

const SESSION_DAYS = 30;     // jak dlouho platí přihlášení
const MAX_TRIPS = 100;       // kolik posledních výletů si pamatujeme

// Tabulky účtů - databáze mohla vzniknout ve starší verzi, proto je vytvoříme za běhu
function ensure_account_schema(PDO $pdo) {
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) NULL");
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_sessions (
        token_hash CHAR(64) PRIMARY KEY,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        INDEX (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_favorites (
        user_id INT NOT NULL,
        place_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        lat DOUBLE NOT NULL,
        lng DOUBLE NOT NULL,
        image_url VARCHAR(500) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, place_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )");
    $pdo->exec("ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0");
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_trips (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        trip_key CHAR(64) NOT NULL,             -- stejný výlet po úpravách (výměna zastávky...) = stejný klíč
        kind VARCHAR(10) NOT NULL,              -- trip / vacation
        title VARCHAR(200) NOT NULL,
        trip_date DATE NULL,
        days INT NULL,
        stops INT NULL,
        plan MEDIUMTEXT NOT NULL,               -- zakódovaný požadavek z URL (?plan=...)
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY (user_id, trip_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )");
}

function json_out($code, $data) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function read_json() {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function bearer_token() {
    $headers = function_exists('getallheaders') ? array_change_key_case(getallheaders(), CASE_LOWER) : [];
    $auth = $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    return preg_match('/^Bearer\s+([A-Za-z0-9_-]{20,})$/', $auth, $m) ? $m[1] : null;
}

// Přihlášený uživatel z tokenu, jinak 401
function current_user(PDO $pdo) {
    $token = bearer_token();
    if ($token) {
        $stmt = $pdo->prepare("SELECT u.id, u.username AS email, u.display_name AS name, u.created_at
            FROM user_sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > NOW()");
        $stmt->execute([hash('sha256', $token)]);
        $user = $stmt->fetch();
        if ($user) return $user;
    }
    json_out(401, ["error" => "Nejsi přihlášený, nebo přihlášení vypršelo."]);
}

// Nové přihlášení: náhodný token pro prohlížeč, do databáze jen jeho otisk
function create_session(PDO $pdo, $user_id) {
    $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $pdo->prepare("INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL " . SESSION_DAYS . " DAY))")
        ->execute([hash('sha256', $token), $user_id]);
    $pdo->prepare("DELETE FROM user_sessions WHERE expires_at < NOW()")->execute();
    return $token;
}

function user_out($u) {
    return ["id" => (int)$u['id'], "email" => $u['email'], "name" => $u['name'] ?: explode('@', $u['email'])[0], "created_at" => $u['created_at']];
}

function handle_account(PDO $pdo, $uri, $method) {
    if (strpos($uri, '/api/auth/') !== 0 && strpos($uri, '/api/me') !== 0) return;
    ensure_account_schema($pdo);

    // --- Registrace --------------------------------------------------------------
    if ($uri === '/api/auth/register' && $method === 'POST') {
        $d = read_json();
        $email = strtolower(trim($d['email'] ?? ''));
        $password = (string)($d['password'] ?? '');
        $name = trim(mb_substr((string)($d['name'] ?? ''), 0, 100));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 100) json_out(400, ["error" => "Zadej platný e-mail."]);
        if (mb_strlen($password) < 8) json_out(400, ["error" => "Heslo musí mít aspoň 8 znaků."]);
        if (strlen($password) > 200) json_out(400, ["error" => "Heslo je příliš dlouhé."]);
        try {
            $pdo->prepare("INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)")
                ->execute([$email, password_hash($password, PASSWORD_DEFAULT), $name ?: null]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') json_out(409, ["error" => "Účet s tímto e-mailem už existuje – přihlas se."]);
            json_out(500, ["error" => "Registrace se nepovedla."]);
        }
        $id = (int)$pdo->lastInsertId();
        $token = create_session($pdo, $id);
        $stmt = $pdo->prepare("SELECT id, username AS email, display_name AS name, created_at FROM users WHERE id = ?");
        $stmt->execute([$id]);
        json_out(201, ["token" => $token, "user" => user_out($stmt->fetch())]);
    }

    // --- Přihlášení --------------------------------------------------------------
    if ($uri === '/api/auth/login' && $method === 'POST') {
        $d = read_json();
        $email = strtolower(trim($d['email'] ?? ''));
        $stmt = $pdo->prepare("SELECT id, username AS email, display_name AS name, created_at, password_hash FROM users WHERE username = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        // Ověření hesla proběhne vždy (i pro neexistující e-mail), aby nešlo podle času poznat, které účty existují
        $hash = $user['password_hash'] ?? password_hash('neexistujici-ucet', PASSWORD_DEFAULT);
        $ok = password_verify((string)($d['password'] ?? ''), $hash);
        if (!$user || !$ok) json_out(401, ["error" => "Špatný e-mail nebo heslo."]);
        json_out(200, ["token" => create_session($pdo, (int)$user['id']), "user" => user_out($user)]);
    }

    // --- Odhlášení ---------------------------------------------------------------
    if ($uri === '/api/auth/logout' && $method === 'POST') {
        $token = bearer_token();
        if ($token) $pdo->prepare("DELETE FROM user_sessions WHERE token_hash = ?")->execute([hash('sha256', $token)]);
        json_out(200, ["ok" => true]);
    }

    $user = current_user($pdo);
    $uid = (int)$user['id'];

    // --- Profil a smazání účtu ----------------------------------------------------
    if ($uri === '/api/me' && $method === 'GET') json_out(200, user_out($user));
    if ($uri === '/api/me' && $method === 'DELETE') {
        // Smaže uživatele a díky ON DELETE CASCADE i jeho přihlášení, oblíbená a výlety
        $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$uid]);
        json_out(200, ["ok" => true]);
    }

    // --- Oblíbená místa ----------------------------------------------------------
    if ($uri === '/api/me/favorites' && $method === 'GET') {
        $stmt = $pdo->prepare("SELECT place_id AS id, name, category, lat, lng, image_url FROM user_favorites WHERE user_id = ? ORDER BY sort_order");
        $stmt->execute([$uid]);
        json_out(200, array_map(fn($f) => ["id" => (int)$f['id'], "name" => $f['name'], "category" => $f['category'],
            "lat" => (float)$f['lat'], "lng" => (float)$f['lng'], "image_url" => $f['image_url']], $stmt->fetchAll()));
    }
    // Celý seznam najednou (prohlížeč posílá aktuální stav)
    if ($uri === '/api/me/favorites' && $method === 'PUT') {
        $list = read_json();
        if (!array_is_list($list) || count($list) > 500) json_out(400, ["error" => "Neplatný seznam oblíbených."]);
        $pdo->beginTransaction();
        $pdo->prepare("DELETE FROM user_favorites WHERE user_id = ?")->execute([$uid]);
        $ins = $pdo->prepare("INSERT IGNORE INTO user_favorites (user_id, place_id, name, category, lat, lng, image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        foreach ($list as $order => $f) {
            if (!isset($f['id'], $f['name'], $f['category'], $f['lat'], $f['lng'])) continue;
            $img = isset($f['image_url']) && preg_match('#^https?://#', (string)$f['image_url']) ? mb_substr($f['image_url'], 0, 500) : null;
            $ins->execute([$uid, (int)$f['id'], mb_substr((string)$f['name'], 0, 255), mb_substr((string)$f['category'], 0, 50),
                (float)$f['lat'], (float)$f['lng'], $img, $order]);
        }
        $pdo->commit();
        json_out(200, ["ok" => true]);
    }

    // --- Moje výlety -------------------------------------------------------------
    if ($uri === '/api/me/trips' && $method === 'GET') {
        $stmt = $pdo->prepare("SELECT id, kind, title, trip_date, days, stops, plan, updated_at FROM user_trips WHERE user_id = ? ORDER BY updated_at DESC");
        $stmt->execute([$uid]);
        json_out(200, array_map(fn($t) => ["id" => (int)$t['id'], "kind" => $t['kind'], "title" => $t['title'], "trip_date" => $t['trip_date'],
            "days" => $t['days'] === null ? null : (int)$t['days'], "stops" => $t['stops'] === null ? null : (int)$t['stops'],
            "plan" => $t['plan'], "updated_at" => $t['updated_at']], $stmt->fetchAll()));
    }
    // Uložení / aktualizace výletu (stejný klíč = upravená verze téhož výletu)
    if ($uri === '/api/me/trips' && $method === 'POST') {
        $d = read_json();
        $kind = ($d['kind'] ?? '') === 'vacation' ? 'vacation' : 'trip';
        $plan = (string)($d['plan'] ?? '');
        $key = (string)($d['key'] ?? '');
        if (strlen($plan) < 10 || strlen($plan) > 100000 || !preg_match('/^[A-Za-z0-9_-]+$/', $plan) || !preg_match('/^[a-f0-9]{64}$/', $key)) json_out(400, ["error" => "Neplatný výlet."]);
        $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($d['trip_date'] ?? '')) ? $d['trip_date'] : null;
        $pdo->prepare("INSERT INTO user_trips (user_id, trip_key, kind, title, trip_date, days, stops, plan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE kind = VALUES(kind), title = VALUES(title), trip_date = VALUES(trip_date), days = VALUES(days),
            stops = VALUES(stops), plan = VALUES(plan), updated_at = CURRENT_TIMESTAMP")
            ->execute([$uid, $key, $kind, mb_substr(trim((string)($d['title'] ?? 'Výlet')), 0, 200), $date,
                isset($d['days']) ? (int)$d['days'] : null, isset($d['stops']) ? (int)$d['stops'] : null, $plan]);
        // Pamatujeme si jen posledních MAX_TRIPS výletů
        $pdo->prepare("DELETE FROM user_trips WHERE user_id = ? AND id NOT IN (SELECT id FROM (SELECT id FROM user_trips WHERE user_id = ? ORDER BY updated_at DESC LIMIT " . MAX_TRIPS . ") t)")
            ->execute([$uid, $uid]);
        json_out(200, ["ok" => true]);
    }
    if (preg_match('#^/api/me/trips/(\d+)$#', $uri, $m) && $method === 'DELETE') {
        $pdo->prepare("DELETE FROM user_trips WHERE id = ? AND user_id = ?")->execute([(int)$m[1], $uid]);
        json_out(200, ["ok" => true]);
    }

    json_out(404, ["error" => "Endpoint not found"]);
}
