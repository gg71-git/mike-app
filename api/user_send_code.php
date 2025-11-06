<?php
require_once '../db_connect.php';
require_once '../phpmailer/PHPMailer.php';
require_once '../phpmailer/SMTP.php';
require_once '../phpmailer/Exception.php';
$mailTemplates = require_once __DIR__ . '/../admin/includes/mail_templates.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// ENV-Datei einlesen (einmalig je Skript nötig)
$envPath = realpath(__DIR__ . '/../.env');
if ($envPath && file_exists($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (strpos(trim($line), '=') !== false) {
            [$key, $value] = explode('=', $line, 2);
            putenv(trim($key) . '=' . trim($value));
        }
    }
}

/**
 * Zentrale Mail-Funktion – wird von auth.php und Einladung genutzt
 */
function sendUserMail(string $toEmail, string $vorname, string $subject, string $body): bool|string {
    try {
        $mail = new PHPMailer(true);
        $mail->CharSet = 'UTF-8';

        $mail->isSMTP();
        $mail->Host       = getenv('SMTP_HOST');
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('SMTP_USER');
        $mail->Password   = getenv('SMTP_PASS');
        $mail->SMTPSecure = 'tls';
        $mail->Port       = getenv('SMTP_PORT');

        $mail->setFrom('Mike@app.com', 'Mike App');
        $mail->addAddress($toEmail, $vorname);

        $mail->isHTML(false);
        $mail->Subject = $subject;
        $mail->Body    = $body;

        $mail->send();
        return true;
    } catch (Exception $e) {
        return "Mailversand fehlgeschlagen: " . $mail->ErrorInfo;
    }
}

// =======================================================
// Nur wenn Datei direkt aufgerufen wird → Einladung senden
// =======================================================
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    header('Content-Type: application/json');

    $data = json_decode(file_get_contents('php://input'), true);
    $user_ID = $data['user_ID'] ?? null;

    if (!$user_ID || !is_numeric($user_ID)) {
        echo json_encode(['error' => 'Ungültige oder fehlende user_ID']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT vorname, email, aktiv FROM users WHERE user_ID = ?");
        $stmt->execute([$user_ID]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            echo json_encode(['error' => 'Benutzer nicht gefunden']);
            exit;
        }
        if (!$user['aktiv']) {
            echo json_encode(['error' => 'Benutzer ist nicht aktiv']);
            exit;
        }
        if (!filter_var($user['email'], FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['error' => 'Ungültige E-Mail-Adresse']);
            exit;
        }

        // Einladung verschicken – KEIN login_code
        $subject = $mailTemplates['einladung_betreff'];
        $body    = $mailTemplates['einladung_body']($user['vorname']);

        $sendResult = sendUserMail($user['email'], $user['vorname'], $subject, $body);

        if ($sendResult === true) {
            echo json_encode(['status' => 'OK', 'message' => 'Einladung gesendet']);
        } else {
            echo json_encode(['error' => $sendResult]);
        }
    } catch (PDOException $e) {
        echo json_encode(['error' => 'DB-Fehler: ' . $e->getMessage()]);
    }
}
