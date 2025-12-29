<?php
// upload.php - SECURE Encrypted File Upload Handler for cPanel

// PHP Settings for large file uploads
ini_set('memory_limit', '512M');
ini_set('max_execution_time', 300);
ini_set('max_input_time', 300);
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't show to user
ini_set('log_errors', 1);

header('Content-Type: application/json');

// ==================== SECURITY CONFIGURATION ====================
$STORAGE_DIR = '/home/talk2/public_html/talk2/storage/uploads/';
$SECRET_FILE = '/home/talk2/public_html/talk2/.secret';
$MAX_SIZE = 200 * 1024 * 1024; // 200MB

// WHITELIST: Only allow these extensions
$ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'mov'];

// WHITELIST: Only allow these MIME types (expanded for video compatibility)
$ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 
    'video/x-m4v', 'video/mpeg', 'video/3gpp', 'video/x-matroska',
    'application/octet-stream', // Some servers return this for unknown types
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/mp4'
];

// BLACKLIST: Never allow these patterns (even if renamed)
$FORBIDDEN_PATTERNS = [
    '/\.php/i', '/\.phtml/i', '/\.php3/i', '/\.php4/i', '/\.php5/i', '/\.php7/i',
    '/\.phar/i', '/\.htaccess/i', '/\.htpasswd/i',
    '/\.sh$/i', '/\.bash/i', '/\.cgi/i', '/\.pl$/i', '/\.py$/i',
    '/\.exe$/i', '/\.bat$/i', '/\.cmd$/i', '/\.com$/i',
    '/\.asp/i', '/\.aspx/i', '/\.jsp/i',
    '/<\?php/i', '/<script/i', '/eval\s*\(/i'
];

// ==================== HELPER FUNCTIONS ====================
function is_forbidden_filename($filename) {
    global $FORBIDDEN_PATTERNS;
    foreach ($FORBIDDEN_PATTERNS as $pattern) {
        if (preg_match($pattern, $filename)) {
            return true;
        }
    }
    return false;
}

function is_forbidden_content($filepath) {
    // Read first 8KB of file to check for PHP/script signatures
    $handle = fopen($filepath, 'rb');
    $content = fread($handle, 8192);
    fclose($handle);
    
    $dangerous_signatures = [
        '<?php', '<?=', '<script', '<%', 
        'eval(', 'base64_decode(', 'system(', 'exec(',
        'passthru(', 'shell_exec(', 'popen('
    ];
    
    foreach ($dangerous_signatures as $sig) {
        if (stripos($content, $sig) !== false) {
            return true;
        }
    }
    return false;
}

function get_real_mime_type($filepath) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $filepath);
    finfo_close($finfo);
    return $mime;
}

// ==================== MAIN LOGIC ====================

// Ensure storage directory exists
if (!file_exists($STORAGE_DIR)) {
    mkdir($STORAGE_DIR, 0755, true);
}

// Get encryption key
if (!file_exists($SECRET_FILE)) {
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration error']);
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
$originalName = $file['name'];
$tempPath = $file['tmp_name'];

// ==================== SECURITY CHECKS ====================

// 1. Check file size
if ($file['size'] > $MAX_SIZE) {
    http_response_code(413);
    echo json_encode(['error' => 'File too large']);
    exit;
}

// 2. Check extension (whitelist)
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
if (!in_array($ext, $ALLOWED_EXTENSIONS)) {
    http_response_code(400);
    echo json_encode(['error' => 'File type not allowed', 'type' => $ext]);
    exit;
}

// 3. Check for forbidden filename patterns
if (is_forbidden_filename($originalName)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid filename']);
    exit;
}

// 4. Check real MIME type (not user-supplied)
$realMime = get_real_mime_type($tempPath);
if (!in_array($realMime, $ALLOWED_MIME_TYPES)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid file format', 'detected' => $realMime]);
    exit;
}

// 5. Check file content for dangerous signatures
if (is_forbidden_content($tempPath)) {
    http_response_code(400);
    echo json_encode(['error' => 'Malicious content detected']);
    // Log attempt (optional)
    error_log("SECURITY: Blocked malicious upload attempt: " . $originalName . " from " . $_SERVER['REMOTE_ADDR']);
    exit;
}

// ==================== ENCRYPTION & SAVE ====================

// Generate secure random filename
$safeFilename = time() . '-' . bin2hex(random_bytes(8)) . '.' . $ext . '.enc';
$outputPath = $STORAGE_DIR . $safeFilename;

try {
    $iv = random_bytes(16);
    $cipher = 'aes-256-cbc';
    
    // Read and encrypt
    $inputData = file_get_contents($tempPath);
    $encrypted = openssl_encrypt($inputData, $cipher, $key, OPENSSL_RAW_DATA, $iv);
    
    if ($encrypted === false) {
        throw new Exception('Encryption failed');
    }
    
    // Write IV + encrypted data
    $result = file_put_contents($outputPath, $iv . $encrypted);
    
    if ($result === false) {
        throw new Exception('Failed to write file');
    }
    
    // Success
    echo json_encode(['url' => '/file.php?name=' . $safeFilename]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Upload processing failed']);
    error_log("Upload error: " . $e->getMessage());
}
?>
