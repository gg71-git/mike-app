<?php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/permissions.php';

/**
 * Holt Daten aus einer Tabelle, berücksichtigt Rolle & Kontext
 */
function fetchTable(string $table, array $extraWhere = []): array {
    global $pdo;

    $role     = $_SESSION['rolle']     ?? null;
    $kundenID = $_SESSION['kundenID']  ?? null;
    $hd_ID    = $_SESSION['hd_ID']     ?? null;

    $action = 'view';
    $perm = checkPermission($role, $table, $action);

    if ($perm === false) {
        return [];
    }

    // Grund-Query
    $sql = "SELECT * FROM `$table`";
    $where = [];
    $params = [];

    // Berechtigungsabhängige Filter
    if ($perm === 'own' && $kundenID) {
        $where[] = "$table.kundenID = :kundenID";
        $params[':kundenID'] = $kundenID;
    }
    if ($perm === 'assigned' && $hd_ID) {
        $where[] = "$table.hd_ID = :hd_ID";
        $params[':hd_ID'] = $hd_ID;
    }

    // Zusätzliche Filter
    foreach ($extraWhere as $col => $val) {
        $where[] = "$table.$col = :$col";
        $params[":$col"] = $val;
    }

    if ($where) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
