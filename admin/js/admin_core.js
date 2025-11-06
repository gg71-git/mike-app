// =======================================================
// admin_core.js – stabile zentrale Version
// =======================================================

import {
  lockTableExcept,
  unlockTable,
  unlockRow,
  getRowData,
  validateRow,
  wendeFokusAn
} from './admin_utils.js';

// Sicherstellen, dass applyDropdowns global verfügbar bleibt, auch bei Modulreihenfolge
if (typeof window.applyDropdowns === "undefined") {
  window.applyDropdowns = function () {};
}

// -------------------------------------------------------
// 🔧 Fallback für UIComponents
// -------------------------------------------------------
if (typeof window.UIComponents === "undefined") {
  window.UIComponents = {
    createActionButtons: (id = "") => `
      <div class="action-buttons">
        <button class="btn-copy" title="Kopieren">📄</button>
        <button class="btn-delete" title="Löschen">🗑️</button>
        <button class="btn-send" title="Senden">📨</button>
      </div>`
  };
  console.warn("⚠️ UIComponents war undefined – Fallback-Buttons werden verwendet.");
}

// -------------------------------------------------------
// Floating Confirm anzeigen (✅ / ✖)
// -------------------------------------------------------
export function showFloatingConfirm(cell) {
  removeFloatingConfirm();

  const fc = document.createElement("div");
  fc.id = "floating-confirm";
  fc.classList.add("floating-confirm");
  fc.innerHTML = `
    <button class="btn-okay confirm-btn">✅</button>
    <button class="btn-cancel cancel-btn">✖</button>
  `;
  document.body.appendChild(fc);

  // Positionierung
  setTimeout(() => {
    const td = cell.closest("td");
    if (!td) return;
    const rect = td.getBoundingClientRect();
    fc.style.top = `${rect.bottom + window.scrollY + 4}px`;
    fc.style.left = `${rect.left + window.scrollX}px`;
  }, 0);

  const row = cell.closest("tr");
  const okBtn = fc.querySelector(".btn-okay");
  const cancelBtn = fc.querySelector(".btn-cancel");

  okBtn.addEventListener("click", () => handleConfirmSave(row, cell, fc));
  cancelBtn.addEventListener("click", () => {
    const isNew = row.dataset.id === "neu";
    fc.remove();
    unlockTable();
    if (isNew) row.remove(); // 🧹 Abbrechen bei neuer Zeile
	location.reload();
  });
}

// -------------------------------------------------------
// Speichern / Update
// -------------------------------------------------------
async function handleConfirmSave(row, cell, fc) {
  const schema = window.currentSchema;
  if (!schema) return;

  const check = validateRow(row, schema);
  if (!check.ok) {
    alert("⚠️ Bitte alle Pflichtfelder befüllen!");
    return;
  }

  const data = getRowData(row, schema);
  const idField = schema.fields.find(f => f.primary)?.name || "id";
  const tableName = schema.table;
  const pkVal = row.dataset.id;
  const action = pkVal === "neu" ? "create" : "update";

  if (pkVal && pkVal !== "neu") data[idField] = pkVal;

	
  try {
    const response = await fetch("../../api/change.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, table: tableName, data })
    });

    const result = await response.json();
	  
    if (result.status === "duplicate") {
      alert(
        "⚠️ Duplikat erkannt!\n" +
        (result.dupeColumn
          ? `Das Feld "${result.dupeColumn}" ist bereits vergeben.`
          : "Ein Eintrag mit denselben Werten existiert bereits.")
      );
      return;
    }
	  
	  
    if (result.status === "error") {
      alert("❌ Fehler beim Speichern:\n" + (result.error || "Unbekannt"));
      return;
    }

    const newID = result?.[idField] || result?.id;
    if (newID) {
      row.dataset.id = newID;
      row.classList.add("highlight-import");
    }

// 🧩 Sicherstellen, dass auch das generische data-id existiert
const primaryField = schema.fields.find(f => f.primary)?.name;
if (primaryField && !row.dataset[primaryField]) {
  row.dataset[primaryField] = newID;
}
	  
	  
if (fc) fc.remove();
unlockTable();
wendeFokusAn();


if (result.status === "ok" || result.status === "success") {
  document.dispatchEvent(
    new CustomEvent("afterSave", { detail: { tableName, newID, data } })
  );
}


    if (window.currentSchema && typeof applyDropdowns === "function") {
      applyDropdowns(row, window.currentSchema);
    }

  } catch (err) {
    console.error("❌ Fehler beim Speichern:", err);
    alert("❌ Speichern fehlgeschlagen!");
  }
}

