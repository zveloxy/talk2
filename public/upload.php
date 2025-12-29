<?php
// upload.php - Encrypted File Upload Handler for cPanel
header('Content-Type: application/json');

// Configuration - ABSOLUTE PATHS for cPanel
$STORAGE_DIR = '/home/talk2/public_html/talk2/storage/uploads/';
$SECRET_FILE = '/home/talk2/public_html/talk2/.secret';
$MAX_SIZE = 200 * 1024 * 1024; // 200MB

// DEBUG MODE - Remove after testing
if (isset($_GET['debug'])) {
    echo json_encode([
        'current_dir' => __DIR__,
        'secret_path' => $SECRET_FILE,
        'secret_exists' => file_exists($SECRET_FILE),
        'storage_path' => $STORAGE_DIR,
        'storage_exists' => file_exists($STORAGE_DIR),
        'parent_dir' => dirname(__DIR__),
        'parent_files' => scandir(dirname(__DIR__))
    ]);
    exit;
}

// Ensure storage directory exists
if (!file_exists($STORAGE_DIR)) {
    mkdir($STORAGE_DIR, 0755, true);
}

// Get encryption key
if (!file_exists($SECRET_FILE)) {
    http_response_code(500);
    echo json_encode(['error' => 'Encryption key not found', 'path' => $SECRET_FILE]);
    exit;
}
$key = hex2bin(trim(file_get_contents($SECRET_FILE)));

// Handle CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Check for file
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $errorCode = isset($_FILES['file']) ? $_FILES['file']['error'] : 'No file';
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded', 'code' => $errorCode]);
    exit;
}

$file = $_FILES['file'];

// Check size
if ($file['size'] > $MAX_SIZE) {
    http_response_code(413);
    echo json_encode(['error' => 'File too large']);
    exit;
}

// Generate unique filename
$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = time() . '-' . bin2hex(random_bytes(8)) . '.' . $ext . '.enc';
$outputPath = $STORAGE_DIR . $filename;

// Encrypt and save
try {
    $iv = random_bytes(16);
    $cipher = 'aes-256-cbc';
    
    // Read input file
    $inputData = file_get_contents($file['tmp_name']);
    
    // Encrypt
    $encrypted = openssl_encrypt($inputData, $cipher, $key, OPENSSL_RAW_DATA, $iv);
    
    if ($encrypted === false) {
        throw new Exception('Encryption failed: ' . openssl_error_string());
    }
    
    // Write IV + encrypted data
    $result = file_put_contents($outputPath, $iv . $encrypted);
    
    if ($result === false) {
        throw new Exception('Failed to write file');
    }
    
    // Success - Return direct PHP URL
    echo json_encode(['url' => '/file.php?name=' . $filename]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Encryption failed', 'message' => $e->getMessage()]);
}
?>
