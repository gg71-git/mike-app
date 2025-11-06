<?php
// =======================================================
// get_options.php – generische Options-API (Produktivversion)
// =======================================================
//
// - liest schema_dependencies.json
// - ersetzt {row.xyz}-Platzhalter nur, wenn Werte vorhanden
// - kein „0“- oder Fallback-Trick mehr
// - liefert IMMER ein Array [{id,label}] zurück
// =======================================================

require_once __DIR__ . '/../db_connect.php';
header('Content-Type: application/json; charset=utf-8');

// -------------------------------------------------------
// Eingangsparameter
// -------------------------------------------------------
$field = $_GET['field'] ?? '';
$rowContext = $_GET;

try {

    // -------------------------------------------------------
    // JSON-Definition laden
    // -------------------------------------------------------
    $depsFile = __DIR__ . '/schema_dependencies.json';
    $deps = json_decode(file_get_contents($depsFile), true);

    if (!$field || !isset($deps[$field])) {
        echo json_encode([]);
        exit;
    }

    // -------------------------------------------------------
    // Felddefinition aus JSON übernehmen
    // -------------------------------------------------------
    $def = $deps[$field];
    [$refTable, $refCol] = explode('.', $def['references']);
    $labelExpr = !empty($def['label'])
        ? '(' . $def['label'] . ')'
        : $refCol;
    $source = $def['source'] ?? $refTable;
    $filter = $def['filter'] ?? '1=1';
    $filterOriginal = $filter; // nur Debug-Zwecke

    // -------------------------------------------------------
    // Platzhalter {row.xyz} ersetzen
    // -------------------------------------------------------
    preg_match_all('/\{row\.([a-zA-Z0-9_]+)\}/', $filter, $matches, PREG_SET_ORDER);
    foreach ($matches as $m) {
        $key = $m[1];
        if (isset($rowContext[$key]) && $rowContext[$key] !== '') {
            $val = is_numeric($rowContext[$key])
                ? (int)$rowContext[$key]
                : $pdo->quote($rowContext[$key]);
            $filter = str_replace($m[0], $val, $filter);
        } else {
            // kein Wert → neutraler Ersatz
            $filter = str_replace($m[0], '0', $filter);
        }
    }

    // -------------------------------------------------------
    // SQL-Query
    // -------------------------------------------------------
// -------------------------------------------------------
// SQL-Query-Grundstruktur
// -------------------------------------------------------
$sql = "
    SELECT {$refCol} AS id,
           {$labelExpr} AS label
    FROM {$source}
";

// -----------------------------------------------------------
// Platzhalter im Filter aus schema_dependencies.json ersetzen
// -----------------------------------------------------------
if (!empty($dep['filter'])) {
    $dynFilter = $dep['filter'];

    // {row.customer_ID} → URL-Parameter customer_ID
    if (strpos($dynFilter, '{row.customer_ID}') !== false && isset($_GET['customer_ID'])) {
        $dynFilter = str_replace('{row.customer_ID}', intval($_GET['customer_ID']), $dynFilter);
    }

    // {row.helpdesk_ID} → URL-Parameter helpdesk_ID
    if (strpos($dynFilter, '{row.helpdesk_ID}') !== false && isset($_GET['helpdesk_ID'])) {
        $dynFilter = str_replace('{row.helpdesk_ID}', intval($_GET['helpdesk_ID']), $dynFilter);
    }

    // {row.user_ID} → URL-Parameter user_ID
    if (strpos($dynFilter, '{row.user_ID}') !== false && isset($_GET['user_ID'])) {
        $dynFilter = str_replace('{row.user_ID}', intval($_GET['user_ID']), $dynFilter);
    }

    // Lokalen Filter aus Dependency übernehmen
    $filter = $dynFilter;
}

// -------------------------------------------------------
// WHERE / ORDER anhängen
// -------------------------------------------------------
if (!empty($filter) && trim($filter) !== '1=1') {
    $sql .= " WHERE {$filter}";
}

$sql .= " ORDER BY label";


    // -------------------------------------------------------
    // Query ausführen
    // -------------------------------------------------------
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $stmt = $pdo->query($sql);

    if (!$stmt) {
        $err = $pdo->errorInfo();
        echo json_encode(['sql_error' => $err, 'sql' => $sql]);
        exit;
    }

    $options = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($options, JSON_UNESCAPED_UNICODE);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage(),
        'sql'   => $sql ?? null,
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}
