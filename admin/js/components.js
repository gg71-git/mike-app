window.UIComponents = {
  createActionButtons: (id) => `
    <button class="btn-copy" title="Kopieren">⧉</button>
    <button class="btn-delete" title="Löschen" data-id="${id}">✖</button>
  `,

  createConfirmButton: (label = "Neuen Kundennamen bestätigen") => {
    const btn = document.createElement("button");
    btn.classList.add("confirm-firma-btn");
    btn.title = label;
    btn.style.marginLeft = "8px";
    btn.style.cursor = "pointer";
    btn.innerHTML = "✅ <span style='font-size:0.9em;'>" + label + "</span>";
    return btn;
  }
};

// =======================================================
// ALT+PFEIL NAVIGATION - Zellen & Zeilen Navigation
// =======================================================
console.log("🚀 Alt+Pfeil Navigation wird geladen (components.js)");

document.addEventListener("keydown", (e) => {
  // ESC zum Abbrechen
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
  
  // ========================================
  // ALT + HOCH/RUNTER → Zeile wechseln
  // ========================================
  if (["ArrowUp","ArrowDown"].includes(e.key)) {
    const newRow = (e.key === "ArrowUp") ? rows[rowIndex - 1] : rows[rowIndex + 1];
    if (newRow) target = newRow.children[colIndex] || null;
  }
  
  // ========================================
  // ALT + LINKS/RECHTS → Zelle wechseln
  // ========================================
  if (["ArrowLeft","ArrowRight"].includes(e.key)) {
    const newColIndex = (e.key === "ArrowLeft") ? colIndex - 1 : colIndex + 1;
    target = tr.children[newColIndex] || null;
  }
  
  // Fokus setzen
  if (target) {
    target.focus({ preventScroll: true });
    
    // Wenn contenteditable: Text markieren
    if (target.hasAttribute("contenteditable")) {
      setTimeout(() => {
        const range = document.createRange();
        range.selectNodeContents(target);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }, 0);
    }
    
    // In Sichtbereich scrollen
    const row = target.closest("tr");
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
});

console.log("✅ Alt+Pfeil Navigation geladen und aktiviert!");