<?php
session_start();
require_once '../../db_connect.php';
require_once '../../api/get_schema.php';
require_once '../includes/permissions.php';   // <--- NEU

// Nur zum Testen – entfernen, wenn Login aktiv ist
if (!isset($_SESSION['rolle'])) {
    $_SESSION['rolle'] = 'admin';
}
$currentRole = $_SESSION['rolle'];   // <--- NEU

function buildFilterBox(string $typ, array $schema, PDO $pdo): string {
    $ziel = $typ . ".php";
    $label = ucfirst($typ);

    $feldOptions = '';
    foreach ($schema['fields'] as $field) {
        if ($field['hidden']) continue; // hidden Felder überspringen
        $feldOptions .= "<option value=\"{$field['name']}\">{$field['name']}</option>";
    }

    $kundenFilter = '';
    if ($_SESSION['rolle'] === 'kundenadmin' && isset($_SESSION['customerID'])) {
        $kundenFilter = "&customerID=" . intval($_SESSION['customerID']);
    }

    // Eingabeelement (Text oder Select) je nach aktuellem Feld dynamisch in JS gewählt
    return "
    <div class='filter-box {$typ}'>
        <a href='{$ziel}' class='tab-button {$typ}'>{$label}</a>
            <label for='feld_{$typ}'>Suchen nach:</label>
            <select id='feld_{$typ}' onchange=\"updateInput('$typ')\">
                {$feldOptions}
            </select>
            <span id='inputWrapper_{$typ}'></span>
            <button class='green-button' onclick=\"filtern('$typ', '$ziel', '$kundenFilter')\">
                anzeigen, hinzufügen und editieren
            </button>
        </div>
    ";
}

// Tabellen aus Meta-Tabelle laden
$stmt = $pdo->query("SELECT table_name 
                     FROM table_settings 
                     WHERE show_in_manage = 1");
$tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

$schemas = [];
$filterBoxes = '';
foreach ($tables as $table) {
    $schema = getSchema($table, $pdo);
    $schemas[$table] = $schema;
    $filterBoxes .= buildFilterBox($table, $schema, $pdo);
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Filter & Upload</title>
    <link rel="stylesheet" href="../css/admin.css?v=<?= time() ?>">
</head>
<body data-current-role="<?= htmlspecialchars($currentRole) ?>">

  <div class="page-wrapper">
   <div class="admin-container filter">
       <h2>Filter & Upload</h2>

       <div class="filter-row">
           <?= $filterBoxes ?>
       </div>

<div class="logout-container">
  <a href="../logout.php" class="logout-icon" title="Abmelden">
    <img src="../assets/Exit.svg" alt="Logout">
  </a>
</div>
	   
   </div>
</div>

<script>
// Schema aus PHP ins JS übernehmen
const schemas = <?= json_encode($schemas, JSON_UNESCAPED_UNICODE) ?>;

// Eingabeelement dynamisch austauschen
function updateInput(typ) {
    const feld = document.getElementById('feld_' + typ).value;
    const wrapper = document.getElementById('inputWrapper_' + typ);
    wrapper.innerHTML = '';

    const field = schemas[typ].fields.find(f => f.name === feld);
    if (field && field.options) {
        // Dropdown (ENUM oder Lookup)
        const select = document.createElement('select');
        select.id = 'wert_' + typ;

        const optAll = document.createElement('option');
        optAll.value = 'Alle';
        optAll.textContent = 'Alle';
        select.appendChild(optAll);

        field.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.id;
            option.textContent = opt.label;
            select.appendChild(option);
        });

        wrapper.appendChild(select);
    } else {
        // Textfeld
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'wert_' + typ;
        input.placeholder = 'Suchbegriff...';
        input.value = 'Alle';

        // Text "Alle" beim Fokus komplett markieren
        input.addEventListener('focus', e => {
            e.target.select();
        });

        wrapper.appendChild(input);
    }
}


// Filterfunktion
function filtern(typ, ziel, kundenFilter) {
    const feld = document.getElementById('feld_' + typ).value;
    const wertElem = document.getElementById('wert_' + typ);
    const wert = encodeURIComponent(wertElem.value.trim());

    if (!wert) {
        alert("Bitte einen Suchbegriff eingeben.");
        return;
    }

    const url = `${ziel}?feld=${feld}&wert=${wert}${kundenFilter}`;
    window.location.href = url;
}

// Enter-Taste triggert Filter
document.addEventListener("DOMContentLoaded", () => {
  Object.keys(schemas).forEach(typ => {
    updateInput(typ); // initial aufbauen

    const wrapper = document.getElementById('inputWrapper_' + typ);
    wrapper.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const ziel = typ + ".php";
        const kundenFilter = <?= json_encode($_SESSION['rolle'] === 'kundenadmin' && isset($_SESSION['customerID'])
          ? "&customerID=" . intval($_SESSION['customerID'])
          : ""); ?>;
        filtern(typ, ziel, kundenFilter);
      }
    });
  });
});

// CSV-Buttons
document.addEventListener("DOMContentLoaded", () => {
  Object.keys(schemas).forEach(typ => {
    const box = document.querySelector(".filter-box." + typ);
    if (!box) return;
    const button = document.createElement("a");
    button.className = "csv-button";
    button.textContent = "CSV importieren";
    button.href = `upload.php?page=${typ}`;   // generische Upload-Seite
    box.appendChild(button);
  });
});


</script>
<script defer src="../js/role_simulator.js"></script>
</body>
</html>
