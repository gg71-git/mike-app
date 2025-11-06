// =======================================================
// admin_new.js – zentraler, linearer Neuanlage-Workflow
// =======================================================
//
// Ablauf:
// 1️⃣ Kunde speichern  → users.php
// 2️⃣ User speichern    → helpdesks.php
// 3️⃣ Helpdesk speichern→ users.php
// 4️⃣ User speichern    → customers.php
// 5️⃣ Customer speichern→ Meldung + Ende
//

import { addNewEntryRow } from './admin_core.js';

// -------------------------------------------------------
// Helper: ready()
// -------------------------------------------------------
function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else fn();
}

// -------------------------------------------------------
// Initialisierung bei Seitenaufruf
// -------------------------------------------------------
function initWorkflow() {
  const params = new URLSearchParams(window.location.search);
  const page   = (window.location.pathname.split("/").pop() || "").toLowerCase();

  // Startsignal nur bei customers.php?new=1
  if (page === "customers.php" && params.get("new") === "1") {
    console.log("🚀 Workflow gestartet (customers→users→helpdesks→users→customers)");
    sessionStorage.setItem("wfStep", "customers");
  }

  // new=1 → neue Zeile anlegen
  if (params.get("new") === "1") {
    const waitSchema = setInterval(() => {
      if (window.currentSchema?.fields) {
        clearInterval(waitSchema);
        addNewEntryRow();
        params.delete("new");
        history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
      }
    }, 100);
  }
}

// -------------------------------------------------------
// Zentrale Steuerung via afterSave-Event
// -------------------------------------------------------
document.addEventListener("afterSave", (e) => {
  const { tableName, newID, data } = e.detail || {};
  if (!tableName || !newID) return;

  const currentStep = sessionStorage.getItem("wfStep");

  // 🛑 Wenn der Workflow bereits beendet ist → nichts mehr tun
  if (!currentStep || currentStep === "done") {
    console.log("🛑 Workflow bereits beendet – keine Aktion.");
    return;
  }
if (currentStep === "customersBack" && tableName !== "customers") {
  console.log("🛑 Workflow im finalen Schritt – warte nur noch auf Kundensave.");
  return;
}


  const step = sessionStorage.getItem("wfStep") || "none";
  const params = new URLSearchParams(window.location.search);
  const customer_ID = data?.customer_ID || params.get("customer_ID") || "";
  const user_ID     = data?.user_ID     || params.get("user_ID")     || "";

  console.log("🔗 Workflow-Status:", step, tableName, newID);

  switch (step) {
    case "customers":
      if (tableName === "customers") {
        sessionStorage.setItem("wfStep", "users");
        window.location.href = `users.php?customer_ID=${newID}&new=1`;
      }
      break;

    case "users":
      if (tableName === "users") {
        sessionStorage.setItem("wfStep", "helpdesks");
        window.location.href = `helpdesks.php?customer_ID=${customer_ID}&user_ID=${newID}&new=1`;
      }
      break;

    case "helpdesks":
      if (tableName === "helpdesks") {
        sessionStorage.setItem("wfStep", "usersBack");
        window.location.href = `users.php`;
      }
      break;

case "usersBack":
  // egal ob tableName users ODER customers (z. B. Doppelsave)
  if (tableName === "users" || tableName === "customers") {
    console.log("⬅️ Wechsel zu Customers (finaler Schritt)");
    sessionStorage.setItem("wfStep", "customersBack");
    window.location.href = `customers.php`;
  }
  break;


    case "customersBack":
      if (tableName === "customers") {
	alert("✅ Datensatz vollständig angelegt und verknüpft!");
	sessionStorage.setItem("wfStep", "done"); // 🧹 endgültig beenden
        // kein reload, kein redirect mehr
      }
      break;

    default:
      // Kein aktiver Workflow – nichts tun
      sessionStorage.removeItem("wfStep");
  }
});

// -------------------------------------------------------
// Start bei Seiten-Load
// -------------------------------------------------------
onReady(initWorkflow);