// -------------------------------------------------------
export function removeFloatingConfirm() {
  const fc = document.getElementById("floating-confirm");
  if (fc) fc.remove();
}

// -------------------------------------------------------
// Dropdown erstellen
// -------------------------------------------------------
export function createDropdown(fieldName, selectedValue, options, feldSchema = {}) {
  const select = document.createElement("select");
  select.name = fieldName;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Bitte wählen...";
  placeholder.disabled = true;
  if (!selectedValue) placeholder.selected = true;
  select.appendChild(placeholder);

  (options || []).forEach(opt => {
    const o = document.createElement("option");
    o.value = String(opt.id ?? "");
    o.textContent = opt.label ?? String(opt.id);
    if (String(o.value) === String(selectedValue)) o.selected = true;
    select.appendChild(o);
  });

  const typ = feldSchema?.new_entry_type || feldSchema?.dependency?.new_entry_type || null;
  if (typ) {
    const o = document.createElement("option");
    o.value = "__new__";
    o.textContent =
      typ === "user" ? "➕ Neuer Benutzer" :
      typ === "helpdesk" ? "➕ Neuer Helpdesk" :
      "➕ Neuer Eintrag";
    select.appendChild(o);
  }

  return select;
}

// -------------------------------------------------------
// Dropdowns anwenden (vollständige, ganzheitlich korrigierte Version)
// -------------------------------------------------------
export function applyDropdowns(row, schema) {
  if (!schema || !schema.fields) return;
  const rowData = getRowData(row, schema);

  schema.fields.forEach(feldSchema => {
    const fieldName = feldSchema.name;
    const cell = row.querySelector(`td[data-field="${fieldName}"]`);
    if (!cell) return;
    const currentValue = (cell.dataset.value || "").trim();

    const attach = (dropdown) => {
      dropdown.addEventListener("change", () => {
        if (dropdown.value === "__new__") {

          // 🧩 1️⃣ Kunden-Seite → zuerst speichern, dann Redirect zu Users
          if (schema.table === "customers" && row.dataset.id === "neu") {
            console.log("💾 Speichere neuen Kunden vor Redirect...");

            const onceAfterSave = (ev) => {
              const { tableName, newID } = ev.detail || {};
              if (tableName === "customers" && newID) {
                document.removeEventListener("afterSave", onceAfterSave);
                console.log("➡️ Redirect nach users.php mit ID:", newID);
                window.location.href = `users.php?customer_ID=${newID}&new=1`;
              }
            };
            document.addEventListener("afterSave", onceAfterSave, { once: true });

            handleConfirmSave(row, cell, null);
            return;
          }

          // 🧩 2️⃣ User-Seite → zuerst speichern, dann Redirect zu Helpdesks
          if (schema.table === "users" && row.dataset.id === "neu") {
            console.log("💾 Speichere neuen User vor Redirect...");

            const onceAfterSave = (ev) => {
              const { tableName, newID, data } = ev.detail || {};
              if (tableName === "users" && newID) {
                document.removeEventListener("afterSave", onceAfterSave);
                const customer_ID =
                  data?.customer_ID ||
                  new URLSearchParams(window.location.search).get("customer_ID") ||
                  "";
    console.log("➡️ Redirect nach helpdesks.php mit IDs:", { customer_ID, newID });
sessionStorage.setItem("wfStep", "helpdesks");   // <<< nächsten Schritt vorm Wechsel setzen
window.location.href = `helpdesks.php?customer_ID=${customer_ID}&user_ID=${newID}&new=1`;
          }
            };
            document.addEventListener("afterSave", onceAfterSave, { once: true });

            handleConfirmSave(row, cell, null);
            return;
          }

          // 🧩 Standardverhalten für alle anderen Tabellen
          const detail = {
            table: feldSchema?.dependency?.source || feldSchema?.source || schema.table,
            type: feldSchema?.new_entry_type || feldSchema?.dependency?.new_entry_type,
            customer_ID:
              rowData.customer_ID ||
              row.dataset.customer_ID ||
              new URLSearchParams(window.location.search).get("customer_ID") ||
              (schema.table === "customers" ? row.dataset.id : "")
          };
          document.dispatchEvent(new CustomEvent("newEntryRequested", { detail }));
          return;
        }

        // ✅ Normale Auswahl → Speichern aktivieren
        unlockRow(row);
        lockTableExcept(row);
        showFloatingConfirm(cell);
        cell.dataset.value = dropdown.value;
      });

      // Dropdown in Zelle einsetzen
      cell.innerHTML = "";
      cell.appendChild(dropdown);
    };

    // ---------------------------------------------------
    //  Statische Optionen vorhanden
    // ---------------------------------------------------
    if (feldSchema.options?.length) {
      attach(createDropdown(fieldName, currentValue, feldSchema.options, feldSchema));
      return;
    }

    // ---------------------------------------------------
    //  Dynamische Optionen via URL
    // ---------------------------------------------------
    if (feldSchema.options_url) {
      const query = new URLSearchParams();
      const urlParams = new URLSearchParams(window.location.search);

      // IDs aus Zeile oder URL übernehmen
      ["customer_ID", "user_ID", "helpdesk_ID"].forEach(k => {
        if (rowData[k]) query.set(k, rowData[k]);
        else if (urlParams.has(k) && !query.has(k)) query.set(k, urlParams.get(k));
      });

      // 🧩 Sicherstellen, dass Helpdesk-Dropdowns korrekt gefiltert werden
      if (schema.table === "helpdesks") {
        const cid = urlParams.get("customer_ID") || rowData.customer_ID || "";
        if (cid) query.set("customer_ID", cid);
      }

      // Sonderfall: Kunden-Tabelle
      if (schema.table === "customers" && row.dataset.id) {
        query.set("customer_ID", row.dataset.id);
      }

      query.set("field", `${schema.table}.${fieldName}`);
      const url = feldSchema.options_url + "&" + query.toString();

      fetch(url)
        .then(r => r.json())
        .then(opts => {
          // 🧩 Normalisierung der ID-Felder
          const pkName = feldSchema?.references?.split(".")[1] || "id";
          const normalized = opts.map(o => {
            const idVal = o.id ?? o[pkName];
            return {
              [pkName]: idVal,
              id: idVal, // Kompatibilität
              label: o.label ?? String(idVal)
            };
          });
          attach(createDropdown(fieldName, currentValue, normalized, feldSchema));
        })
        .catch(err => console.warn("❌ get_options fehlgeschlagen:", err));
    }
  });
}



