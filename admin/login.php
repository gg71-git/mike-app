<?php
declare(strict_types=1);
session_start();
?>
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Login – Verwaltung</title>
  <link rel="stylesheet" href="../../admin/css/admin.css">
</head>
<body class="login-page">
  <div class="login-container">
    <h1>Login – Mike-App Verwaltung</h1>

    <label for="email" title="Email-Adresse, an welche die Einladung versendet wurde">E-Mail</label>
    <input type="email" id="email" placeholder="user@example.com" required>

    <button id="btn-request">Code anfordern</button>

    <div id="verify-section" class="hidden">
      <label for="code">Login-Code</label>
      <input type="text" id="code" placeholder="123456" maxlength="6">

	   <div class="checkbox-container">
      <label title="Mit dieser Option bleibt der Code aus der E-Mail für 30 Tage gültig">
        <input type="checkbox" id="remember"> 30 Tage merken
      </label>
       </div>
	<button id="btn-verify">Einloggen</button>
   </div>

    <div class="msg" id="msg"></div>
  </div>

  <script src="js/login.js"></script>
</body>
</html>
