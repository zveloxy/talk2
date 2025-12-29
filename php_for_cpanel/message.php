<?php
// message.php - Message API for Talk2
// Handles saving and retrieving messages via PHP

ini_set('memory_limit', '256M');
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$DATA_DIR = '/home/talk2/public_html/talk2/storage/';
$MESSAGES_FILE = $DATA_DIR . 'messages.json';

// Ensure storage directory exists
if (!is_dir($DATA_DIR)) {
    mkdir($DATA_DIR, 0755, true);
}

// Initialize messages file if not exists
if (!file_exists($MESSAGES_FILE)) {
    file_put_contents($MESSAGES_FILE, json_encode([]));
}

function readMessages() {
    global $MESSAGES_FILE;
    $content = file_get_contents($MESSAGES_FILE);
    return json_decode($content, true) ?: [];
}

function writeMessages($messages) {
    global $MESSAGES_FILE;
    file_put_contents($MESSAGES_FILE, json_encode($messages, JSON_UNESCAPED_UNICODE));
}

// GET - Fetch message by ID or all room messages
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $id = isset($_GET['id']) ? $_GET['id'] : null;
    $room = isset($_GET['room']) ? $_GET['room'] : null;
    
    $messages = readMessages();
    
    if ($id) {
        // Return single message by ID
        foreach ($messages as $msg) {
            if ($msg['id'] === $id) {
                echo json_encode($msg);
                exit;
            }
        }
        http_response_code(404);
        echo json_encode(['error' => 'Message not found']);
        exit;
    }
    
    if ($room) {
        // Return all messages for a room
        $roomMessages = array_filter($messages, function($m) use ($room) {
            return $m['room_id'] === $room;
        });
        echo json_encode(array_values($roomMessages));
        exit;
    }
    
    echo json_encode(['error' => 'Missing id or room parameter']);
    exit;
}

// POST - Save a new message
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['room']) || !isset($input['nickname'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        exit;
    }
    
    $msgId = time() . '_' . bin2hex(random_bytes(8));
    
    $message = [
        'id' => $msgId,
        'room_id' => $input['room'],
        'nickname' => $input['nickname'],
        'content' => isset($input['content']) ? $input['content'] : null,
        'type' => isset($input['type']) ? $input['type'] : 'text',
        'image_path' => isset($input['image_path']) ? $input['image_path'] : null,
        'video_path' => isset($input['video_path']) ? $input['video_path'] : null,
        'audio_path' => isset($input['audio_path']) ? $input['audio_path'] : null,
        'timestamp' => time() * 1000,
        'replyTo' => isset($input['replyTo']) ? $input['replyTo'] : null
    ];
    
    $messages = readMessages();
    $messages[] = $message;
    
    // Keep only last 1000 messages per room to prevent file from growing too large
    $roomCounts = [];
    $filteredMessages = [];
    foreach (array_reverse($messages) as $msg) {
        $room = $msg['room_id'];
        if (!isset($roomCounts[$room])) $roomCounts[$room] = 0;
        if ($roomCounts[$room] < 1000) {
            $filteredMessages[] = $msg;
            $roomCounts[$room]++;
        }
    }
    $messages = array_reverse($filteredMessages);
    
    writeMessages($messages);
    
    echo json_encode(['success' => true, 'message' => $message]);
    exit;
}

// DELETE - Remove a message
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = isset($input['id']) ? $input['id'] : (isset($_GET['id']) ? $_GET['id'] : null);
    
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing message ID']);
        exit;
    }
    
    $messages = readMessages();
    $deleted = null;
    $newMessages = [];
    
    foreach ($messages as $msg) {
        if ($msg['id'] === $id) {
            $deleted = $msg;
        } else {
            $newMessages[] = $msg;
        }
    }
    
    if ($deleted) {
        writeMessages($newMessages);
        echo json_encode(['success' => true, 'deleted' => $deleted]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Message not found']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
?>
