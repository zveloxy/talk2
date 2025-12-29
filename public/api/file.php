<?php
// file.php - Encrypted File Decryption Handler
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
    'mp3' => 'audio/mpeg',
    'wav' => 'audio/wav',
];

$contentType = isset($contentTypes[$ext]) ? $contentTypes[$ext] : 'application/octet-stream';

header('Content-Type: ' . $contentType);
header('Content-Length: ' . strlen($decrypted));
header('Cache-Control: public, max-age=31536000');

echo $decrypted;
?>
