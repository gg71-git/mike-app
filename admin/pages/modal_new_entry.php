<?php
require_once '../../db_connect.php'; // DB-Verbindung

$rolleOptions = [
  [ "id" => "Kunde_user",  "label" => "Kunden-User" ],
  [ "id" => "Kunde_admin", "label" => "Kunden-Admin" ],
  [ "id" => "Agent",       "label" => "Agent" ],
  [ "id" => "Admin",       "label" => "Admin" ]
];

$standortOptions = [
  [ "id" => "Zentrale", "label" => "Zentrale" ],
  [ "id" => "Filiale",  "label" => "Filiale" ]
];

function validateData($customer, $kontakte, $helpdesks, $pdo) {
    $errors = [];

    // --- Customer ---
    if (empty(trim($customer['customer_name'] ?? ''))) {
        $errors[] = "Kundenname darf nicht leer sein.";
    }
    if (!in_array($customer['standort'] ?? '', ['Zentrale', 'Filiale'])) {
        $errors[] = "Ungültiger Standort.";
    }

    // --- Helpdesks ---
    $hasActive = false;
    foreach ($helpdesks as $i => $h) {
        $name  = trim($h['name'] ?? '');
        $email = trim($h['email'] ?? '');
        $tel   = trim($h['telefon'] ?? '');

        if ($name === '' && ($email !== '' || $tel !== '')) {
            $errors[] = "Helpdesk $i: Name fehlt.";
        }
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = "Helpdesk $i: Ungültige E-Mail.";
        }
        if (!empty($h['aktiv'])) {
            $hasActive = true;
        }
    }
    if (!$hasActive) {
        $errors[] = "Mindestens ein Helpdesk muss aktiv sein.";
    }

    // --- Users ---
    foreach ($kontakte as $typ => $k) {
        if (empty(trim($k['nachname'] ?? ''))) {
            $errors[] = "User ($typ): Nachname fehlt.";
        }
        if (empty($k['anrede'])) {
            $errors[] = "User ($typ): Anrede fehlt.";
        }
        if (empty($k['email']) || !filter_var($k['email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = "User ($typ): Ungültige oder leere E-Mail.";
        }
        // Unique-Check in DB
        if (!empty($k['email'])) {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE email=?");
            $stmt->execute([$k['email']]);
            if ($stmt->fetchColumn() > 0) {
                $errors[] = "User ($typ): E-Mail bereits vergeben.";
            }
        }
    }

    return $errors;
}


if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    echo "<pre>POST erhalten:\n";
    print_r($_POST);
    echo "</pre>";

	
$errors = validateData($_POST['customer'] ?? [], $_POST['kontakte'] ?? [], $_POST['helpdesk'] ?? [], $pdo);

if (!empty($errors)) {
    echo "<pre>❌ Validierungsfehler:\n" . implode("\n", $errors) . "</pre>";
    exit; // bricht vor Inserts ab
}
	
	
    try {
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->beginTransaction();

        // 1) Customer
        $customer = $_POST['customer'] ?? [];
        $stmt = $pdo->prepare("
            INSERT INTO customers (customer_name, standort, land, plz, stadt, strasse, doku_link, stdFehler1, stdFehler2, aktiv)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            $customer['customer_name'] ?? null,
            $customer['standort'] ?? null,
            $customer['land'] ?? null,
            $customer['plz'] ?? null,
            $customer['stadt'] ?? null,
            $customer['strasse'] ?? null,
            $customer['doku_link'] ?? null,
            $customer['stdfehler1'] ?? null,
            $customer['stdfehler2'] ?? null,
            !empty($customer['aktiv']) ? 'aktiv' : 'inaktiv'
        ]);
        $customerId = $pdo->lastInsertId();
        echo "✅ Customer ID = $customerId\n";

        $helpdeskIds = [];
        $userIds = [];

        // 2) Helpdesks zuerst anlegen
        $helpdesks = $_POST['helpdesk'] ?? [];
        foreach ($helpdesks as $i => $h) {
            // Standard: Helpdesk 1 ist immer aktiv, sonst nur wenn Checkbox gesetzt
            $status = (!empty($h['aktiv']) || $i == 1) ? 'aktiv' : 'inaktiv';

            $stmt = $pdo->prepare("
                INSERT INTO helpdesks (helpdesk_name, helpdesk_email, helpdesk_telefon, customer_ID, helpdesk_ansprechpartner_id, aktiv)
                VALUES (?,?,?,?,?,?)
            ");
            $stmt->execute([
                $h['name'] ?? "Helpdesk $i",
                $h['email'] ?? '',
                $h['telefon'] ?? '',
                $customerId,
                null, // Ansprechpartner setzen wir später
                $status
            ]);

            $helpdeskIds[$i] = $pdo->lastInsertId();
            echo "📞 Helpdesk $i ID = {$helpdeskIds[$i]} ($status)\n";
        }

// 3) Users anlegen – nur aktive Helpdesks verknüpfen
$kontakte = $_POST['kontakte'] ?? [];
foreach ($kontakte as $typ => $k) {
    $helpdeskId = null; // Standard: NULL erlaubt (nach ALTER TABLE)

    if ($typ === 'tech' && isset($helpdeskIds[1]) && !empty($helpdesks[1]['aktiv'])) {
        $helpdeskId = $helpdeskIds[1];
    }
    elseif ($typ === 'kaufm' && isset($helpdeskIds[2]) && !empty($helpdesks[2]['aktiv'])) {
        $helpdeskId = $helpdeskIds[2];
    }

    if ($helpdeskId === null) {
        echo "⚠️ User $typ wird ohne Helpdesk gespeichert\n";
    }

    $stmt = $pdo->prepare("
        INSERT INTO users (vorname, nachname, anrede, email, telefon, rolle, funktion, notizen, aktiv, customer_ID, helpdesk_ID)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ");
    $stmt->execute([
        $k['vorname'] ?? '',
        $k['nachname'] ?? '',
        $k['anrede'] ?? 'Herr',
        $k['email'] ?? '',
        $k['telefon'] ?? null,
        $k['rolle'] ?? 'Kunde_user',
        $k['funktion'] ?? null,
        $k['notizen'] ?? null,
        !empty($k['aktiv']) ? 'aktiv' : 'inaktiv',
        $customerId,
        $helpdeskId   // hier darf jetzt wirklich NULL ankommen
    ]);

    $userIds[$typ] = $pdo->lastInsertId();
    echo "👤 User ($typ) ID = {$userIds[$typ]} (Helpdesk " . ($helpdeskId ?? 'NULL') . ")\n";
}


        // 4) Ansprechpartner in Helpdesks nachtragen
        if (isset($userIds['tech'], $helpdeskIds[1]) && !empty($helpdesks[1]['aktiv'])) {
            $stmt = $pdo->prepare("UPDATE helpdesks SET helpdesk_ansprechpartner_id=? WHERE helpdesk_ID=?");
            $stmt->execute([$userIds['tech'], $helpdeskIds[1]]);
            echo "🔗 Tech-User {$userIds['tech']} als Ansprechpartner für Helpdesk 1\n";
        }
        if (isset($userIds['kaufm'], $helpdeskIds[2]) && !empty($helpdesks[2]['aktiv'])) {
            $stmt = $pdo->prepare("UPDATE helpdesks SET helpdesk_ansprechpartner_id=? WHERE helpdesk_ID=?");
            $stmt->execute([$userIds['kaufm'], $helpdeskIds[2]]);
            echo "🔗 Kaufm. User {$userIds['kaufm']} als Ansprechpartner für Helpdesk 2\n";
        }

        $pdo->commit();
        echo "\n✅ Alles gespeichert!";
    } catch (Exception $e) {
        $pdo->rollBack();
        echo "❌ Fehler: " . $e->getMessage();
    }

    exit;
}
?>



<div id="modal-new-entry" class="modal">
  <div class="modal-content wide">
    <span class="modal-close">&times;</span>

    <form method="post" action="">
      <!-- KUNDE -->
      <fieldset class="two-cols">
        <legend>Kunde</legend>
        <div>
          <input type="text" name="customer[customer_name]" required placeholder="Kundenname">
          <label>Standort*</label>
          <select name="customer[standort]" required>
            <option value="Zentrale">Zentrale</option>
            <option value="Filiale">Filiale</option>
          </select>
          <input type="text" name="customer[land]" placeholder="Land">
          <input type="text" name="customer[plz]" placeholder="PLZ">
          <input type="text" name="customer[stadt]" placeholder="Stadt">
        </div>
        <div>
          <input type="text" name="customer[strasse]" placeholder="Straße">
          <input type="url" name="customer[doku_link]" placeholder="Doku-Link">
          <input type="text" name="customer[stdfehler1]" placeholder="StdFehler 1">
          <input type="text" name="customer[stdfehler2]" placeholder="StdFehler 2">
          <label><input type="checkbox" name="customer[aktiv]" checked> Aktiv</label>
        </div>
      </fieldset>

      <!-- HELPDESKS -->
      <fieldset>
        <legend>Helpdesks <small>(max. 3 pro Kunde)</small></legend>
        <div id="helpdesks-container"></div>
        <button type="button" id="add-helpdesk-btn">+ Helpdesk hinzufügen</button>
      </fieldset>

      <!-- KONTAKTE -->
      <fieldset class="two-cols">
        <legend>Kontakte</legend>

        <!-- Technischer Kontakt -->
        <div>
          <h4>Technischer Kontakt</h4>
          <label><input type="radio" name="kontakte[tech][anrede]" value="Herr"> Herr</label>
          <label><input type="radio" name="kontakte[tech][anrede]" value="Frau"> Frau</label>
          <input type="text" name="kontakte[tech][vorname]" placeholder="Vorname">
          <input type="text" name="kontakte[tech][nachname]" placeholder="Nachname">
          <input type="email" name="kontakte[tech][email]" placeholder="E-Mail">
          <input type="tel" name="kontakte[tech][telefon]" placeholder="Telefon">
          <select name="kontakte[tech][rolle]">
            <option value="Kunde_user">Kunden-User</option>
            <option value="Kunde_admin">Kunden-Admin</option>
            <option value="Agent">Agent</option>
            <option value="Admin">Admin</option>
          </select>
          <input type="text" name="kontakte[tech][funktion]" placeholder="Funktion (opt)">
          <textarea name="kontakte[tech][notizen]" placeholder="Notizen (opt)"></textarea>
        </div>

        <!-- Kaufmännischer Kontakt -->
        <div>
          <h4>Kaufmännischer Kontakt</h4>
          <label><input type="checkbox" id="same_as_tech"> Gleicher Kontakt wie Technischer</label>
          <div id="kaufm-fields">
            <label><input type="radio" name="kontakte[kaufm][anrede]" value="Herr"> Herr</label>
            <label><input type="radio" name="kontakte[kaufm][anrede]" value="Frau"> Frau</label>
            <input type="text" name="kontakte[kaufm][vorname]" placeholder="Vorname">
            <input type="text" name="kontakte[kaufm][nachname]" placeholder="Nachname">
            <input type="email" name="kontakte[kaufm][email]" placeholder="E-Mail">
            <input type="tel" name="kontakte[kaufm][telefon]" placeholder="Telefon">
            <select name="kontakte[kaufm][rolle]">
              <option value="Kunde_user">Kunden-User</option>
              <option value="Kunde_admin">Kunden-Admin</option>
              <option value="Agent">Agent</option>
              <option value="Admin">Admin</option>
            </select>
            <input type="text" name="kontakte[kaufm][funktion]" placeholder="Funktion (opt)">
            <textarea name="kontakte[kaufm][notizen]" placeholder="Notizen (opt)"></textarea>
          </div>
        </div>
      </fieldset>

      <div class="modal-footer">
        <button type="submit">Speichern</button>
        <button type="button" class="modal-close">Abbrechen</button>
      </div>
    </form>
  </div>
</div>


<!-- JS für Modal, Kontakte & Helpdesks -->
<script>
document.addEventListener("DOMContentLoaded", function() {
  // Modal öffnen/schließen
  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("modal-new-entry").style.display = "none";
    });
  });

  // Kaufmännischer Kontakt = Technischer Kontakt
  const sameAsTech = document.getElementById("same_as_tech");
  if (sameAsTech) {
    const kaufmFields = document.getElementById("kaufm-fields");
    sameAsTech.addEventListener("change", () => {
      if (sameAsTech.checked) {
        kaufmFields.style.display = "none";
        // Werte kopieren
        ["anrede","vorname","nachname","email","telefon","rolle","funktion","notizen"].forEach(f => {
          const tech = document.querySelector(`[name="kontakte[tech][${f}]"]`);
          const kaufm = document.querySelector(`[name="kontakte[kaufm][${f}]"]`);
          if (tech && kaufm) kaufm.value = tech.value;
        });
      } else {
        kaufmFields.style.display = "block";
      }
    });
  }

  // Dynamische Helpdesks
  const container = document.getElementById("helpdesks-container");
  const addBtn = document.getElementById("add-helpdesk-btn");
  let hdCount = 0;
  const maxHD = 3;

  function addHelpdeskBlock(prefill = null) {
    if (hdCount >= maxHD) return;
    hdCount++;

    const block = document.createElement("fieldset");
    block.className = "helpdesk-block two-cols";
    block.innerHTML = `
      <legend>Helpdesk ${hdCount}${hdCount>1 ? " (optional)" : ""}</legend>
      <div>
        <input type="text" name="helpdesk[${hdCount}][name]" placeholder="Helpdesk-Name">
        <input type="email" name="helpdesk[${hdCount}][email]" placeholder="E-Mail">
        <input type="text" name="helpdesk[${hdCount}][telefon]" placeholder="Telefonnummer">
      </div>

      <div>
        <label><input type="checkbox" name="helpdesk[${hdCount}][aktiv]" ${hdCount==1?"checked":""}> Aktiv</label>
      </div>

      <h5>Ansprechpartner</h5>
      <label><input type="checkbox" class="copy-tech" data-target="${hdCount}"> Gleicher wie Technischer</label>
      <label><input type="checkbox" class="copy-kaufm" data-target="${hdCount}"> Gleicher wie Kaufmännischer</label>

      <div class="ansprech-fields" id="ansprech-${hdCount}">
        <input type="text" name="helpdesk[${hdCount}][vorname]" placeholder="Vorname">
        <input type="text" name="helpdesk[${hdCount}][nachname]" placeholder="Nachname">
        <input type="email" name="helpdesk[${hdCount}][email_user]" placeholder="E-Mail">
        <input type="tel" name="helpdesk[${hdCount}][tel_user]" placeholder="Telefon">
      </div>
    `;
    container.appendChild(block);

    // Checkbox Logik: Ansprechpartner übernehmen
    block.querySelector(".copy-tech").addEventListener("change", e => {
      if (e.target.checked) {
        copyContact("tech", hdCount);
        block.querySelector(".copy-kaufm").checked = false;
      }
    });
    block.querySelector(".copy-kaufm").addEventListener("change", e => {
      if (e.target.checked) {
        copyContact("kaufm", hdCount);
        block.querySelector(".copy-tech").checked = false;
      }
    });

    // Prefill Daten (z. B. Debug)
    if (prefill) {
      Object.entries(prefill).forEach(([key, val]) => {
        const input = block.querySelector(`[name="helpdesk[${hdCount}][${key}]"]`);
        if (input) input.value = val;
      });
    }
  }

  function copyContact(source, targetId) {
    ["vorname","nachname","email","telefon"].forEach(f => {
      const src = document.querySelector(`[name="kontakte[${source}][${f}]"]`);
      const dest = document.querySelector(`[name="helpdesk[${targetId}][${f=="telefon"?"tel_user":f=="email"?"email_user":f}]"]`);
      if (src && dest) dest.value = src.value;
    });
  }

  if (addBtn) addBtn.addEventListener("click", () => addHelpdeskBlock());

  // Standard: 1 Helpdesk anzeigen
  addHelpdeskBlock();
});
</script>