// -------------------------------------------------------
// Neue Zeile hinzufügen
// -------------------------------------------------------
export function addNewEntryRow() {
  if (document.querySelector('tr[data-id="neu"]')) return;

  const tbody = document.querySelector("tbody");
  const newRow = document.createElement("tr");
  newRow.dataset.id = "neu";
  newRow.classList.add("row-new", "highlight-import");

  const feldNamen = window.__feldReihenfolge || [];
  newRow.innerHTML = `
    <td class="action-col">${UIComponents.createActionButtons("neu")}</td>
    ${feldNamen.map(f => `<td data-field="${f}" contenteditable="true"></td>`).join("")}
  `;

  tbody.prepend(newRow);
  applyDropdowns(newRow, window.currentSchema);
  bindRowActions(newRow);

  const firstEditable = newRow.querySelector("td[contenteditable], td select");
  if (firstEditable) {
    lockTableExcept(newRow);
    showFloatingConfirm(firstEditable);
    firstEditable.focus();
  }
  console.log("🆕 Neue Zeile angelegt.");
}

// -------------------------------------------------------
// Aktionsbuttons binden
// -------------------------------------------------------
export function bindRowActions(row) {
  const btnCopy = row.querySelector(".btn-copy");
  const btnDelete = row.querySelector(".btn-delete");
  const btnSend = row.querySelector(".btn-send, .btn-invite");

if (btnCopy)
  btnCopy.addEventListener("click", async () => {
    const clone = row.cloneNode(true);
    clone.dataset.id = "neu";
    clone.classList.add("row-duplicate", "highlight-import");

    // Alle Zellen aktivierbar machen
    clone.querySelectorAll("td[data-field]").forEach(td => {
      td.setAttribute("contenteditable", "true");
      td.classList.remove("locked");
      const sel = td.querySelector("select");
      if (sel) sel.disabled = false;
    });

    // Nach der Originalzeile einfügen
    row.after(clone);

    // 🧩 Dropdowns sauber neu binden (async safe)
    await new Promise(resolve => {
      applyDropdowns(clone, window.currentSchema);
      setTimeout(resolve, 300);
    });

    // Buttons neu aktivieren
    bindRowActions(clone);

    // 💡 Sofort Confirm anzeigen (damit handleConfirmSave aktiv wird)
    const firstEditable = clone.querySelector("td[contenteditable], td select");
    if (firstEditable) {
      lockTableExcept(clone);
      showFloatingConfirm(firstEditable);
    }

    console.log("📋 Zeile kopiert:", row.dataset.id);
  });


if (btnDelete)
  btnDelete.addEventListener("click", async () => {
    const schema = window.currentSchema;
    if (!schema) return;

    // Primärfeldname aus Schema
const idField = schema.fields.find(f => f.primary)?.name || "id";
const id =
  row.dataset.id ||
  row.dataset[idField] ||
  row.getAttribute("data-id") ||
  row.getAttribute("data-" + idField);

if (!id || id === "neu") {
  alert("❌ Kein gültiger Primärschlüssel in dieser Zeile gefunden!");
  return;
}


    if (!confirm("❗ Soll dieser Eintrag wirklich gelöscht werden?")) return;

    try {
const res = await fetch("../../api/change.php", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "delete",
    table: schema.table,
    data: { [idField]: id } // <-- verschachtelt!
  })
});

      const result = await res.json();

      if (result.status === "success" || result.status === "ok") {
        row.remove();
		location.reload();  
		alert("✅ Datensatz gelöscht:", id);
      } else if (result.status === "error" && result.error?.includes("1451")) {
        alert("❌ Der Datensatz kann nicht gelöscht werden, weil noch abhängige Einträge existieren.");
      } else {
        alert("❌ Löschen fehlgeschlagen:\n" + (result.error || "Unbekannt"));
      }
    } catch (err) {
      console.error("❌ Fehler beim Löschen:", err);
      alert("❌ Löschen fehlgeschlagen (Netzwerkfehler).");
    }
  });


