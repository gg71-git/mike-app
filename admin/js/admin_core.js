// =======================================================
// ÄNDERUNGEN FÜR admin_core.js
// =======================================================
// Diese Änderungen in admin_core.js einfügen
// =======================================================

// ✅ 1. IMPORTS ERWEITERN (ganz oben):

import {
  lockTableExcept,
  unlockTable,
  unlockRow,
  getRowData,
  validateRow,
  wendeFokusAn,
  saveHighlightForID,      // ← NEU
  restoreHighlighting       // ← NEU
} from './admin_utils.js';

// ✅ 2. IN handleConfirmSave() NACH ZEILE ~115:

async function handleConfirmSave(row, cell, fc) {
  // ... bestehender Code ...
  
  const newID = result?.[idField] || result?.id;
  if (newID) {
    row.dataset.id = newID;
    row.classList.add("highlight-import");
    
    // ← NEU: Highlighting speichern
    saveHighlightForID(newID);
  }
  
  // ... Rest bleibt gleich ...
}

// ✅ 3. BEI DOMContentLoaded GANZ UNTEN:

document.addEventListener("DOMContentLoaded", () => {
  // ← NEU: Highlighting wiederherstellen
  restoreHighlighting();
  
  // Bestehende Zeilen binden
  document.querySelectorAll("tbody tr[data-id]").forEach(bindRowActions);
});