<!-- DEBUG: Dummy-Daten -->
<script>
document.addEventListener("DOMContentLoaded", () => {
  if (location.search.includes("debug=1")) {
    console.log("👉 Debug-Modus aktiv: Testdaten werden gesetzt");

    // Kunde
    document.querySelector('[name="customer[customer_name]"]').value = "Muster GmbH";
    document.querySelector('[name="customer[standort]"]').value = "Zentrale";
    document.querySelector('[name="customer[land]"]').value = "Deutschland";
    document.querySelector('[name="customer[plz]"]').value = "10115";
    document.querySelector('[name="customer[stadt]"]').value = "Berlin";
    document.querySelector('[name="customer[strasse]"]').value = "Hauptstr. 12";
    document.querySelector('[name="customer[doku_link]"]').value = "https://intranet.muster.de/doku";
    document.querySelector('[name="customer[stdfehler1]"]').value = "Standard Fehler A";
    document.querySelector('[name="customer[stdfehler2]"]').value = "Standard Fehler B";
    document.querySelector('[name="customer[aktiv]"]').checked = true;

    // Technischer Kontakt
    document.querySelector('[name="kontakte[tech][anrede]"][value="Herr"]').checked = true;
    document.querySelector('[name="kontakte[tech][vorname]"]').value = "Hans";
    document.querySelector('[name="kontakte[tech][nachname]"]').value = "Meier";
    document.querySelector('[name="kontakte[tech][email]"]').value = "hans.meier@muster.de";
    document.querySelector('[name="kontakte[tech][telefon]"]').value = "+49 30 123456";

    // Kaufmännischer Kontakt
    document.querySelector('[name="kontakte[kaufm][anrede]"][value="Frau"]').checked = true;
    document.querySelector('[name="kontakte[kaufm][vorname]"]').value = "Eva";
    document.querySelector('[name="kontakte[kaufm][nachname]"]').value = "Schmidt";
    document.querySelector('[name="kontakte[kaufm][email]"]').value = "eva.schmidt@muster.de";
    document.querySelector('[name="kontakte[kaufm][telefon]"]').value = "+49 30 654321";

    // Helpdesks Debug: direkt 3 erzeugen
    const addBtn = document.getElementById("add-helpdesk-btn");
    if (addBtn) {
      addBtn.click(); // HD2
      addBtn.click(); // HD3
    }
    const hd1 = document.querySelector('[name="helpdesk[1][name]"]');
    if (hd1) hd1.value = "Helpdesk 1";
    const hd2 = document.querySelector('[name="helpdesk[2][name]"]');
    if (hd2) hd2.value = "Helpdesk 2";
    const hd3 = document.querySelector('[name="helpdesk[3][name]"]');
    if (hd3) hd3.value = "Helpdesk 3";
  }
});
</script>

