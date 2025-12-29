<?php
// delete.php - Delete encrypted file from storage
header('Content-Type: application/json');

// Configuration
$STORAGE_DIR = '/home/talk2/public_html/talk2/storage/uploads/';

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

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
$url = isset($input['url']) ? $input['url'] : '';

if (empty($url)) {
    http_response_code(400);
    echo json_encode(['error' => 'URL required']);
    exit;
}

// Extract filename from URL
// URL format: /file.php?name=xxxx.enc
if (preg_match('/[?&]name=([^&]+)/', $url, $matches)) {
    $filename = basename($matches[1]); // Sanitize
} elseif (strpos($url, '/api/file/') !== false) {
    $filename = basename(str_replace('/api/file/', '', $url));
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid URL format']);
    exit;
}

$filePath = $STORAGE_DIR . $filename;

// Check if file exists and delete
if (file_exists($filePath)) {
    if (unlink($filePath)) {
        echo json_encode(['success' => true, 'deleted' => $filename]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete file']);
    }
} else {
    // File doesn't exist, but that's okay (maybe already deleted)
    echo json_encode(['success' => true, 'message' => 'File not found (already deleted)']);
}
?>
