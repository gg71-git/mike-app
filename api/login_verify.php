<?php
declare(strict_types=1);
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db_connect.php';

$input  = json_decode(file_get_contents('php://input'), true);
$email  = $input['email']  ?? null;
$code   = $input['code']   ?? null;
$client = $input['client'] ?? 'app'; // "app" oder "web"

if (!$email || !$code) {
    echo json_encode(['status' => 'error', 'error' => 'E-Mail oder Code fehlt']);
    exit;
}

try {
    // Nutzer anhand E-Mail holen
    $stmt = $pdo->prepare("
        SELECT user_ID, rolle, customer_ID, helpdesk_ID,
               login_code, code_guilty_until
        FROM users
        WHERE email = ?
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode(['status' => 'error', 'error' => 'E-Mail nicht gefunden']);
        exit;
    }

    // Code prüfen
    $now     = new DateTime();
    $expires = $user['code_guilty_until'] ? new DateTime($user['code_guilty_until']) : null;

    if ($user['login_code'] !== $code || ($expires && $now > $expires)) {
        echo json_encode(['status' => 'error', 'error' => 'Ungültiger oder abgelaufener Code']);
        exit;
    }

    // Rolle vereinheitlichen → lowercase
    $rolleDB    = $user['rolle'] ?? 'Kunde_user';
    $rolleClean = strtolower($rolleDB);

    // Session nur für Web-App
    if ($client === 'web') {
        $_SESSION['role']        = $rolleClean;                // lowercase für permissions.php
        $_SESSION['user_ID']     = (int)$user['user_ID'];
        $_SESSION['customer_ID'] = (int)$user['customer_ID'];
        $_SESSION['helpdesk_ID'] = (int)$user['helpdesk_ID'];
    }

    // Für App: neuen app_hash erzeugen
    $appHash = null;
    if ($client === 'app') {
        $appHash = bin2hex(random_bytes(32)); // 64-stelliger Hash
        $stmt = $pdo->prepare("
            UPDATE users
            SET app_hash = ?, login_status = 'eingeloggt'
            WHERE user_ID = ?
        ");
        $stmt->execute([$appHash, $user['user_ID']]);
    } else {
        // Für Webapp nur Status aktualisieren
        $stmt = $pdo->prepare("
            UPDATE users
            SET login_status = 'eingeloggt'
            WHERE user_ID = ?
        ");
        $stmt->execute([$user['user_ID']]);
    }

    echo json_encode([
        'status'       => 'ok',
        'user_ID'      => (int)$user['user_ID'],
        'role'         => $rolleClean,   // lowercase für Frontend
        'customer_ID'  => (int)$user['customer_ID'],
        'helpdesk_ID'  => (int)$user['helpdesk_ID'],
        'app_hash'     => $appHash       // nur für client=app
    ]);
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'error' => $e->getMessage()]);
}
