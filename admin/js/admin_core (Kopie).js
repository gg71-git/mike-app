// =======================================================
// admin_core.js – Kernfunktionen für CRUD & UI-Interaktion
// =======================================================

import { 
  lockTableExcept,
  placeFloatingConfirm,
  removeFloatingConfirm,
  getRowData,
  unlockTable,
  unlockRow,
  validateRow
} from './admin_utils.js';

// -------------------------------------------------------
// Floating Confirm anzeigen
// -------------------------------------------------------
// Floating Confirm anzeigen
export function showFloatingConfirm(cell) {
  removeFloatingConfirm();
  console.log("🚩 showFloatingConfirm aufgerufen für:", cell);

  const fc = document.createElement("div");
  fc.id = "floating-confirm";
  fc.classList.add("floating-confirm");
  fc.innerHTML = `
    <button class="btn-okay confirm-btn">✅</button>
    <button class="btn-cancel cancel-btn">✖</button>
  `;
  document.body.appendChild(fc);

  // Positionieren
  setTimeout(() => {
    const td = cell.closest("td") || cell;
    placeFloatingConfirm(td, fc);
  }, 0);

  const row = cell.closest("tr");
  const okBtn = fc.querySelector(".btn-okay");
  const cancelBtn = fc.querySelector(".btn-cancel");

  // ✅ Übernehmen
  okBtn.addEventListener("click", () => {
    console.log("✅ Übernehmen geklickt");
    const activeSchema = window.currentSchema;

    // ✅ Pflichtfelder prüfen
    const check = validateRow(row, activeSchema);
    if (!check.ok) {
      if (check.type === "required") {
        alert("Bitte alle Pflichtfelder befüllen!");
      } else if (check.type === "email") {
        alert(`Bitte eine gültige E-Mail-Adresse im Feld "${check.field}" eingeben!`);
      } else if (check.type === "phone") {
        alert(`Bitte eine gültige Telefonnummer im Feld "${check.field}" eingeben!\n\nErlaubte Zeichen: ␣ + - / 0-9`);
      }
      return; // Abbruch
    }

    const data = getRowData(row, activeSchema);

    // PK-Feld bestimmen
    const idField = activeSchema.fields.find(f => f.primary)?.name
                 || activeSchema.fields.find(f => f.unique)?.name
                 || "id";

    // Tabellenname bestimmen
    let tableName = activeSchema.table;
    if (window.location.pathname.includes("import.php")) {
      tableName = "tmp_import";
    }

    const pkVal = row.dataset.id || row.getAttribute("data-" + idField);
    const action = (pkVal === "neu") ? "create" : "update";

    if (idField && pkVal && pkVal !== "neu") {
      data[idField] = pkVal;
    }

    console.log("📡 Starte fetch → ../../api/change.php", { action, tableName, data });

    fetch("../../api/change.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, table: tableName, data })
    })
    .then(r => r.json())
    .then(result => {
      console.log("📩 Antwort von change.php:", result);

      if (result.status === "error") {
        alert("❌ Fehler beim Speichern:\n" + (result.error || "Unbekannt"));
        return;
      }

      const newID = result?.[idField] || result?.id;
      console.log("➡️ Block betreten, newID:", newID, "idField:", idField);

      if (newID) {
        row.dataset.id = newID;  // immer übernehmen

        // Highlight-Array aktualisieren
        let hl = JSON.parse(localStorage.getItem("highlightIDs") || "[]");
        if (!hl.includes(newID)) hl.push(newID);
        localStorage.setItem("highlightIDs", JSON.stringify(hl));

        console.log("✅ highlightIDs aktualisiert:", hl);
      } else {
        console.warn("⚠️ Keine newID gefunden in result:", result);
      }

      row.classList.remove("new-entry-row");
      row.dataset.bearbeitet = "true";

      fc.remove();
      unlockTable();

      // Fokus-Handling
      const editables = Array.from(row.querySelectorAll("td[contenteditable], td select"));
      const cellIndex = Array.from(row.children).indexOf(cell);
      if (!window.location.pathname.includes("import.php")) {
        localStorage.setItem("focusID", row.dataset.id);
        localStorage.setItem("focusCellIndex", cellIndex >= 0 ? cellIndex : 0);
      }

      const parentTd = cell.closest("td");
      if (parentTd) {
        parentTd.focus({ preventScroll: true });
      }

      setTimeout(() => location.reload(), 200);
    })
    .catch(err => {
      console.error("❌ Fehler beim Speichern:", err);
      alert("❌ Speichern fehlgeschlagen!");
    });
  });

  // ❌ Abbrechen
  cancelBtn.addEventListener("click", () => {
    console.log("❌ Abbrechen geklickt");
    removeFloatingConfirm();
    unlockTable();

    const editables = Array.from(row.querySelectorAll("td[contenteditable], td select"));
    const cellIndex = Array.from(row.children).indexOf(cell);
    localStorage.setItem("focusID", row.dataset.id);
    localStorage.setItem("focusCellIndex", cellIndex >= 0 ? cellIndex : 0);

    if (!window.location.pathname.includes("import.php")) {
      localStorage.setItem("focusID", row.dataset.id);
      localStorage.setItem("focusCellIndex", cellIndex >= 0 ? cellIndex : 0);
    }

    location.reload();
  });
}


