// =======================================================
// admin_utils.js – FIXED VERSION
// =======================================================
// FIXES:
// ✅ Alt+Pfeiltasten Navigation funktioniert wieder
// ✅ Grüne Markierungen bleiben beim Zurückkehren erhalten
// =======================================================

// -------------------------------------------------------
// IDs vereinheitlichen
// -------------------------------------------------------
export function getNormalizedIDs(row) {
  return {
    customer_ID: row.dataset.customer_id || row.getAttribute("data-customer_ID") || row.dataset.id || "",
    user_ID:     row.dataset.user_id     || row.getAttribute("data-user_ID")     || "",
    helpdesk_ID: row.dataset.helpdesk_id || row.getAttribute("data-helpdesk_ID") || ""
  };
}

// -------------------------------------------------------
// Zentrale ID-Logik für Dropdown-Filter
// -------------------------------------------------------
export function getFilterIDsForTable(schema, row) {
  const norm = getNormalizedIDs(row);
  const urlParams = new URLSearchParams(window.location.search);
  const out = {};

  const pick = (...vals) => {
    for (const v of vals) {
      if (v && v !== "neu" && v !== "undefined") return v;
    }
    return null;
  };

  switch (schema.table) {
    case "customers":
      break;

    case "users":
      out.customer_ID = pick(
        row.getAttribute("data-customer_ID"),
        norm.customer_ID,
        urlParams.get("customer_ID")
      );
      break;

    case "helpdesks":
      out.customer_ID = pick(
        row.getAttribute("data-customer_ID"),
        norm.customer_ID,
        urlParams.get("customer_ID")
      );
      out.user_ID = pick(
        row.getAttribute("data-user_ID"),
        norm.user_ID,
        urlParams.get("user_ID")
      );
      if (!out.customer_ID) return {};
      break;

    default:
      ["customer_ID", "user_ID", "helpdesk_ID"].forEach(k => {
        out[k] = pick(
          row.getAttribute(`data-${k}`),
          norm[k],
          urlParams.get(k)
        );
      });
  }

  Object.keys(out).forEach(k => {
    if (!out[k]) delete out[k];
  });

  return out;
}

// -------------------------------------------------------
// Schema laden
// -------------------------------------------------------
export async function ladeSchema(tableName) {
  try {
    const url = `../../api/get_schema.php?table=${tableName}`;
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = JSON.parse(text);
    if (!json || !json.fields) throw new Error("Ungültiges Schema-Format");
    console.log("✅ Schema erfolgreich geladen:", json);

    window.currentSchema = json;
    document.dispatchEvent(new Event("schemaLoaded"));
    return json;
  } catch (err) {
    console.error("❌ Schema konnte nicht geladen werden:", err);
    alert("Schema konnte nicht geladen werden. Bitte später erneut versuchen.");
    return null;
  }
}

// -------------------------------------------------------
// Hilfsfunktion: Feldposition ermitteln
// -------------------------------------------------------
function getCellForField(row, fieldName) {
  const idx = window.__feldReihenfolge.indexOf(fieldName);
  if (idx === -1) return null;
  return row.cells[idx + 1] || null;
}

// -------------------------------------------------------
// Zeilendaten sammeln
// -------------------------------------------------------
export function getRowData(row, schema) {
  const data = {};
  const params = new URLSearchParams(window.location.search);
  const isNewMode = params.get("new") === "1";

  schema.fields.forEach(feldSchema => {
    const fieldName = feldSchema.name;
    const cell = getCellForField(row, fieldName);
    if (!cell) return;

    let value = null;
    const input = cell.querySelector("select, input, textarea");

    if (input) {
      if (input.tagName === "SELECT") {
        value = input.value;
        if (value === "__new__") value = null;
      } else {
        value = input.value;
      }
    } else if (cell.isContentEditable) {
      value = cell.textContent.trim();
    } else {
      value = cell.getAttribute("data-value") || cell.textContent.trim();
    }

    if (fieldName === "aktiv") {
      if (schema.table === "customers" && isNewMode) return;
      else value = "inaktiv";
    }

    if ((value === "" || value === null) && feldSchema.type && feldSchema.type.includes("int")) {
      value = null;
    }

    data[fieldName] = value;
  });

  return data;
}

