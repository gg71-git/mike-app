// admin.js – Float-Version mit Button unter aktiver Zelle (bereinigt)
// -------------------------------------------------------
// Funktionsverzeichnis:
// - UIComponents
// - getRowData
// - lockTableExcept
// - unlockTable
// - showFloatingConfirm
// - bindInputListener
// - bindBlurListener
// - bindRowActions
// - addNewEntryRow
// - addPlaceholderBehavior
// - isDuplicateFirma

// Schutz gegen doppelte Deklaration
window.UIComponents = window.UIComponents || {
  createActionButtons(id) {
    return `
      <button class="btn-copy">Kopieren</button>
      <button class="btn-delete">Löschen</button>
    `;
  }
};



document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ admin.js geladen");

  // Debugging: Prüfen, ob Button existiert
  const globalNewBtn = document.getElementById("btn-global-new");
  if (!globalNewBtn) {
    console.error("❌ btn-global-new NICHT im DOM gefunden!");
  } else {
    console.log("✅ btn-global-new gefunden, Event-Listener wird gebunden");
  }

const focusID = localStorage.getItem("focusKunde");
const focusCellIndex = parseInt(localStorage.getItem("focusCellIndex") || "0", 10);
if (focusID) {
  const zielRow = document.querySelector(`tr[data-id="${focusID}"]`);
  const ziel = zielRow?.children?.[focusCellIndex];
  if (ziel && ziel.contentEditable === "true") {
    // 🔁 Verzögert ausführen, um sicherzustellen, dass DOM bereit ist
    setTimeout(() => {
      ziel.scrollIntoView({ behavior: "smooth", block: "center" });
      ziel.focus();
      const range = document.createRange();
      range.selectNodeContents(ziel);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }, 100);
  }
  localStorage.removeItem("focusKunde");
  localStorage.removeItem("focusCellIndex");
}


  document.querySelectorAll("td[contenteditable=true]").forEach(cell => {
    bindBlurListener(cell);
    bindInputListener(cell);
  });

  document.querySelectorAll("tr[data-id]").forEach(row => {
    const actionCell = row.querySelector(".action-cell");
    if (actionCell && !actionCell.querySelector(".btn-copy")) {
      actionCell.innerHTML = UIComponents.createActionButtons(row.dataset.id);
    }
    bindRowActions(row);
  });

  document.querySelectorAll('.new-entry-row').forEach(addPlaceholderBehavior);
  document.querySelectorAll('.new-entry-row td[contenteditable="true"]').forEach(td => {
    td.style.backgroundColor = '#f8c471';
    td.style.color = '#555';
    td.style.fontStyle = 'italic';
  });
  markDuplicateWarnings();

  // btn-global-new Event-Listener
  if (globalNewBtn) {
    globalNewBtn.addEventListener("click", () => {
      console.log("🔵 btn-global-new geklickt");
      let tableBody = document.querySelector(".preview-table tbody");
      if (!tableBody) {
        console.error("❌ .preview-table tbody NICHT gefunden!");
        return;
      }
let activeCell = document.activeElement;
if (!activeCell || activeCell.tagName !== "TD" || !activeCell.closest("table")) {
  activeCell = document.querySelector(".preview-table tbody tr:first-child td[contenteditable]");
}
const activeRow = activeCell?.closest("tr");

      // Falls keine Zelle aktiv: letzte Tabellenzeile als Fallback
      if (!activeRow) {
        const rows = document.querySelectorAll(".preview-table tbody tr");
        activeRow = rows[rows.length - 1] || null;
      }
      if (!activeRow) {
        console.error("❌ Keine aktive Zeile gefunden!");
        return;
      }

      const newRow = activeRow.cloneNode(true);
      newRow.dataset.id = "neu";
      newRow.classList.add("new-entry-row");
      newRow.dataset.firmaBearbeitet = "false";

      // Zellen leeren
      newRow.querySelectorAll("td[contenteditable='true']").forEach(td => {
        td.textContent = "";
        td.style.color = '#555';
        td.classList.remove("unsaved");
      });

      // Action-Zelle neu setzen
      const lastCell = newRow.querySelector("td:last-child");
      lastCell.innerHTML = UIComponents.createActionButtons("neu");

tableBody = document.querySelector(".preview-table tbody");
const firstRealRow = [...tableBody.children].find(el => el.tagName === "TR");
tableBody.insertBefore(newRow, firstRealRow);

      const firstRow = [...tableBody.querySelectorAll("tr")].find(tr => tr.dataset.id !== "neu");
      const firstEditable = newRow.querySelector('td[contenteditable="true"]');

      if (firstEditable) {
        firstEditable.style.userSelect = "text";
        firstEditable.style.pointerEvents = "auto";

        requestAnimationFrame(() => {
          firstEditable.focus();
          const range = document.createRange();
          range.selectNodeContents(firstEditable);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        });

        newRow.addEventListener("keydown", (e) => {
          if (e.key === "Escape") location.reload();
        }, { once: true });

        newRow.querySelectorAll('td[contenteditable="true"]').forEach(td => {
          td.addEventListener("keydown", (e) => {
            if (e.key === "Escape") location.reload();
          });
        });

        lockRowOnly(newRow);
        showFloatingConfirm(firstEditable);
      } else {
        console.error("❌ Keine bearbeitbare Zelle in der neuen Zeile gefunden!");
      }

      bindRowActions(newRow);
    });
  }
});

