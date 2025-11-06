<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'phpmailer/PHPMailer.php';
require 'phpmailer/SMTP.php';
require 'phpmailer/Exception.php';

function sendLoginCode($toEmail, $code) {
    $mail = new PHPMailer(true);
    $mail->CharSet = 'UTF-8';

    try {
        // Server-Einstellungen
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'guido.gruen71@gmail.com';
        $mail->Password   = 'ccjnzonrpygseqbg'; // App-spezifisches Passwort
        $mail->SMTPSecure = 'tls';
        $mail->Port       = 587;

        // Absender/Empfänger
        $mail->setFrom('guido.gruen71@gmail.com', 'Mike Login');
        $mail->addAddress($toEmail);

        // Inhalt
        $mail->isHTML(true);
        $mail->Subject = 'Dein Login-Code für Mike';
        $mail->Body    = "<p>Hallo!</p><p>Dein Login-Code lautet:</p><h2>$code</h2><p>Er ist 10 Minuten lang gültig.</p>";

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("Mail-Fehler: {$mail->ErrorInfo}");
        return false;
    }
}

