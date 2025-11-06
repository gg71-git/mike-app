<?php
session_start();

if (isset($_GET['role'])) {
    $validRoles = ['admin','kunde_admin','agent','kunde_user'];
    $role = $_GET['role'];

    if (in_array($role, $validRoles, true)) {
        $_SESSION['rolle'] = $role;

        // Test-IDs setzen (nur für Simulation!)
        if ($role === 'kunde_admin') {
            $_SESSION['kundenID'] = 1;   // Dummy-Kunde
        }
        if ($role === 'agent') {
            $_SESSION['hd_ID'] = 1;      // Dummy-Helpdesk
        }
    }
}

header('Location: ' . ($_SERVER['HTTP_REFERER'] ?? '/admin/pages/manage.php'));
exit;