function getRowData(row) {
  const path = location.pathname;

  let fields = [];
  if (path.includes("kunden_alle.php")) {
    fields = [
      "firmenname", "land", "stadt", "plz", "strasse",
      "Ansprechpartner_technisch", "Ansprechpartner_kaufm",
      "dokumentationslink", "logo_url", "stdFehler1", "stdFehler2"
    ];
  } else if (path.includes("benutzer_alle.php")) {
    fields = [
      "nachname", "vorname", "anrede", "email", "telefon", "rolle", "hd_ID", "funktion", "filialID", "kundenID", "notizen", "aktiv"
      ];
  } else if (path.includes("helpdesks_alle.php")) {
    fields = [
      "vorname", "nachname", "email", "telefon", "rolle", "aktiv", "kundenID"
    ];
  }

   const cells = row.querySelectorAll("td[contenteditable]");
   const data = {};

   fields.forEach((field, index) => {
     const val = cells[index]?.textContent?.trim() ?? "";
     data[field] = val;
   });



  return data;
}


function lockTableExcept(cell) {
  document.querySelectorAll("td[contenteditable=true]").forEach(td => td.contentEditable = "false");
  cell.contentEditable = "true";
}

function unlockTable() {
  document.querySelectorAll("td[contenteditable=true]").forEach(td => {
    td.contentEditable = "true";
    td.style.pointerEvents = "";
    td.style.userSelect = "";
    td.style.backgroundColor = '';
    td.style.color = '';
    td.style.fontStyle = '';
  });
  document.querySelectorAll('.new-entry-row td[contenteditable="true"]').forEach(td => {
    td.style.backgroundColor = '#f8c471';
    td.style.color = '#555';
    td.style.fontStyle = 'italic';
  });
  const fc = document.getElementById("floating-confirm");
  if (fc) fc.remove();
}

