// =======================================================
// admin.js – Orchestrator / Einstiegspunkt
// =======================================================

import {
  ladeSchema,
  sortTableByFirstVisibleColumn,
  validateRow,
  wendeFokusAn,
  clearMarkings
} from './admin_utils.js';

import {
  applyDropdowns,
  bindGlobalNewButton
} from './admin_core.js';

import './admin_utils.js';  // ⬅️ sorgt dafür, dass der Alt+Pfeil-Listener aktiv ist

// -------------------------------------------------------
// Tabellenname automatisch bestimmen
// -------------------------------------------------------
let tableName = window.tableName || null;

if (!tableName) {
  const params = new URLSearchParams(window.location.search);
  tableName = params.get("page") ||
              location.pathname.split("/").pop().replace(".php", "");
}

if (!tableName) {
  console.error("❌ Kein Tabellenname erkennbar!");
} else {
  console.log("📄 Tabelle erkannt:", tableName);
}

// -------------------------------------------------------
// Initialisierung
// -------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  try {
    // 1️⃣ Schema laden (asynchron, blockiert Event-Loop nicht)
    ladeSchema(tableName)
      .then(schema => {
        if (!schema) {
          console.error("❌ Kein Schema erhalten!");
          return;
        }

        window.currentSchema = schema;

        // 2️⃣ Dropdowns initialisieren
        document.querySelectorAll("tbody tr").forEach(row => applyDropdowns(row, schema));

        // 3️⃣ New-Button binden
        bindGlobalNewButton();

        // 4️⃣ Sortierung & Fokus
        sortTableByFirstVisibleColumn(schema);
        wendeFokusAn();

        // 5️⃣ Ungültige Daten (debug)
        document.querySelectorAll("tbody tr[data-id]").forEach(row => {
          const check = validateRow(row, schema);
          if (!check.ok) console.warn("⚠️ Ungültige Daten:", check);
        });

        // 6️⃣ Markierungs-Button (optional)
        const btn = document.getElementById("clear-markings-btn");
        if (btn) {
          btn.addEventListener("click", () => {
            clearMarkings();
            console.log("🧹 Markierungen entfernt");
            location.reload();
          });

          const hasMarks = !!document.querySelector(".duplicate-cell, .invalid-cell");
          btn.style.display = hasMarks ? "inline-block" : "none";
        }

        console.log("✅ admin.js vollständig initialisiert.");
      })
      .catch(err => {
        console.error("❌ Fehler bei Schema-Ladevorgang:", err);
        alert("Schema konnte nicht geladen werden. Bitte später erneut versuchen.");
      });

  } catch (err) {
    console.error("❌ Unerwarteter Fehler in admin.js:", err);
  }
});
