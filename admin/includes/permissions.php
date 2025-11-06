<?php
// admin/includes/permissions.php

// Rollen-Policies
$ROLE_POLICIES = [
    'admin' => [
        '*' => ['view' => true, 'edit' => true, 'create' => true, 'delete' => true]
    ],
    'kunde_admin' => [
        'kunden'    => ['view' => 'own', 'edit' => 'own'],
        'user'      => ['view' => 'own', 'edit' => 'own', 'create' => 'own'],
        'helpdesks' => ['view' => 'own', 'edit' => 'own'],
    ],
    'agent' => [
        'helpdesks' => ['view' => 'assigned'],
        'user'      => ['view' => 'assigned'],
    ],
    'kunde_user' => [
        // keine Berechtigungen
    ]
];

function checkPermission(?string $role, string $table, string $action, array $context = []): bool
{
    global $ROLE_POLICIES;

    if (!$role) {
        return false;
    }
    if ($role === 'admin') {
        return true;
    }

    $policies = $ROLE_POLICIES[$role] ?? [];

    if (isset($policies['*'][$action]) && $policies['*'][$action] === true) {
        return true;
    }

    if (isset($policies[$table][$action])) {
        $rule = $policies[$table][$action];
        if ($rule === true) return true;

        // TODO: 'own' und 'assigned' differenziert prüfen
        if ($rule === 'own') return true;
        if ($rule === 'assigned') return true;
    }

    return false;
}

/**
 * Erzwingt eine Berechtigungsprüfung für klassische Seiten.
 * Bricht mit Fehlermeldung ab, wenn Rolle nicht erlaubt.
 */
function requirePermission(?string $role, string $table, string $action, array $context = []): void
{
    if (!checkPermission($role, $table, $action, $context)) {
        http_response_code(403);

        // Wenn API-Request (JSON erwartet):
        if (php_sapi_name() !== 'cli' && isset($_SERVER['HTTP_ACCEPT']) && str_contains($_SERVER['HTTP_ACCEPT'], 'application/json')) {
            echo json_encode([
                'status' => 'error',
                'error'  => 'Keine Berechtigung für diese Aktion',
                'debug'  => [
                    'role'   => $role,
                    'table'  => $table,
                    'action' => $action
                ]
            ]);
        } else {
            // Klassische HTML-Seiten
            echo '<h1>403 – Keine Berechtigung</h1>';
        }

        exit;
    }
}