if (btnSend)
  btnSend.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const userId = btn.dataset.id || row.dataset.id;
  if (!userId || userId === "neu") {
    alert("❌ Kein gültiger Benutzer gewählt!");
    return;
  }

  if (!confirm("📨 Einladung / Zugangscode wirklich senden?")) return;

  try {
    const res = await fetch("../../api/user_send_code.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_ID: userId })   // 👈 hier der Unterschied!
    });

    const result = await res.json();

    if (result.status === "OK") {
      alert("✅ Einladung erfolgreich versendet!");
    } else {
      alert("❌ Versand fehlgeschlagen:\n" + (result.error || "Unbekannt"));
    }
  } catch (err) {
    console.error("Invite-Fehler:", err);
    alert("❌ Netzwerkfehler beim Versenden.");
  }
});

}

// -------------------------------------------------------
// Globaler "+"-Button
// -------------------------------------------------------
export function bindGlobalNewButton() {
  const btn = document.getElementById("btn-global-new");
  if (btn) btn.addEventListener("click", () => addNewEntryRow());
}

// -------------------------------------------------------
// Confirm auch bei Textänderungen
// -------------------------------------------------------
document.addEventListener("input", e => {
  const cell = e.target.closest("td[contenteditable='true']");
  if (cell) showFloatingConfirm(cell);
});

// -------------------------------------------------------
// Bestehende Zeilen binden
// -------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("tbody tr[data-id]").forEach(bindRowActions);
});

// -------------------------------------------------------
// Globale Bereitstellung, damit andere Module (z.B. admin_new.js)
// und handleConfirmSave Zugriff haben
// -------------------------------------------------------
window.applyDropdowns = applyDropdowns;