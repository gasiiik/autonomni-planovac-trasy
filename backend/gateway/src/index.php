<?php
ini_set('display_errors', '0');   // varování PHP nesmí rozbít JSON odpověď (zapisují se do logu)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$dsn = "mysql:host=db;dbname=krusnoplan;charset=utf8mb4";
$user = "api_user";
$pass = "api_password";

// Databáze může ještě startovat (první spuštění) -> několik pokusů, než to vzdáme
$pdo = null;
for ($attempt = 1; $attempt <= 5 && !$pdo; $attempt++) {
    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $e) {
        if ($attempt < 5) sleep(1);
        else {
            error_log('KrušnoPlán: připojení k databázi selhalo: ' . $e->getMessage());
            http_response_code(503);
            echo json_encode(["error" => "Database connection failed – databáze ještě startuje nebo neběží. Zkontroluj `docker compose ps` a `docker compose logs db`."]);
            exit();
        }
    }
}

// Přeposlání požadavku do Python enginu. Když engine neběží, vrátíme 502 s čitelnou chybou
// (bez toho by curl_exec vrátil false a frontend dostal HTTP 200 s prázdným tělem).
function forward_to_engine($path, $payload = null) {
    $ch = curl_init('http://python_engine:8000' . $path);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $http_code === 0) {
        http_response_code(502);
        echo json_encode(["error" => "Plánovací engine je nedostupný. Zkuste to prosím za chvíli."]);
        exit();
    }
    http_response_code($http_code);
    echo $response;
    exit();
}

$request_uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Uživatelské účty a jejich data (/api/auth/..., /api/me...)
require __DIR__ . '/account.php';
handle_account($pdo, $request_uri, $method);

// Gateway route - Forwarding to Python Engine
if ($request_uri === '/api/planner' && $method === 'POST') {
    forward_to_engine('/internal/planner/generate', file_get_contents("php://input"));
}

// Hledání adresy pro výchozí místo výletu
if ($request_uri === '/api/geocode' && $method === 'GET') {
    $geo = ['q' => (string)($_GET['q'] ?? '')];
    if (isset($_GET['lat'], $_GET['lng'])) { $geo['lat'] = (float)$_GET['lat']; $geo['lng'] = (float)$_GET['lng']; }
    forward_to_engine('/internal/geocode?' . http_build_query($geo));
}

if ($request_uri === '/api/locations' && $method === 'GET') {
    forward_to_engine('/internal/locations');
}

// Restaurace a kavárny (OpenStreetMap) pro vrstvu na mapě míst
if ($request_uri === '/api/restaurants' && $method === 'GET') {
    forward_to_engine('/internal/restaurants');
}

// Ubytování v okolí (dovolená) - parametry lat, lng, limit
if ($request_uri === '/api/accommodation' && $method === 'GET') {
    forward_to_engine('/internal/accommodation?' . http_build_query([
        'lat' => (float)($_GET['lat'] ?? 0),
        'lng' => (float)($_GET['lng'] ?? 0),
        'limit' => (int)($_GET['limit'] ?? 6),
    ]));
}

// Místa pro mapu a detail místa
if ($request_uri === '/api/places' && $method === 'GET') {
    forward_to_engine('/internal/places');
}
if (preg_match('#^/api/places/(\d+)$#', $request_uri, $m) && $method === 'GET') {
    forward_to_engine('/internal/places/' . $m[1]);
}

// Použité datové sady DataZápad (stránka "O datech")
if ($request_uri === '/api/datasets' && $method === 'GET') {
    forward_to_engine('/internal/datasets');
}

http_response_code(404);
echo json_encode(["error" => "Endpoint not found"]);
?>
