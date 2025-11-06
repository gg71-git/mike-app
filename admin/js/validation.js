function validateRow(row, markFehler = true) {
    const errors = [];

    if (!window.schema || !Array.isArray(window.schema)) {
        console.warn("⚠️ Kein Schema geladen, Validation übersprungen!");
        return errors;
    }

    // Alle sichtbaren Felder des Schemas durchgehen
    window.schema
      .filter(f => !f.hidden) // versteckte Felder ignorieren
      .forEach(field => {
        const name = field.name;
        const required = field.required;
        const options = optionsData[name] || field.options || [];
        const val = getCellValue(row, name);

        // Pflichtfeldprüfung
        if (required) {
            const istLeer =
                val === null ||
                typeof val === "undefined" ||
                (typeof val === "string" && val.trim() === "");
            if (istLeer) {
                errors.push(name);
                if (markFehler) markZelle(row, name, "❗ Pflichtfeld fehlt");
                return;
            }
        }

        // Options-/ENUM-Validierung
        if (options && options.length > 0 && val !== null && val !== "") {
            const validValues = options.map(o =>
                typeof o === "object" ? String(o.id).trim() : String(o).trim()
            );
            if (!validValues.includes(String(val).trim())) {
                errors.push(name);
                if (markFehler) markZelle(row, name, "❌ nicht zulässig");
                return;
            }
        }

        // Unique-Prüfung für Felder mit unique=true
        if (field.unique && val) {
            if (isDuplicateValue(row, name, val)) {
                errors.push(name);
                if (markFehler) markZelle(row, name, "⚠️ muss eindeutig sein");
                return;
            }
        }
    });

    return errors;
}

// Hilfsfunktion: Wert aus Tabellenzelle holen
function getCellValue(row, fieldName) {
    const index = getFieldIndex(fieldName);
    if (index === -1) return null;
    const cell = row.querySelectorAll("td")[index];
    if (!cell) return null;

    const select = cell.querySelector("select");
    return select ? select.value : cell.innerText.trim();
}

// Unique-Check generisch (nicht nur Email)
function isDuplicateValue(row, fieldName, candidate) {
    const index = getFieldIndex(fieldName);
    if (index === -1) return false;
    const rows = Array.from(document.querySelectorAll("tr[data-id]"));

    return rows
      .filter(r => r !== row)
      .some(r => {
        const cell = r.querySelectorAll("td")[index];
        if (!cell) return false;
        const sel = cell.querySelector("select");
        const v = sel ? sel.value : cell.innerText.trim();
        return v.toLowerCase() === String(candidate).toLowerCase();
      });
}

// Rest bleibt wie gehabt
window.validateRow = validateRow;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function markZelle(row, feldname, tooltip = "") {
  const index = getFieldIndex(feldname);
  if (index === -1) return;
  const cell = row.querySelectorAll("td")[index];
  if (!cell) return;

  cell.classList.add("fehler");
  if (tooltip) cell.title = tooltip;
}

function setFeldReihenfolge(reihenfolge = []) {
  window.__feldReihenfolge = reihenfolge;
}

function getFieldIndex(feldname) {
  const felder = window.__feldReihenfolge || [];
  return felder.indexOf(feldname);
}
