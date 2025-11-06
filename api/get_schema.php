<?php
require_once __DIR__ . '/../db_connect.php';

$dependenciesFile = __DIR__ . '/schema_dependencies.json';
$dependencies = [];
if (file_exists($dependenciesFile)) {
    $dependencies = json_decode(file_get_contents($dependenciesFile), true);
}

// Debug-Level 1: nur Datei-Check
if (isset($_GET['debug']) && $_GET['debug'] == 1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo "Dependencies file: " . $dependenciesFile . PHP_EOL;
    echo "Exists: " . (file_exists($dependenciesFile) ? 'YES' : 'NO') . PHP_EOL;
    echo "Dependencies: " . print_r($dependencies, true) . PHP_EOL;
    exit;
}

function getSchema(string $table, PDO $pdo, array $dependencies = []): array {
    if (empty($table)) {
        return ['error' => 'Keine Tabelle angegeben'];
    }

    try {
        // Spalteninfos holen
        $stmt = $pdo->prepare("
            SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT, COLUMN_KEY
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table
            ORDER BY ORDINAL_POSITION
        ");
        $stmt->execute([':table' => $table]);
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Unique-Spalten
        $stmt = $pdo->prepare("
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = :table
              AND NON_UNIQUE = 0
        ");
        $stmt->execute([':table' => $table]);
        $uniqueCols = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'COLUMN_NAME');

        // Overrides laden
        $overrides = require __DIR__ . '/schema_overrides.php';

        $fields = [];
        foreach ($columns as $col) {
            $name    = $col['COLUMN_NAME'];
            $type    = $col['DATA_TYPE'];
            $colType = $col['COLUMN_TYPE'];

            // ENUM → Optionen einbetten
            $options = null;
            if (strpos($colType, "enum(") === 0) {
                preg_match_all("/'([^']+)'/", $colType, $matches);
                $options = array_map(
                    fn($v) => ['id' => $v, 'label' => $v],
                    $matches[1]
                );
            }

            $hidden   = ($col['COLUMN_KEY'] === 'PRI') || (stripos($col['COLUMN_COMMENT'], 'hidden') !== false);
			$required = ($col['IS_NULLABLE'] === 'NO');

			// Sonderfall: Kontaktfelder und Helpdesk-Ansprechpartner dürfen beim Anlegen leer bleiben
			if (in_array($name, ['Kontakt_technisch', 'Kontakt_kaufm', 'helpdesk_ansprechpartner_id'])) {
				$required = false;
			}

            $unique   = in_array($name, $uniqueCols);
            $primary  = ($col['COLUMN_KEY'] === 'PRI');

            $field = [
                'name'     => $name,
                'label'    => $name,
                'type'     => $type,
                'options'  => $options,
                'hidden'   => $hidden,
                'required' => $required,
                'unique'   => $unique,
                'primary'  => $primary
            ];

            // --- Overrides prüfen ---
            if (isset($overrides[$table][$name])) {
                $override = $overrides[$table][$name];
                if (isset($override['hidden'])) {
                    $field['hidden'] = (bool)$override['hidden'];
                }
                if (isset($override['label'])) {
                    $field['label'] = $override['label'];
                }
            }

						// --- Dependencies prüfen ---
			// --- Dependencies prüfen ---
			$fieldKey = $table . "." . $name;
			if (isset($dependencies[$fieldKey])) {
				$field['dependency'] = $dependencies[$fieldKey];
				// URL für dynamisches Nachladen
				$field['options_url'] = "/api/get_options.php?field=" . urlencode($fieldKey);

				if (isset($_GET['debug']) && $_GET['debug'] == 2) {
					$field['debug_dependency'] = $dependencies[$fieldKey];
				}
			}

            // --- Sonderfälle ---
            elseif ($name === 'helpdesk_ID') {
                $customerFilter = $_GET['filter_customer'] ?? null;
                $sql = "SELECT helpdesk_ID AS id, helpdesk_name AS label FROM helpdesks";
                $params = [];
                if ($customerFilter) {
                    $sql .= " WHERE customer_ID = :cid";
                    $params[':cid'] = $customerFilter;
                }
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $field['options'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
            elseif ($name === 'customer_ID') {
                $sql = "SELECT customer_ID AS id, customer_name AS label FROM customers";
                $stmt = $pdo->query($sql);
                $field['options'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
            // --- generische *_ID Regel (Fallback, wenn keine Dependencies oder Sonderfälle) ---
            elseif (preg_match('/(.+)_ID$/', $name, $m)) {
                $refTable = $m[1] . "s";
                $sql = "SELECT {$name} AS id, {$name} AS label FROM {$refTable}";
                try {
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute();
                    $options = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    $field['options'] = $options;

                    if (isset($_GET['debug']) && $_GET['debug'] == 2) {
                        $field['debug_match'] = true;
                        $field['debug_sql']   = $sql;
                    }
                } catch (Throwable $e) {
                    if (isset($_GET['debug']) && $_GET['debug'] == 2) {
                        $field['debug_match'] = false;
                        $field['debug_error'] = $e->getMessage();
                    }
                }
            }

            if (isset($_GET['debug']) && $_GET['debug'] == 2) {
                $field['debug_lookup'] = null; // zur Klarheit: kein lookup mehr
            }

            $fields[] = $field;
        }

        $result = ['table' => $table, 'fields' => $fields];

        if (isset($_GET['debug']) && $_GET['debug'] == 2) {
            $result['debug_fields'] = array_column($fields, 'name');
        }

        return $result;

    } catch (Throwable $e) {
        return ['error' => $e->getMessage()];
    }
}

// Direktaufruf
if (basename($_SERVER['SCRIPT_FILENAME']) === 'get_schema.php') {
    $table = $_GET['table'] ?? '';
    $result = getSchema($table, $pdo, $dependencies);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}
