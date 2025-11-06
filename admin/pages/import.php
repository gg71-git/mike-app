<?php
session_start();

$page     = "tmp_import";   // technische Tabelle
$pagename = "Import";       // Anzeigename
$tab_ID   = "tmp_import_ID";
$origin   = $_GET['origin'] ?? null;   // Herkunfts-Tabelle

require_once '../../db_connect.php';
require_once '../../api/get_schema.php';

// Schema laden
$schemaJson = file_get_contents("http://{$_SERVER['HTTP_HOST']}/api/get_schema.php?table={$page}");
$schema = json_decode($schemaJson, true);

if (!$schema || !isset($schema['fields'])) {
    echo "Fehler: Schema konnte nicht geladen werden.";
    exit;
}

// Daten laden
$stmt = $pdo->query("SELECT * FROM {$page} ORDER BY {$tab_ID} ASC");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// -------------------------------------------------------
// Unique-Werte aus Origin-Tabelle holen
// -------------------------------------------------------
$uniqueValues = [];

if ($origin) {
    $originSchema = getSchema($origin, $pdo);

    if ($originSchema && isset($originSchema['fields'])) {
        foreach ($originSchema['fields'] as $f) {
            if (!empty($f['unique'])) {
                $col = $f['name'];
                $stmt = $pdo->query("SELECT `$col` FROM `$origin` WHERE `$col` IS NOT NULL");
                $uniqueValues[$col] = $stmt->fetchAll(PDO::FETCH_COLUMN);
            }
        }
    }
}


// Fehler-Array aus Session für JS
$importErrors = $_SESSION['import_errors'] ?? [];

?>
<script>
  window.importErrors = <?= json_encode($importErrors, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT); ?>;
</script>

<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title><?= $pagename ?> prüfen</title>
  <link rel="stylesheet" href="../../admin/css/admin.css">
  <style>
    .invalid-cell {
      background-color: #f39c12 !important; /* orange = Syntaxfehler */
      color: #000 !important;
    }
    .duplicate-cell {
      background-color: #e74c3c !important; /* rot = Duplikat */
      color: #fff !important;
    }
  </style>
</head>
<body data-page="<?= htmlspecialchars($page) ?>"
      data-origin-table="<?= htmlspecialchars($origin) ?>">
<div class="admin-container wide">
  <div class="section-header">
    <h2><?= $pagename ?> prüfen</h2>
  </div>

  <div class="table-area">
    <div class="table-scroll-wrapper">
      <table class="preview-table">
        <thead>
          <tr>
            <th class="aktion-col"><div class="aktion-header">Aktion</div></th>
            <?php foreach ($schema['fields'] as $field): ?>
              <?php if (!$field['hidden']): ?>
                <th data-field="<?= htmlspecialchars($field['name']) ?>">
                  <?= htmlspecialchars($field['label']) ?>
                </th>
              <?php endif; ?>
            <?php endforeach; ?>
          </tr>
        </thead>
        <tbody>
        <?php foreach ($rows as $r): ?>
          <tr data-id="<?= htmlspecialchars($r[$tab_ID]) ?>"
              <?php foreach ($schema['fields'] as $field): ?>
                data-original-<?= $field['name'] ?>="<?= htmlspecialchars($r[$field['name']] ?? '') ?>"
              <?php endforeach; ?>
          >
            <td class="action-col">
              <button class="btn-delete" title="Zeile löschen" data-id="<?= htmlspecialchars($r[$tab_ID]) ?>">✖</button>
            </td>

            <?php foreach ($schema['fields'] as $field): ?>
              <?php if (!$field['hidden'] && $field['name'] !== $tab_ID): ?>
                <?php 
                  $val = $r[$field['name']] ?? "";
                  $isInvalid = ($val === "" || $val === "Bitte wählen!");
                ?>
                <td 
                  data-field="<?= $field['name'] ?>"
                  data-value="<?= htmlspecialchars($val) ?>"
                  contenteditable="true"
                  class="<?= $isInvalid ? 'invalid-cell' : '' ?>"
                >
                  <?= htmlspecialchars($val !== "" ? $val : "Bitte wählen!") ?>
                </td>
              <?php endif; ?>
            <?php endforeach; ?>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>

  <div class="legend-nav">
    <div class="import-legend">
      <span style="background:#e74c3c;color:#fff;padding:2px 6px;">Rot</span> = Duplikat in Zieltabelle
      <span style="background:#f39c12;color:#000;padding:2px 6px; margin-left:20px;">Orange</span> = Syntaxfehler
    </div>
    <div class="nav-hint">
      Navigation mit ALT + ⬅️➡️⬆️⬇️
    </div>
  </div>

  <button class="fertig-button" id="import-commit">Daten übernehmen</button>
</div>

<script>
// Feldreihenfolge exakt wie Tabelle
window.__feldReihenfolge = <?= json_encode(
    array_column(
        array_filter($schema['fields'], fn($f) => !$f['hidden']),
        'name'
    ),
    JSON_UNESCAPED_UNICODE
) ?>;

window.tableName   = "tmp_import";
window.entityTyp   = "tmp_import";
window.idField     = "tmp_import_ID";

window.dateFelder      = [];
window.zeigeCodeButton = false;
</script>

<script src="../js/components.js"></script>
<script type="module" src="../js/admin.js"></script>

<?php
if (!isset($uniqueValues) || !is_array($uniqueValues)) {
    $uniqueValues = [];
}
?>
	
	
<script>
  window.uniqueValues = <?= json_encode($uniqueValues, JSON_UNESCAPED_UNICODE) ?>;
</script>

	
<script type="module">
import { validateRow } from '../js/admin_utils.js';
import { ladeSchema } from '../js/admin_utils.js';

document.addEventListener("DOMContentLoaded", async () => {
  const tableName = document.body.getAttribute("data-origin-table") || "user";
  const schema = await ladeSchema(tableName);

  // Syntax-Validierung
  document.querySelectorAll("tbody tr").forEach(row => {
    const check = validateRow(row, schema);
    if (!check.ok) {
      // betroffene Felder sind bereits von validateRow orange markiert
      console.log("⚠️ Syntaxfehler in Zeile", row.dataset.id, check);
    }
  });

// Unique-Prüfung gegen Origin
const uniques = window.uniqueValues || {};
document.querySelectorAll("tbody tr").forEach(row => {
  for (const col in uniques) {
    const idx = window.__feldReihenfolge.indexOf(col);
    if (idx === -1) continue;
    const td = row.cells[idx + 1];
    if (!td) continue;

    const val = td.getAttribute("data-value") || td.textContent.trim();
    if (val && uniques[col].includes(val)) {
      td.classList.add("duplicate-cell");
      console.log("❌ Duplikat erkannt:", col, val, "in Zeile", row.dataset.id);
    }
  }
});


  // Import-Button deaktivieren, wenn Fehler
  const commitBtn = document.getElementById("import-commit");
  if (commitBtn) {
    if (document.querySelector(".duplicate-cell, .invalid-cell")) {
      commitBtn.disabled = true;
      commitBtn.title = "Bitte erst Fehler bereinigen!";
    }
  }
});
</script>

</body>
</html>