// -------------------------------------------------------
// Input- & Blur-Listener
export function bindInputListener(cell) {
  cell.addEventListener("keydown", (e) => {
    const triggerKeys = ["Backspace", "Delete"];

    if ((e.key.length === 1 || triggerKeys.includes(e.key)) && !document.getElementById("floating-confirm")) {
      const row = cell.closest("tr");
      lockTableExcept(row);
      showFloatingConfirm(row);
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const btnOk = document.querySelector("#floating-confirm .btn-okay");
      if (btnOk) btnOk.click();
    }

    if (e.key === "Escape") {
      e.preventDefault();
      const btnCancel = document.querySelector("#floating-confirm .btn-cancel");
      if (btnCancel) btnCancel.click();
    }
  });

  cell.addEventListener("input", () => {
    cell.dataset.changed = "true";
    cell.classList.add("unsaved");

    // --------------------------------------
    // Sonderfall: Wenn sich customer_ID ändert → Helpdesk-Dropdown neu laden
    // --------------------------------------
    const row = cell.closest("tr");
    const fieldName = row.closest("table").querySelectorAll("th")[cell.cellIndex]?.dataset.field;

    if (fieldName === "customer_ID") {
      const customerId = cell.innerText.trim();
      if (customerId) {
        fetch(`../api/get_schema.php?table=helpdesks&filter_customer=${customerId}`)
          .then(r => r.json())
          .then(schemaHelpdesk => {
            const hdField = schemaHelpdesk.fields.find(f => f.name === "helpdesk_ID");
            if (hdField && hdField.options) {
              const hdCell = row.querySelector('[data-field="helpdesk_ID"]');
              if (hdCell) {
                let select = hdCell.querySelector("select");
                if (!select) {
                  select = document.createElement("select");
                  hdCell.innerHTML = "";
                  hdCell.appendChild(select);
                }
                select.innerHTML = "";
                hdField.options.forEach(opt => {
                  const o = document.createElement("option");
                  o.value = opt.id;
                  o.textContent = opt.label;
                  select.appendChild(o);
                });
              }
            }
          });
      }
    }
  });
}


export function bindBlurListener(cell) {
  cell.addEventListener("blur", () => {
    // absichtlich leer – Confirm nur über KeyDown
  });
}

// -------------------------------------------------------
// Row Actions: Copy / Delete / CodeSend
export function bindRowActions(row) {
  const copyBtn = row.querySelector(".btn-copy");
  const delBtn  = row.querySelector(".btn-delete");
  const codeBtn = row.querySelector(".btn-code");

  // --- COPY ---
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      if (document.querySelector('tr[data-id="neu"]')) return;

      const clone = row.cloneNode(true);
      clone.dataset.id = "neu";
      clone.classList.add("new-entry-row");

      const firstEditable = [...clone.cells].find(td =>
        td.getAttribute("contenteditable") === "true" || td.querySelector("select")
      );

      if (firstEditable) {
        if (firstEditable.querySelector("select")) {
          const sel = firstEditable.querySelector("select");
          sel.options[sel.selectedIndex].textContent += " – Kopie";
        } else {
          firstEditable.textContent += " – Kopie";
        }
        firstEditable.style.color = "red";
        firstEditable.style.fontStyle = "italic";
        firstEditable.classList.add("unsaved");

        lockTableExcept(firstEditable);
        showFloatingConfirm(firstEditable);
      }

      row.parentNode.insertBefore(clone, row.nextSibling);
      bindRowActions(clone);
      applyDropdowns(clone);

      clone.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }


