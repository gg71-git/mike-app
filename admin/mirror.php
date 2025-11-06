<?php
var_dump(__DIR__ . '/' . 'admin/js/admin.js');
exit;
$whitelist = ['js/admin.js'];

$file = $_GET['f'] ?? '';
$file = str_replace('..', '', $file);
$file = str_replace('\\', '/', $file);

if (!in_array($file, $whitelist)) {
    http_response_code(403);
    echo "🚫 Zugriff auf diese Datei ist nicht erlaubt.";
    exit;
}

$localPath = __DIR__ . '/' . $file;
if (!file_exists($localPath)) {
    http_response_code(404);
    echo "❌ Datei nicht gefunden: $file";
    exit;
}

// Inhalt ausgeben
header('Content-Type: text/plain; charset=utf-8');
readfile($localPath);

