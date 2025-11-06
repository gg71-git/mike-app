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