// -------------------------------------------------------
// Tabellen-Sperrung / Entsperrung
// -------------------------------------------------------
export function lockTableExcept(active) {
  document.querySelectorAll("tbody td").forEach(td => {
    const isSameCell = td === active;
    const isSameRow = active instanceof HTMLTableRowElement && td.closest("tr") === active;

    if (!isSameCell && !isSameRow) {
      td.setAttribute("contenteditable", "false");
      td.classList.add("locked");
      const sel = td.querySelector("select");
      if (sel) sel.disabled = true;
    }
  });
}

export function unlockTable() {
  document.querySelectorAll("tbody td.locked").forEach(td => {
    td.setAttribute("contenteditable", "true");
    td.classList.remove("locked");
    const sel = td.querySelector("select");
    if (sel) sel.disabled = false;
  });
}

export function unlockRow(row) {
  [...row.cells].forEach(cell => {
    if (!cell.classList.contains("action-col")) {
      cell.setAttribute("contenteditable", "true");
      cell.style.pointerEvents = "auto";
      cell.style.userSelect = "auto";
    }
  });
}

// -------------------------------------------------------
// Floating Confirm entfernen
// -------------------------------------------------------
export function removeFloatingConfirm() {
  const fc = document.getElementById("floating-confirm");
  if (fc) fc.remove();
}

// -------------------------------------------------------
// Pflichtfelder prüfen
// -------------------------------------------------------
export function validateRow(row, schema) {
  const data = getRowData(row, schema);

  function getCellForField(row, fieldName) {
    const idx = window.__feldReihenfolge.indexOf(fieldName);
    if (idx === -1) return null;
    return row.cells[idx + 1] || null;
  }

  const fehlende = [];

  schema.fields.forEach(f => {
    if (f.required && !f.hidden && !f.auto_increment) {
      const cell = getCellForField(row, f.name);
      if (!cell) return;

      let val = "";
      const sel = cell.querySelector("select");
      if (sel) val = sel.value || "";
      else val = (cell.getAttribute("data-value") || cell.textContent || "").trim();

      if (!val || val === "__new__") {
        cell.classList.add("invalid-cell");
        fehlende.push(f.name);
        if (!cell.isContentEditable) cell.setAttribute("contenteditable", "true");
        if (sel) sel.disabled = false;
      } else {
        cell.classList.remove("invalid-cell");
      }
    }
  });

  if (fehlende.length > 0) {
    row.classList.add("row-invalid");
    return { ok: false, type: "required", fields: fehlende };
  } else {
    row.classList.remove("row-invalid");
  }

  // E-Mail
  for (const f of schema.fields.filter(f => /e-?mail/i.test(f.name))) {
    const val = data[f.name] || "";
    const cell = getCellForField(row, f.name);
    if (cell) {
      if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        cell.classList.add("invalid-cell");
        row.classList.add("row-invalid");
        return { ok: false, type: "email", field: f.name, value: val };
      } else {
        cell.classList.remove("invalid-cell");
      }
    }
  }

  // Telefon
  for (const f of schema.fields.filter(f => /(tel|telefon)/i.test(f.name))) {
    const val = data[f.name] || "";
    const cell = getCellForField(row, f.name);
    if (cell) {
      if (val && !/^[0-9+\-\/\s]+$/.test(val)) {
        cell.classList.add("invalid-cell");
        row.classList.add("row-invalid");
        return { ok: false, type: "phone", field: f.name, value: val };
      } else {
        cell.classList.remove("invalid-cell");
      }
    }
  }

  row.classList.remove("row-invalid");
  return { ok: true };
}

// -------------------------------------------------------
// Floating Confirm positionieren
// -------------------------------------------------------
export function placeFloatingConfirm(cell, fc) {
  if (!document.body.contains(fc)) document.body.appendChild(fc);
  const rect = cell.getBoundingClientRect();
  fc.style.position = "absolute";
  fc.style.top = `${window.scrollY + rect.bottom + 5}px`;
  fc.style.left = `${window.scrollX + rect.left}px`;
  fc.style.zIndex = "9999";
}