// --- DELETE ---
if (delBtn) {
  delBtn.addEventListener("click", () => {
    const activeSchema = window.currentSchema;
    const idField = activeSchema.fields.find(f => f.primary)?.name
                 || activeSchema.fields.find(f => f.unique)?.name
                 || "id";
    const tableName = activeSchema.table;

    if (!row.dataset.id || row.dataset.id === "neu") {
      row.remove();
      return;
    }

    const sicher = confirm(`❗ Diesen Eintrag wirklich löschen?\n(${idField} = ${row.dataset.id})`);
    if (!sicher) return;

    const action = "delete";
    const data = { [idField]: row.dataset.id };

    fetch("../../api/change.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, table: tableName, data })
    })
      .then(r => r.json())
      .then(result => {
        if (result.status && result.status.toLowerCase() === "ok") {
          row.remove();
          console.log(`🗑️ ${tableName} mit ${idField}=${row.dataset.id} gelöscht`);
		  location.reload();
        } else {
          alert("❌ Löschen fehlgeschlagen: " + (result.error || "Unbekannt"));
        }
      })
      .catch(err => {
        console.error("❌ Fehler beim Löschen:", err);
        alert("❌ Fehler beim Löschen");
      });
  });
}



  // --- CODE SEND ---
  if (codeBtn) {
    codeBtn.addEventListener("click", () => {
      const userID = row.dataset.id;
      if (!userID || userID === "neu") {
        alert("❗ Kein gültiger Benutzer ausgewählt.");
        return;
      }

      codeBtn.classList.add("loading");

		fetch("../../api/user_send_code.php", {
		  method: "POST",
		  headers: { "Content-Type": "application/json" },
		  body: JSON.stringify({ user_ID: userID })
		})

        .then(r => r.json())
		.then(data => {
		  codeBtn.classList.remove("loading");
		  if (data.status === "OK") {
			// Status setzen
			codeBtn.classList.remove("offen", "gesendet", "eingeloggt");
			codeBtn.classList.add("gesendet");
			row.dataset.status = "gesendet";

			alert("📧 Email wurde gesendet.");
		  } else {
			alert("Fehler beim Code-Versand: " + (data.error || "Unbekannt"));
		  }
		})

        .catch(err => {
          codeBtn.classList.remove("loading");
          alert("Verbindungsfehler beim Code-Versand.");
          console.error(err);
        });
    });
  }
}