function showFloatingConfirm(cell) {
  const existing = document.getElementById("floating-confirm");
  if (existing) existing.remove();

  const rect = cell.getBoundingClientRect();
  const row = cell.closest("tr");

  const floatDiv = document.createElement("div");
  floatDiv.id = "floating-confirm";
  floatDiv.style.position = "absolute";
  floatDiv.style.top = `${window.scrollY + rect.bottom + 6}px`;
  floatDiv.style.left = `${window.scrollX + rect.left}px`;

  const header = document.createElement("div");
  header.className = "confirm-header";
  header.textContent = "Daten übernehmen?";
  floatDiv.appendChild(header);

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "btn-okay";
  confirmBtn.textContent = "✅ Übernehmen";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-cancel";
  cancelBtn.textContent = "✖ Abbrechen";

  const btnRow = document.createElement("div");
  btnRow.className = "confirm-actions";
  btnRow.appendChild(confirmBtn);
  btnRow.appendChild(cancelBtn);

  floatDiv.appendChild(btnRow);
  document.body.appendChild(floatDiv);

  cancelBtn.addEventListener("click", () => {
    location.reload();
  });

  cell.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmBtn.click();
    }
  });



confirmBtn.addEventListener("click", () => {
  const text = cell.innerText.trim().replace(/ – Kopie$/, "");
  const path = location.pathname;

  const isKunden = path.includes("kunden_alle.php");
  const isBenutzer = path.includes("benutzer_alle.php");
  const isHelpdesk = path.includes("helpdesks_alle.php");

  // Feldprüfung
  if (isKunden && !text) {
    alert("⚠️ Bitte einen Firmennamen eingeben.");
    return;
  }

  if (isBenutzer && !text) {
    alert("⚠️ Bitte einen Nachnamen eingeben.");
    return;
  }

  if (isKunden && isDuplicateFirma(text)) {
    alert("⚠️ Firmenname existiert bereits!");
    return;
  }

  if (isBenutzer && isDuplicateEmail(text)) {
    alert("⚠️ Diese E-Mail ist bereits vorhanden!");
    return;
  }

  row.querySelectorAll('td[contenteditable=true]').forEach(td => td.blur());

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const data = getRowData(row);
      console.log("📦 Daten vor dem Speichern:", data);

      // API-Ziel & ID-Feld bestimmen
      let apiBase = "";
      let idFeld = "";

      if (isKunden) {
        apiBase = "kunden";
        idFeld = "kundenID";
      } else if (isBenutzer) {
        apiBase = "benutzer";
        idFeld = "userID";
      } else if (isHelpdesk) {
        apiBase = "helpdesk"; // später anpassen
        idFeld = "helpdeskID";
      } else {
        alert("Unbekannter Modus");
        return;
      }

      const url = row.dataset.id === "neu"
        ? `../../api/${apiBase}_create.php`
        : `../../api/${apiBase}_update.php`;

      if (row.dataset.id !== "neu") {
        data[idFeld] = row.dataset.id;
      }
console.log("🔍 Daten:", data);
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      .then(async res => {
        if (!res.ok) throw new Error(`Serverfehler: ${res.status}`);
      return url.includes("_create.php") ? res.json() : res.text();
      })
      .then(result => {
console.log("✅ Ergebnis vom Server:", result);
console.log("📬 Erwartetes ID-Feld:", idFeld);
console.log("📬 Rückgabe wird geprüft auf:", result?.[idFeld]);
        // neue ID zurückspeichern
        if (row.dataset.id === "neu" && result?.[idFeld]) {
          row.dataset.id = result[idFeld];
        }

        row.classList.remove("new-entry-row");
        row.dataset.bearbeitet = "true";

        row.querySelectorAll('td[contenteditable="true"]').forEach(td => {
          td.style.backgroundColor = "";
          td.style.color = "";
          td.style.fontStyle = "";
        });

        const lastCell = row.querySelector("td:last-child");
        lastCell.innerHTML = UIComponents.createActionButtons(row.dataset.id);
        bindRowActions(row);

        row.querySelectorAll("td").forEach(td => {
          td.contentEditable = "true";
          td.style.pointerEvents = "";
          td.style.userSelect = "";
        });

        row.querySelectorAll('td[contenteditable=true]').forEach(cell => {
          bindBlurListener(cell);
          bindInputListener(cell);
        });

        floatDiv.remove();
        unlockTable();

        // Fokusposition für Reload merken
        const cellIndex = [...row.children].indexOf(cell);
        localStorage.setItem(`focus${apiBase}`, row.dataset.id);
        localStorage.setItem("focusCellIndex", cellIndex);
        location.reload();
      })

 // Mark1
.catch(async err => {
  const responseText = err instanceof Response ? await err.text() : "";
  console.error("❌ Fehler beim Speichern (Hakerl):", err, responseText);

  try {
    const parsed = JSON.parse(responseText);
    if (parsed?.error) {
      alert("⚠️ " + parsed.error);
      return;
    }
  } catch {}

  alert("❌ Speichern fehlgeschlagen!");
});

    });
  });
});
}