// -------------------------------------------------------
// Tabelle sortieren nach erster sichtbarer Spalte
// -------------------------------------------------------
export function sortTableByFirstVisibleColumn(schema) {
  const table = document.querySelector(".data-table, .preview-table");
  if (!table || !schema || !schema.fields) return;

  const firstField = schema.fields.find(f => !f.hidden && !f.auto_increment);
  if (!firstField) return;

  const headerCells = Array.from(table.querySelectorAll("thead th"));
  const firstVisibleIndex = headerCells.findIndex(th => th.dataset.field === firstField.name);
  if (firstVisibleIndex === -1) return;

  const rows = Array.from(table.querySelectorAll("tbody tr[data-id]"));
  if (!rows.length) return;

  rows.sort((a, b) => {
    const valA = a.children[firstVisibleIndex].textContent.trim().toLowerCase();
    const valB = b.children[firstVisibleIndex].textContent.trim().toLowerCase();
    return valA.localeCompare(valB, "de");
  });

  const tbody = table.querySelector("tbody");
  rows.forEach(r => tbody.appendChild(r));
}

// -------------------------------------------------------
// 🔧 FIX: Highlighting wiederherstellen
// -------------------------------------------------------
export function restoreHighlighting() {
  // IDs aus sessionStorage holen
  const highlightIDs = sessionStorage.getItem("highlightIDs");
  
  if (highlightIDs) {
    const ids = highlightIDs.split(",");
    console.log("🎨 Stelle Highlighting wieder her für IDs:", ids);
    
    ids.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) {
        row.classList.add("highlight-import");
        console.log("✅ Zeile markiert:", id);
      }
    });
  }
}

// -------------------------------------------------------
// 🔧 FIX: Highlighting speichern
// -------------------------------------------------------
export function saveHighlightForID(id) {
  if (!id || id === "neu") return;
  
  const existing = sessionStorage.getItem("highlightIDs") || "";
  const ids = existing ? existing.split(",") : [];
  
  if (!ids.includes(String(id))) {
    ids.push(String(id));
    sessionStorage.setItem("highlightIDs", ids.join(","));
    console.log("💾 Gespeicherte Highlight-IDs:", ids);
  }
}

// -------------------------------------------------------
// 🔧 FIX: Highlighting wiederherstellen
// -------------------------------------------------------
export function restoreHighlighting() {
  // IDs aus sessionStorage holen
  const highlightIDs = sessionStorage.getItem("highlightIDs");
  
  if (highlightIDs) {
    const ids = highlightIDs.split(",");
    console.log("🎨 Stelle Highlighting wieder her für IDs:", ids);
    
    ids.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) {
        row.classList.add("highlight-import");
        console.log("✅ Zeile markiert:", id);
      }
    });
  }
}

// -------------------------------------------------------
// 🔧 FIX: Highlighting speichern
// -------------------------------------------------------
export function saveHighlightForID(id) {
  if (!id || id === "neu") return;
  
  const existing = sessionStorage.getItem("highlightIDs") || "";
  const ids = existing ? existing.split(",") : [];
  
  if (!ids.includes(String(id))) {
    ids.push(String(id));
    sessionStorage.setItem("highlightIDs", ids.join(","));
    console.log("💾 Gespeicherte Highlight-IDs:", ids);
  }
}

