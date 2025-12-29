<?php
// file.php - Encrypted File Decryption Handler

// PHP settings for large files
ini_set('memory_limit', '512M');
ini_set('max_execution_time', 300);

$SECRET_FILE = '/home/talk2/public_html/talk2/.secret';
$STORAGE_DIR = '/home/talk2/public_html/talk2/storage/uploads/';

// Get filename from URL
$filename = isset($_GET['name']) ? basename($_GET['name']) : '';

if (empty($filename)) {
    http_response_code(400);
    echo 'Missing filename';
    exit;
}

$filePath = $STORAGE_DIR . $filename;

if (!file_exists($filePath)) {
    http_response_code(404);
    echo 'File not found';
    exit;
}

// Get encryption key
if (!file_exists($SECRET_FILE)) {
    http_response_code(500);
    echo 'Configuration error';
    exit;
}
$key = hex2bin(trim(file_get_contents($SECRET_FILE)));

// Read encrypted file
$data = file_get_contents($filePath);

// Extract IV (first 16 bytes)
$iv = substr($data, 0, 16);
$encrypted = substr($data, 16);

// Decrypt
$decrypted = openssl_decrypt($encrypted, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);

if ($decrypted === false) {
    http_response_code(500);
    echo 'Decryption failed';
    exit;
}

// Determine content type from original extension
$originalName = str_replace('.enc', '', $filename);
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

$contentTypes = [
    'png' => 'image/png',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
    'mp4' => 'video/mp4',
    'webm' => 'video/webm',
    'mov' => 'video/quicktime',
    'mp3' => 'audio/mpeg',
    'wav' => 'audio/wav',
    'ogg' => 'audio/ogg',
];

$contentType = isset($contentTypes[$ext]) ? $contentTypes[$ext] : 'application/octet-stream';
$fileSize = strlen($decrypted);

// Handle Range requests for video streaming
$start = 0;
$end = $fileSize - 1;
$statusCode = 200;

if (isset($_SERVER['HTTP_RANGE'])) {
    preg_match('/bytes=(\d*)-(\d*)/', $_SERVER['HTTP_RANGE'], $matches);
    $start = $matches[1] !== '' ? intval($matches[1]) : 0;
    $end = $matches[2] !== '' ? intval($matches[2]) : $fileSize - 1;
    $statusCode = 206;
    header('HTTP/1.1 206 Partial Content');
    header("Content-Range: bytes $start-$end/$fileSize");
}

header('Content-Type: ' . $contentType);
header('Content-Length: ' . ($end - $start + 1));
header('Accept-Ranges: bytes');
header('Cache-Control: public, max-age=31536000');

// Output the requested range
http_response_code($statusCode);
echo substr($decrypted, $start, $end - $start + 1);
?>
