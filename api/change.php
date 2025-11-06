<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
ob_start();

require_once '../db_connect.php';
require_once 'get_schema.php';

$input  = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? null;
$table  = $input['table'] ?? null;
$data   = $input['data'] ?? null;

$validActions = ['create', 'update', 'delete', 'commit_import'];

if (!$action || !$table || !in_array($action, $validActions)) {
    echo json_encode(['status' => 'error', 'error' => 'Ungültige Parameter']);
    exit;
}

try {
    $schema = getSchema($table, $pdo, $dependencies);
    if (isset($schema['error'])) {
        echo json_encode(['status' => 'error', 'error' => $schema['error']]);
        exit;
    }

    $fields  = array_column($schema['fields'], 'name');
    $idField = $schema['fields'][0]['name'] ?? null;

    // -----------------------------------------------------------
    // IMPORT
    if ($action === 'commit_import') {
        $importedIDs = [];
        $errors      = [];

        try {
            $rows = $pdo->query("SELECT * FROM tmp_import")->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as $r) {
                try {
                    $cols   = [];
                    $params = [];
                    $values = [];

                    foreach ($schema['fields'] as $f) {
                        if (!empty($f['hidden'])) continue;
                        $name = $f['name'];
                        if (array_key_exists($name, $r)) {
                            $cols[]           = "`$name`";
                            $params[]         = ":$name";
                            $values[":$name"] = $r[$name];
                        }
                    }

                    if (!$cols) continue;

                    $sql  = "INSERT INTO `$table` (" . implode(",", $cols) . ")
                             VALUES (" . implode(",", $params) . ")";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($values);

                    $importedIDs[] = $pdo->lastInsertId();
                } catch (PDOException $e) {
                    $errors[] = ['row' => $r, 'error' => $e->getMessage()];
                }
            }

            echo json_encode([
                'status'  => 'ok',
                'ids'     => $importedIDs,
                'errors'  => $errors
            ]);
            exit;
        } catch (Exception $e) {
            echo json_encode(['status' => 'error', 'error' => $e->getMessage()]);
            exit;
        }
    }

    // -----------------------------------------------------------
    // CREATE
    if ($action === 'create') {
        $cols   = [];
        $params = [];
        $values = [];

        foreach ($data as $k => $v) {
            if (!in_array($k, $fields, true)) continue;
            $cols[]           = "`$k`";
            $params[]         = ":$k";
            $values[":$k"]    = $v;
        }

        // Immer ein aktiv-Feld erzwingen
        if (in_array('aktiv', $fields, true) && !array_key_exists(':aktiv', $values)) {
            $cols[]        = "`aktiv`";
            $params[]      = ":aktiv";
            $values[":aktiv"] = 'inaktiv';
        }

        $sql = "INSERT INTO `$table` (" . implode(",", $cols) . ")
                VALUES (" . implode(",", $params) . ")";
        $stmt = $pdo->prepare($sql);

        try {
            $stmt->execute($values);
            $id = $pdo->lastInsertId();

            echo json_encode([
                'status' => 'ok',
                'id'     => $id,
                $idField => $id
            ] + $data);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                // Duplicate Key
                $errorMsg = $e->getMessage();
                $dupeColumn = null;

                if (preg_match("/for key '([^']+)'/", $errorMsg, $m)) {
                    $keyName = $m[1];
                    foreach ($schema['fields'] as $f) {
                        if (!empty($f['unique']) && stripos($keyName, $f['name']) !== false) {
                            $dupeColumn = $f['name'];
                            break;
                        }
                    }
                    if (!$dupeColumn) $dupeColumn = $keyName;
                }

                echo json_encode([
                    'status'     => 'duplicate',
                    'error'      => $errorMsg,
                    'dupeColumn' => $dupeColumn,
                    'data'       => $data
                ]);
            } else {
                echo json_encode([
                    'status' => 'error',
                    'error'  => $e->getMessage()
                ]);
            }
        }

        exit;
    }

    // -----------------------------------------------------------
    // UPDATE
    if ($action === 'update') {
        if (!$idField || !isset($data[$idField])) {
            echo json_encode(['status' => 'error', 'error' => 'Kein gültiger Primärschlüssel']);
            exit;
        }
        $idVal = $data[$idField];
        unset($data[$idField]);

        $assignments = [];
        $values      = [];
        foreach ($data as $k => $v) {
            if (!in_array($k, $fields, true)) continue;
            $assignments[] = "`$k`=:$k";
            $values[":$k"] = $v;
        }
        $values[":idVal"] = $idVal;

        $sql = "UPDATE `$table` SET " . implode(",", $assignments) . " WHERE `$idField` = :idVal";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        echo json_encode(['status' => 'ok', $idField => $idVal] + $data);
        exit;
    }

    // -----------------------------------------------------------
    // DELETE
    if ($action === 'delete') {
        if (!$idField || !isset($data[$idField])) {
            echo json_encode(['status' => 'error', 'error' => 'Kein gültiger Primärschlüssel']);
            exit;
        }
        $idVal = $data[$idField];
        $stmt  = $pdo->prepare("DELETE FROM `$table` WHERE `$idField` = :idVal");
        $stmt->execute([':idVal' => $idVal]);
        echo json_encode(['status' => 'ok', $idField => $idVal]);
        exit;
    }

} catch (Throwable $e) {
    ob_end_clean();
    echo json_encode(['status' => 'error', 'error' => $e->getMessage()]);
    exit;
}

ob_end_clean();