// -------------------------------------------------------
// Neue Zeile hinzufügen
export function addNewEntryRow() {
  if (document.querySelector('tr[data-id="neu"]')) return;

  const tbody = document.querySelector("tbody");
  const newRow = document.createElement("tr");
  newRow.dataset.id = "neu";
  newRow.classList.add("new-entry-row");

  newRow.innerHTML = `
    <td class="action-col">${UIComponents.createActionButtons("neu")}</td>
    ${window.__feldReihenfolge.map(() => `<td contenteditable="true"></td>`).join("")}
  `;

  tbody.prepend(newRow);
  bindRowActions(newRow);
  applyDropdowns(newRow, window.currentSchema);

  const firstEditable = newRow.querySelector("td[contenteditable], td select");
  if (firstEditable) {
    firstEditable.focus();
    if (firstEditable.tagName !== "SELECT") {
      const range = document.createRange();
      range.selectNodeContents(firstEditable);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  showFloatingConfirm(firstEditable || newRow);
}


// -------------------------------------------------------
// Dropdowns
export function createDropdown(fieldName, selectedValue, options, feldSchema = {}) {
  const select = document.createElement("select");
  select.name = fieldName;

  // Placeholder
  if (!selectedValue) {
    const bitteWaehlen = document.createElement("option");
    bitteWaehlen.value = "";
    bitteWaehlen.textContent = "Bitte wählen...";
    bitteWaehlen.disabled = true;
    bitteWaehlen.selected = true;
    select.appendChild(bitteWaehlen);
  }

  // Vorhandene Optionen
  (options || []).forEach(opt => {
    const option = document.createElement("option");
    option.value = String(opt.id ?? "");
    option.textContent = opt.label ?? String(opt.id ?? "---"); // ✅ Label bevorzugt

    if (
      String(option.value) === String(selectedValue) ||
      String(option.textContent) === String(selectedValue)
    ) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  // ➕ Neuer Eintrag, falls im Schema definiert
  const newEntryType =
    feldSchema?.new_entry_type ||
    feldSchema?.dependency?.new_entry_type ||
    null;

  if (newEntryType) {
    const opt = document.createElement("option");
    opt.value = "__new__";
    opt.textContent =
      newEntryType === "user"     ? "➕ Neuer Benutzer" :
      newEntryType === "helpdesk" ? "➕ Neuer Helpdesk" :
                                    "➕ Neuer Eintrag";
    select.appendChild(opt);
  }

  return select;
}





// -------------------------------------------------------
// Dropdowns anwenden
export function applyDropdowns(row, schema) {
  window.__feldReihenfolge.forEach((feldName, idx) => {
    const feldSchema = schema.fields.find(f => f.name === feldName);
    if (!feldSchema) return;

    const cell = row.cells[idx + 1];
    if (!cell) return;

    let currentValue = (cell.getAttribute("data-value") || "").trim();

    function attachDropdown(dropdown) {
      dropdown.addEventListener("focus", (e) => {
        if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
        setTimeout(() => {
          try {
            dropdown.click();
          } catch (err) {
            console.warn("Dropdown konnte nicht automatisch geöffnet werden:", err);
          }
        }, 0);
      });

      dropdown.addEventListener("change", () => {
        unlockRow(row);
        if (!document.getElementById("floating-confirm")) {
          lockTableExcept(cell);
          showFloatingConfirm(cell);
        }
        dropdown.classList.add("unsaved");
        cell.setAttribute("data-value", dropdown.value);
      });

      cell.innerHTML = "";
      cell.appendChild(dropdown);
      cell.removeAttribute("contenteditable");
      cell.style.pointerEvents = "auto";
      cell.style.userSelect = "auto";
    }

    // 1. Statische Optionen (aus Schema)
    if (feldSchema.options && feldSchema.options.length > 0) {
      const dropdown = createDropdown(feldName, currentValue, feldSchema.options, feldSchema);
      attachDropdown(dropdown);
    }
    // 2. Dynamische Optionen (aus get_options.php)
else if (feldSchema.options_url) {
  const rowData = getRowData(row, schema);

  // ➕ Wenn wir in der Tabelle "customers" sind, ID der Zeile mitgeben
  if (schema.table === "customers" && row.dataset.id) {
    rowData.id = row.dataset.id;
  }

  const url = feldSchema.options_url + "&" + new URLSearchParams(rowData).toString();

  fetch(url)
    .then(r => r.json())
    .then(options => {
      const dropdown = createDropdown(feldName, currentValue, feldSchema.options, feldSchema);

      // Ungültige Werte markieren
      const match = options.some(opt =>
        String(opt.id) === currentValue || String(opt.label) === currentValue
      );
      if (!match && currentValue !== "") {
        const opt = document.createElement("option");
        opt.value = currentValue;
        opt.textContent = `${currentValue} (ungültig)`;
        opt.classList.add("invalid-option");
        dropdown.appendChild(opt);
        dropdown.value = currentValue;
        cell.classList.add("invalid-cell");
      }

      attachDropdown(dropdown);
    })
    .catch(err => console.error("❌ Fehler beim Laden von Optionen:", err));
}

  });
}


// -------------------------------------------------------
// Import-Commit: pro Zeile create, IDs für Highlight merken
// -------------------------------------------------------
export async function commitImport(tableName) {
  const rows = document.querySelectorAll("tbody tr[data-id]");
  const results = [];

  for (const row of rows) {
    const rowData = getRowData(row, window.currentSchema);
    console.log("📤 Sende Import-Zeile:", rowData);

    try {
      const resp = await fetch("../../api/change.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          table: tableName,
          data: rowData
        })
      });

      const result = await resp.json();
      console.log("📥 Antwort:", result);

if (result.status === "duplicate") {
  const dupeCol = result.dupeColumn;
  const dupeVal = dupeCol && result.data ? String(result.data[dupeCol]) : null;

  if (dupeCol && dupeVal) {
    const headerIdx = window.__feldReihenfolge.indexOf(dupeCol);
    if (headerIdx !== -1) {
      document.querySelectorAll("tbody tr[data-id]").forEach(tr => {
        const td = tr.cells[headerIdx + 1]; // +1 wegen Action-Spalte
        if (!td) return;

        const cellVal = td.getAttribute("data-value") || td.textContent.trim();
        if (String(cellVal) === dupeVal) {
          tr.classList.add("row-error", "row-duplicate");
        }
      });
    }
    alert(`❌ Wert in Spalte ${dupeCol} bereits in Zieltabelle vorhanden!`);
  } else {
    alert("❌ Duplikat gefunden, bitte bereinigen!");
  }

  return; // Abbruch Import
}


      results.push(result);

      if (result.status === "ok" && result.id) {
        let hl = JSON.parse(localStorage.getItem("highlightIDs") || "[]");
        if (!hl.includes(result.id)) hl.push(result.id);
        localStorage.setItem("highlightIDs", JSON.stringify(hl));
      } else {
        row.classList.add("row-error");
      }
    } catch (err) {
      console.error("❌ Commit-Fehler bei Zeile:", err);
      row.classList.add("row-error");
    }
  }

  if (results.every(r => r.status === "ok")) {
    alert("✅ Alle Zeilen erfolgreich übernommen!");
    window.location.href = tableName + ".php";
  }
}



// -------------------------------------------------------
// New-Button
export function bindGlobalNewButton() {
  const btn = document.getElementById("btn-global-new");
  if (!btn) return;
  btn.addEventListener("click", () => addNewEntryRow());
}



// -------------------------------------------------------
// Globale Key-Events (ESC + ALT+Pfeile)
document.addEventListener("keydown", (e) => {
  const fc = document.getElementById("floating-confirm");

  if (e.key === "Escape" && fc) {
    fc.remove();
    e.preventDefault();
    location.reload();
    return;
  }

  // Ausnahme: Browser-Standard für Select öffnen (Alt+↓)
  if (e.target.tagName === "SELECT" && e.altKey && e.key === "ArrowDown") {
    return; // nichts verhindern → Browser öffnet Dropdown
  }

  // ⚠️ Ausnahme: Wenn Fokus im Select und KEIN Alt gedrückt → Default Verhalten
  if (e.target.tagName === "SELECT" && !e.altKey && ["ArrowUp","ArrowDown"].includes(e.key)) {
    return; // Browser-Standard: Auswahl im Dropdown
  }

  // Nur ALT+Pfeile für Tabellennavigation
  if (!e.altKey || !["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) return;
  e.preventDefault();

  const active = document.activeElement;
  const td = active?.tagName === "TD" ? active : active?.closest("td");
  if (!td) return;

  const tr = td.closest("tr");
  if (!tr) return;

  const rows = Array.from(tr.parentNode.querySelectorAll("tr"));
  const rowIndex = rows.indexOf(tr);
  const cells = Array.from(tr.querySelectorAll("td"));
  const colIndex = cells.indexOf(td);

  let target = null;
  if (["ArrowUp","ArrowDown"].includes(e.key)) {
    const newRow = (e.key === "ArrowUp") ? rows[rowIndex - 1] : rows[rowIndex + 1];
    if (newRow) target = newRow.children[colIndex] || null;
  }
  if (["ArrowLeft","ArrowRight"].includes(e.key)) {
    const newColIndex = (e.key === "ArrowLeft") ? colIndex - 1 : colIndex + 1;
    target = tr.children[newColIndex] || null;
  }

  if (target) {
    target.focus({ preventScroll: true });

    if (target.hasAttribute("contenteditable")) {
      setTimeout(() => {
        const range = document.createRange();
        range.selectNodeContents(target);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }, 0);
    }

    const row = target.closest("tr");
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
});


// -------------------------------------------------------
// Status Send Code Btn
function setzeStatus(btn, status) {
  const row = btn.closest("tr");
  if (!row) return;

  row.dataset.status = status;
  row.classList.remove("status-offen", "status-gesendet", "status-eingeloggt");

  switch (status) {
    case "gesendet":
      row.classList.add("status-gesendet");
      break;
    case "eingeloggt":
      row.classList.add("status-eingeloggt");
      break;
    default:
      row.classList.add("status-offen");
  }
}


