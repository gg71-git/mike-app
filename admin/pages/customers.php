<?php
$page = "customers";        // technischer Name für Datei/API
$pagename = "Kunden"; // lesbarer Name für Überschrift, Buttons etc.
$tab_ID = "customer_ID";   // Primärschlüsselfeld dieser Tabelle
$showCodeBtn = false;   // Mail an User senden
$pageclass = 'customers';         // CSS-Klasse für Farbe

require_once '../../db_connect.php';
require_once '../../api/get_schema.php';

$feld = $_GET['feld'] ?? null;
$wert = $_GET['wert'] ?? null;

// Schema laden per HTTP-Aufruf
$url = "http://{$_SERVER['HTTP_HOST']}/api/get_schema.php?table={$page}";

// Falls eine ID (z. B. customer_ID) mitgegeben wurde, anhängen
if (isset($_GET[$tab_ID])) {
    $url .= "&" . $tab_ID . "=" . urlencode($_GET[$tab_ID]);
}

$schemaJson = file_get_contents($url);
$schema = json_decode($schemaJson, true);

if (!$schema || !isset($schema['fields'])) {
    echo "Fehler: Schema konnte nicht geladen werden.";
    exit;
}

// Daten laden (weiterhin alle Felder, Ausgabe filtert später)
try {
    $feld = $_GET['feld'] ?? null;
    $wert = $_GET['wert'] ?? null;

    $sql = "SELECT * FROM {$page}";
    $params = [];

    if ($feld && $wert && $wert !== "Alle") {
        // erlaubte Felder über get_schema prüfen
        $allowedFields = array_column(getSchema($page, $pdo)['fields'], 'name');
        if (in_array($feld, $allowedFields, true)) {
            $sql .= " WHERE `$feld` LIKE :wert";
            $params[':wert'] = "%$wert%";
        }
    }

    $sql .= " ORDER BY {$tab_ID} ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $user = $stmt->fetchAll(PDO::FETCH_ASSOC);

} catch (PDOException $e) {
    echo "Fehler bei der Datenbankabfrage: " . $e->getMessage();
    exit;
}

	// Feldnamen → lesbare Labels
	$fieldLabels = [
	  'customer_ID' => 'Kunde',
	  'helpdesk_ID'    => 'Helpdesk'
	];
?>

<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title><?= $pagename ?> editieren</title>
  <link rel="stylesheet" href="../../admin/css/admin.css">
</head>
<body>
  <div class="admin-container wide <?= $pageclass ?>">
    <!-- Kopfzeile -->
    <div class="section-header">
      <h2><?= $pagename ?> editieren</h2>
      <div class="new-entry-button-wrapper">
        <img src="../assets/New_white.svg" id="btn-global-new" title="Neuen Datensatz anlegen">
      </div>
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
                <?= htmlspecialchars($fieldLabels[$field['name']] ?? ucfirst($field['label'])) ?>
              </th>
            <?php endif; ?>
          <?php endforeach; ?>
        </tr>
      </thead>

<tbody>
  <?php foreach ($user as $eintrag): ?>
    <?php
      $status = 'offen';
      if (!empty($eintrag['letzter_login'])) {
        $status = 'eingeloggt';
      } elseif (!empty($eintrag['login_code'])) {
        $status = 'gesendet';
      }
    ?>
    <tr 
      data-id="<?= htmlspecialchars($eintrag[$tab_ID]) ?>"
      data-status="<?= $status ?>"
      <?php foreach ($schema['fields'] as $field): ?>
        <?php if (!$field['hidden']): ?>
          data-original-<?= $field['name'] ?>="<?= htmlspecialchars($eintrag[$field['name']] ?? '') ?>"
        <?php endif; ?>
      <?php endforeach; ?>
    >
      <td class="action-col">
        <button class="btn-copy" title="Ganzen Eintrag kopieren"
                data-id="<?= htmlspecialchars($eintrag[$tab_ID]) ?>">
          <span>⧉</span>
        </button>
        <button class="btn-delete" title="Ganzen Eintrag löschen" 
                data-id="<?= htmlspecialchars($eintrag[$tab_ID]) ?>">
          <span>✖</span>
        </button>
        <?php if ($showCodeBtn): ?>
          <button class="btn-invite <?= $status ?>" 
                  data-id="<?= htmlspecialchars($eintrag[$tab_ID]) ?>"
                  title="Einladungs-Status: <?= ucfirst($status) ?>">
            <span class="symbol">🖂</span>
          </button>
        <?php endif; ?>
      </td>

      <?php foreach ($schema['fields'] as $field): ?>
        <?php if (!$field['hidden']): ?>
          <?php $value = htmlspecialchars($eintrag[$field['name']] ?? ''); ?>
          <td 
            data-field="<?= $field['name'] ?>"
            data-value="<?= $value ?>"
            contenteditable="true"
          ><?= $value ?></td>
        <?php endif; ?>
      <?php endforeach; ?>
    </tr>
  <?php endforeach; ?>
</tbody>

    </table>
  </div>
</div>


    <div class="nav-hint">
      Navigation: ALT + ⬅️➡️⬆️⬇️ &nbsp;|&nbsp;
      Auswahl: TAB + Alt + ⬆️⬇️
    </div>

    <a class="fertig-button" href="manage.php">Filtern und Importieren</a>

  <div class="table-tools">
    <button id="clear-markings-btn" title="Markierungen aufheben">
    <img src="../assets/clear-mark.svg" alt="Markierungen aufheben" />
  </button>
  </div>	  
	  
    <?php if (!empty($_GET['feld']) && !empty($_GET['wert']) && $_GET['wert'] !== "Alle"): ?>
      <div style="margin: 10px 0;">
          <a href="<?= $page ?>.php" class="clear-filter-button">Filter löschen</a>
      </div>
      <script>
        document.addEventListener("keydown", function(e) {
          if (e.key === "Escape") {
            window.location.href = "<?= $page ?>.php";
          }
        });
      </script>
    <?php endif; ?>
  
  </div>

<script>
// Feldreihenfolge exakt wie Tabelle (nur sichtbare Felder)
window.__feldReihenfolge = <?= json_encode(
    array_column(
        array_filter($schema['fields'], fn($f) => !$f['hidden']),
        'name'
    ),
    JSON_UNESCAPED_UNICODE
) ?>;

// Entity-spezifische Settings
window.zielTabelle = <?= json_encode($schema['table']) ?>;
window.entityTyp   = <?= json_encode($schema['table']) ?>;

// Primärschlüssel-Feld suchen → erstes *_ID im Schema
window.idFeld = (<?= json_encode($schema['fields'], JSON_UNESCAPED_UNICODE) ?>)
    .map(f => f.name)
    .find(n => n.toLowerCase().endsWith("_id"));

// Zusatzfelder
window.dateFelder      = ['erstellt_am', 'letzter_login']; // wenn im Schema enthalten
window.zeigeCodeButton = (window.zielTabelle === <?= json_encode($page) ?>);
</script>

<script src="../../admin/js/components.js"></script>
<script type="module" src="../js/admin.js"></script>
<script type="module" src="../js/admin_new.js"></script>
<script>
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("new") === "1") {
    const btn = document.getElementById("btn-global-new");
    if (btn) btn.click();
  }
});
</script>
	</body>
</html>
