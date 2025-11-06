<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../admin/includes/mail_templates.php';
require_once __DIR__ . '/user_send_code.php'; // bringt sendUserMail()

$input    = json_decode(file_get_contents('php://input'), true);
$mode     = $input['mode']    ?? null;
$email    = $input['email']   ?? null;
$code     = $input['code']    ?? null;
$client   = $input['client']  ?? 'app';
$remember = $input['remember'] ?? false;
$appHash  = $input['app_hash'] ?? null;

if (!$mode || !$email) {
    echo json_encode(['status' => 'error', 'error' => 'Ungültige Parameter']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode(['status' => 'error', 'error' => 'E-Mail nicht gefunden']);
        exit;
    }

    $now = new DateTime();

    // ==============================================
    // MODE: REQUEST → Code erzeugen und per Mail senden
    // ==============================================
    if ($mode === 'request') {
        $newCode = str_pad((string)random_int(100000, 999999), 6, "0", STR_PAD_LEFT);

        if ($client === 'web') {
            $interval = $remember ? '+30 days' : '+10 minutes';
        } else {
            $interval = '+30 days';
        }
        $expires = (new DateTime($interval))->format('Y-m-d H:i:s');

        $stmt = $pdo->prepare("
            UPDATE users 
            SET login_code = ?, code_guilty_until = ?, login_status = 'gesendet'
            WHERE user_ID = ?
        ");
        $stmt->execute([$newCode, $expires, $user['user_ID']]);

        // Mail mit zentraler Funktion senden
        $subject = $mailTemplates['code_betreff'] ?? 'Ihr Zugangscode';
        $body    = isset($mailTemplates['code_body'])
            ? call_user_func($mailTemplates['code_body'], $user['vorname'] ?? '', $newCode)
            : "Ihr Code lautet: {$newCode}";

        $sendResult = sendUserMail($user['email'], $user['vorname'] ?? '', $subject, $body);

        if ($sendResult !== true) {
            echo json_encode(['status' => 'error', 'error' => $sendResult]);
            exit;
        }

        echo json_encode(['status' => 'ok', 'message' => 'Code gesendet']);
        exit;
    }

    // ==============================================
    // MODE: VERIFY → Code prüfen und ggf. App-Hash erzeugen
    // ==============================================
    if ($mode === 'verify') {
        if (!$code) {
            echo json_encode(['status' => 'error', 'error' => 'Code fehlt']);
            exit;
        }

        $expires = new DateTime($user['code_guilty_until'] ?? '1970-01-01');

        if ($user['login_code'] !== $code || $now > $expires) {
            echo json_encode(['status' => 'error', 'error' => 'Ungültiger oder abgelaufener Code']);
            exit;
        }

        $response = [
            'status'  => 'ok',
            'user_ID' => $user['user_ID'],
            'rolle'   => $user['rolle']
        ];

        if ($client === 'app') {
            $newAppHash = bin2hex(random_bytes(32));
            $stmt = $pdo->prepare("UPDATE users SET app_hash = ?, login_status = 'eingeloggt' WHERE user_ID = ?");
            $stmt->execute([$newAppHash, $user['user_ID']]);
            $response['app_hash'] = $newAppHash;
        } else {
            $stmt = $pdo->prepare("UPDATE users SET login_status = 'eingeloggt' WHERE user_ID = ?");
            $stmt->execute([$user['user_ID']]);
            session_start();
            $_SESSION['user_ID'] = $user['user_ID'];
            $_SESSION['rolle']   = $user['rolle'];
        }

        echo json_encode($response);
        exit;
    }

    // ==============================================
    // MODE: AUTOLOGIN → App-Hash prüfen
    // ==============================================
    if ($mode === 'autologin') {
        if (!$appHash) {
            echo json_encode(['status' => 'error', 'error' => 'App-Hash fehlt']);
            exit;
        }

        if ($user['app_hash'] !== $appHash) {
            echo json_encode(['status' => 'error', 'error' => 'Ungültiger App-Hash – bitte neu einloggen']);
            exit;
        }

        if ($user['aktiv'] !== 'aktiv') {
            echo json_encode(['status' => 'error', 'error' => 'Konto ist inaktiv']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE users SET login_status = 'eingeloggt' WHERE user_ID = ?");
        $stmt->execute([$user['user_ID']]);

        echo json_encode([
            'status'  => 'ok',
            'user_ID' => $user['user_ID'],
            'rolle'   => $user['rolle']
        ]);
        exit;
    }

    echo json_encode(['status' => 'error', 'error' => 'Ungültiger Modus']);
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'error' => $e->getMessage()]);
}