// -------------------------------------------------------
// Fokus / Markierungen
// -------------------------------------------------------
export function wendeFokusAn() {
  // 🔧 FIX: Highlighting ZUERST wiederherstellen
  restoreHighlighting();
  // 🔧 FIX: Highlighting ZUERST wiederherstellen
  restoreHighlighting();
  
  const focusID = localStorage.getItem("focusID");
  const focusCellIndex = parseInt(localStorage.getItem("focusCellIndex") || "0", 10);
  let ziel = null;

  if (focusID && /^[a-zA-Z0-9_-]+$/.test(focusID)) {
    const zielRow = document.querySelector(`tr[data-id="${focusID}"]`);
    if (zielRow) {
      const children = Array.from(zielRow.children);
      ziel = children[focusCellIndex] || null;
    }
  }

  if (!ziel) {
    const ersteZeile = document.querySelector("tbody tr[data-id]");
    if (ersteZeile) ziel = ersteZeile.querySelector("td[contenteditable], td select");
  }

  if (ziel) {
    setTimeout(() => {
      const td = ziel.closest("td") || ziel;
      td.focus({ preventScroll: true });

      if (td.hasAttribute("contenteditable")) {
        const range = document.createRange();
        range.selectNodeContents(td);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }

      const row = td.closest("tr");
      if (row) row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }

  // Fokus nach "new=1" erzwingen
  if (window.location.search.includes("new=1")) {
    const neu = document.querySelector('tr[data-id="neu"]');
    if (neu) neu.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  localStorage.removeItem("focusID");
  localStorage.removeItem("focusCellIndex");
}

export function clearMarkings() {
  document.querySelectorAll(
    ".row-duplicate, .row-invalid, .row-error, .duplicate-cell, .invalid-cell, .highlight-import"
  ).forEach(el => {
    el.classList.remove(
      "row-duplicate",
      "row-invalid",
      "row-error",
      "duplicate-cell",
      "invalid-cell",
      "highlight-import"
    );
  });
  sessionStorage.removeItem("highlightIDs"); // 🔧 FIX: sessionStorage statt localStorage
  console.log("🧹 Alle Markierungen entfernt");
}

// -------------------------------------------------------
// 🔧 FIX: ALT-PFEIL-NAVIGATION
// -------------------------------------------------------
document.addEventListener("keydown", (event) => {
  // 🔧 FIX: Nur Alt-Key prüfen, KEINE anderen Modifier
  if (!event.altKey) return;
  if (event.shiftKey || event.ctrlKey || event.metaKey) return;
  
  // 🔧 FIX: Prüfen ob in Eingabefeld
  const target = event.target;
  const isInput = 
    target.tagName === 'INPUT' || 
    target.tagName === 'TEXTAREA' || 
    target.tagName === 'SELECT' ||
    target.isContentEditable;
  
  // In Eingabefeldern nur bei ArrowLeft/Right blockieren
  if (isInput && !['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    return;
  }

  const path = window.location.pathname.toLowerCase();
  const pages = ["customers.php", "users.php", "helpdesks.php"];
  const current = pages.findIndex(p => path.endsWith(p));
  
  if (current === -1) return; // Nicht auf relevanter Seite

  // 🔧 FIX: Alt + Links → zurück
  if (event.key === "ArrowLeft" && current > 0) {
    event.preventDefault();
    event.stopPropagation();
    
    const target = pages[current - 1];
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("customer_ID");
    const uid = params.get("user_ID");

    console.log("⬅️ Navigation zurück:", target);

    if (target === "customers.php") {
      window.location.href = `customers.php${cid ? '?customer_ID=' + cid : ''}`;
    } else if (target === "users.php") {
      window.location.href = `users.php${cid ? '?customer_ID=' + cid : ''}${uid ? '&user_ID=' + uid : ''}`;
    }
  }

  // 🔧 FIX: Alt + Rechts → vorwärts
  if (event.key === "ArrowRight" && current < pages.length - 1) {
    event.preventDefault();
    event.stopPropagation();
    
    const target = pages[current + 1];
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("customer_ID");
    const uid = params.get("user_ID");

    console.log("➡️ Navigation vorwärts:", target);

    if (target === "users.php" && cid) {
      window.location.href = `users.php?customer_ID=${cid}`;
    } else if (target === "helpdesks.php" && cid && uid) {
      window.location.href = `helpdesks.php?customer_ID=${cid}&user_ID=${uid}`;
    } else if (target === "helpdesks.php" && cid) {
      // Wenn kein user_ID, trotzdem zu helpdesks wechseln
      window.location.href = `helpdesks.php?customer_ID=${cid}`;
    }
  }
  
  // 🔧 FIX: Alt + Hoch/Runter für Zeilen-Navigation
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    event.stopPropagation();
    
    const currentRow = target.closest("tr");
    if (!currentRow) return;
    
    const nextRow = event.key === "ArrowUp" 
      ? currentRow.previousElementSibling 
      : currentRow.nextElementSibling;
    
    if (nextRow && nextRow.tagName === "TR") {
      const firstCell = nextRow.querySelector("td[contenteditable], td select, td input");
      if (firstCell) {
        firstCell.focus();
        console.log(event.key === "ArrowUp" ? "⬆️ Zeile hoch" : "⬇️ Zeile runter");
      }
    }
  }
}, true); // capture=true für frühe Abfangung