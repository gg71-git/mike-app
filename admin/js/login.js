// Pfad zur API (von admin/ aus eine Ebene hoch ins api/)
const apiUrl = "../api/auth.php";

// "Code anfordern"
document.getElementById("btn-request").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const remember = document.getElementById("remember").checked;
  const msg = document.getElementById("msg");

  if (!email) { 
    msg.textContent = "Bitte E-Mail eingeben"; 
    return; 
  }

  msg.textContent = "Code wird gesendet...";
  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({mode:"request", client:"web", email, remember})
    }).then(r => r.json());

    if (res.status === "ok") {
      msg.textContent = "Code per Mail gesendet. Bitte eingeben.";
      document.getElementById("verify-section").classList.remove("hidden");
    } else {
      msg.textContent = res.error || "Fehler beim Anfordern des Codes";
    }
  } catch (e) {
    msg.textContent = "Verbindungsfehler: " + e;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const emailInput = document.getElementById("email");
  const btnRequest = document.getElementById("btn-request");

  if (emailInput && btnRequest) {
    emailInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        btnRequest.click();
      }
    });
  }
});



// "Einloggen"
document.getElementById("btn-verify").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const code  = document.getElementById("code").value.trim();
  const msg = document.getElementById("msg");

  if (!code) { 
    msg.textContent = "Bitte Code eingeben"; 
    return; 
  }

  msg.textContent = "Prüfe Code...";
  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({mode:"verify", client:"web", email, code})
    }).then(r => r.json());

    if (res.status === "ok") {
      msg.textContent = "Login erfolgreich. Weiterleitung...";
      setTimeout(() => window.location.href = "pages/manage.php", 1000);
    } else {
      msg.textContent = res.error || "Ungültiger Code";
    }
  } catch (e) {
    msg.textContent = "Verbindungsfehler: " + e;
  }
});