function bindInputListener(cell) {
  cell.addEventListener("input", () => {});
}

function bindBlurListener(cell) {
  cell.addEventListener("blur", () => {
    const row = cell.closest("tr");
    const id = row.dataset.id;

    if (id && id !== "neu") {
      const data = getRowData(row);
      data.kundenID = id;

      fetch("../../api/kunden_update.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      .then(res => {
        if (!res.ok) {
          alert("⚠️ Fehler beim Speichern!");
        }
      })
      .catch(err => {
        console.error("❌ Fehler beim Update (blur):", err);
      });
    }
  });
}

function bindRowActions(row) {
  const copyBtn = row.querySelector(".btn-copy");
  const deleteBtn = row.querySelector(".btn-delete");

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      console.log("🔵 btn-copy geklickt");
      const clone = row.cloneNode(true);
      clone.dataset.id = "neu";
      clone.classList.add("new-entry-row");
      clone.dataset.firmaBearbeitet = "false";

      const origCells = row.querySelectorAll("td[contenteditable=true]");
      const cloneCells = clone.querySelectorAll("td[contenteditable=true]");

      cloneCells.forEach((cell, index) => {
        if (index === 0) {
          const orig = origCells[index].innerText.trim().replace(/ – Kopie$/, "");
          cell.innerText = orig + " – Kopie";
          cell.style.color = 'red';
          cell.classList.add("unsaved");
        } else {
          const text = origCells[index]?.innerText?.trim() || "";
          while (cell.firstChild) cell.removeChild(cell.firstChild);
          cell.appendChild(document.createTextNode(text));
        }
      });

      row.parentNode.insertBefore(clone, row.nextSibling);

      const firstEditable = clone.querySelector('td[contenteditable=true]');
      if (firstEditable) {
        firstEditable.style.userSelect = "text";
        firstEditable.style.pointerEvents = "auto";

        requestAnimationFrame(() => {
          firstEditable.focus();
          const range = document.createRange();
          range.selectNodeContents(firstEditable);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        });

        clone.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            location.reload();
          }
        }, { once: true });
      }

      clone.querySelectorAll('td[contenteditable="true"]').forEach(td => {
        td.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            location.reload();
          }
        });
      });

      lockRowOnly(clone);
      showFloatingConfirm(firstEditable);

      const lastCell = clone.querySelector("td:last-child");
      lastCell.innerHTML = UIComponents.createActionButtons("neu");
      bindRowActions(clone);
    });
  }

  if (deleteBtn) {
deleteBtn.addEventListener("click", () => {
  const path = location.pathname;

  const isKunden = path.includes("kunden_alle.php");
  const isBenutzer = path.includes("benutzer_alle.php");
  const isHelpdesk = path.includes("helpdesks_alle.php");

  let apiBase = "";
  let idFeld = "";

  if (isKunden) {
    apiBase = "kunden";
    idFeld = "kundenID";
  } else if (isBenutzer) {
    apiBase = "benutzer";
    idFeld = "userID";
  } else if (isHelpdesk) {
    apiBase = "helpdesk"; // später ggf. anpassen
    idFeld = "helpdeskID";
  } else {
    alert("Unbekannter Modus");
    return;
  }

  const id = row.dataset.id;
  if (!id || id === "neu") {
    row.remove();
    return;
  }

  const sicher = confirm(`❗ Diesen Eintrag wirklich löschen?\n(${idFeld} = ${id})`);
  if (!sicher) return;

  fetch(`../../api/${apiBase}_delete.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [idFeld]: id })
  })
  .then(res => res.text())
  .then(result => {
    if (result === "OK") {
      row.remove();
      zeigeStatus("🗑️ Eintrag gelöscht");
    } else {
      zeigeStatus("❌ Fehler beim Löschen: " + result);
    }
  })
  .catch(err => {
    console.error("❌ Löschfehler:", err);
    alert("❌ Löschen fehlgeschlagen!");
  });
});
  }
}

function addNewEntryRow() {
tableBody = document.querySelector("tbody");
  const newRow = document.createElement("tr");
  newRow.dataset.id = "neu";
  newRow.dataset.firmaBearbeitet = "false";
  newRow.classList.add("new-entry-row");

  const fields = ["firmenname", "land", "stadt", "plz", "strasse", "Ansprechpartner_technisch", "Ansprechpartner_kaufm", "dokumentationslink", "logo_url", "stdFehler1", "stdFehler2"];
  newRow.innerHTML = fields.map(() => `<td contenteditable="true"></td>`).join("") + `<td class="action-cell">${UIComponents.createActionButtons("neu")}</td>`;

  tableBody.appendChild(newRow);
  addPlaceholderBehavior(newRow);
  bindRowActions(newRow);
  newRow.querySelectorAll('td[contenteditable="true"]').forEach(cell => {
    cell.style.backgroundColor = '#f8c471';
    cell.style.color = '#555';
    cell.style.fontStyle = 'italic';
    bindBlurListener(cell);
    bindInputListener(cell);
  });
}

function addPlaceholderBehavior(row) {
  row.querySelectorAll('td[contenteditable="true"]').forEach(cell => {
    let placeholder = cell.textContent.trim();
    cell.style.color = '#666';
    cell.style.fontStyle = 'italic';

    cell.addEventListener('focus', () => {
      if (cell.textContent.trim() === placeholder) {
        cell.textContent = '';
      }
      cell.style.color = '#000';
      cell.style.fontStyle = 'normal';
    });

    cell.addEventListener('blur', () => {
      if (cell.textContent.trim() === '') {
        cell.textContent = placeholder;
        cell.style.color = '#666';
        cell.style.fontStyle = 'italic';
      }
    });
  });
}

function isDuplicateFirma(name) {
  const allFirmas = Array.from(document.querySelectorAll('tr[data-id] td:nth-child(2)'))
    .map(td => td.textContent.trim().replace(/ – Kopie$/, ""));

  return allFirmas.filter(n => n === name).length > 1;
}


function isDuplicateEmail(email) {
  const allEmails = Array.from(document.querySelectorAll('tr[data-id] td:nth-child(5)')) // 5. Spalte = email
    .map(td => td.textContent.trim().toLowerCase());

  return allEmails.filter(e => e === email.toLowerCase()).length > 1;
}


function markDuplicateWarnings() {
  document.querySelectorAll('tr[data-id] td:first-child').forEach(td => {
    if (td.textContent.includes("DOPPELTER EINTRAG!")) {
      td.style.backgroundColor = 'orange';
    }
  });
}


function lockRowOnly(targetRow) {
  document.querySelectorAll("tr[data-id]").forEach(row => {
    row.querySelectorAll("td[contenteditable=true]").forEach(td => {
      if (row === targetRow) {
        td.contentEditable = "true";
        td.style.pointerEvents = "auto";
        td.style.userSelect = "text";
      } else {
        td.contentEditable = "false";
        td.style.pointerEvents = "none";
        td.style.userSelect = "none";
      }
    });
  });
}

