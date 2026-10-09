<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$dsn = "mysql:host=db;dbname=krusnoplan;charset=utf8mb4";
$user = "api_user";
$pass = "api_password";

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit();
}

$request_uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// POST /api/register
if ($request_uri === '/api/register' && $method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    
    if (empty($data['username']) || empty($data['password'])) {
        http_response_code(400);
        echo json_encode(["error" => "Missing username or password"]);
        exit();
    }

    $username = $data['username'];
    
    // ZABEZPEČENÍ: Šifrování hesla pomocí Bcrypt/Argon2
    $hashed_password = password_hash($data['password'], PASSWORD_DEFAULT);

    try {
        $stmt = $pdo->prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
        $stmt->execute([$username, $hashed_password]);
        
        http_response_code(201);
        echo json_encode(["message" => "User successfully registered"]);
    } catch (PDOException $e) {
        http_response_code(409); // Conflict
        echo json_encode(["error" => "Username already exists"]);
    }
    exit();
}

// POST /api/login
if ($request_uri === '/api/login' && $method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';

    $stmt = $pdo->prepare("SELECT id, password_hash FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    // ZABEZPEČENÍ: Verifikace šifrovaného hesla
    if ($user && password_verify($password, $user['password_hash'])) {
        // Zde by v produkci vznikl JWT token
        $token = bin2hex(random_bytes(16));
        
        echo json_encode([
            "message" => "Login successful", 
            "token" => $token,
            "user_id" => $user['id']
        ]);
    } else {
        http_response_code(401);
        echo json_encode(["error" => "Invalid credentials"]);
    }
    exit();
}

// Gateway route - Forwarding to Python Engine
if ($request_uri === '/api/planner' && $method === 'POST') {
    // Ověření autorizace by proběhlo zde (ověření JWT z hlavičky Bearer)

    $payload = file_get_contents("php://input");
    
    // Zabalení cURL requestu pro Python kontejner
    $ch = curl_init('http://python_engine:8000/internal/planner/generate');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    http_response_code($http_code);
    echo $response;
    exit();
}

if ($request_uri === '/api/locations' && $method === 'GET') {
    $ch = curl_init('http://python_engine:8000/internal/locations');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    http_response_code($http_code);
    echo $response;
    exit();
}

http_response_code(404);
echo json_encode(["error" => "Endpoint not found"]);
?>
