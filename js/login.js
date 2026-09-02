/* =========================================
   Nexora-Mail — Connexion (login.js)
   ========================================= */

const API_BASE = window.NEXORA_API_BASE;

function readCreds() {
  return api("/api/me").catch(() => null);
}

async function api(endpoint, options = {}) {
  const res = await fetch(API_BASE + endpoint, {
    headers: {
      "Content-Type": "application/json",
      ...(localStorage.getItem("nexora_token")
        ? { Authorization: "Bearer " + localStorage.getItem("nexora_token") }
        : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const status = document.getElementById("loginStatus");
  const btn = document.getElementById("loginBtn");

  // Si déjà connecté, rediriger vers la boîte
  readCreds().then((data) => {
    if (data && data.user) window.location.href = "inbox.html";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    status.className = "form-status";

    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    if (!email || !password) {
      status.textContent = "Merci de renseigner votre e-mail et votre mot de passe.";
      status.className = "form-status is-error";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Connexion…";

    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("nexora_token", data.token);
      localStorage.setItem("nexora_user", JSON.stringify(data.user));
      status.textContent = "✅ Connexion réussie, redirection…";
      status.className = "form-status is-success";
      window.location.href = "inbox.html";
    } catch (err) {
      status.textContent = "❌ " + err.message;
      status.className = "form-status is-error";
    } finally {
      btn.disabled = false;
      btn.textContent = "Se connecter";
    }
  });
});