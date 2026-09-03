/* =========================================
   Nexora-Mail — Boîte de réception (inbox.js)
   ========================================= */

const TOKEN = localStorage.getItem("nexora_token");
const USER = JSON.parse(localStorage.getItem("nexora_user") || "null");

async function api(endpoint, options = {}) {
  const res = await fetch(window.NEXORA_API_BASE + endpoint, {
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}

/* ---------- Configuration EmailJS (envoi externe) ---------- */

const EXT_CONFIG_KEY = "nexora_emailjs";

function getExtConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(EXT_CONFIG_KEY) || "null");
    // Purge des anciennes clés qui ont fuité sur GitHub
    if (saved && saved.apiKey === "29dfb8f9d4d9d8ea048a72ee66a67f1e") {
      localStorage.removeItem(EXT_CONFIG_KEY);
    } else if (saved) {
      return saved;
    }
  } catch {
    /* ignore */
  }
  // Valeurs par défaut depuis js/emailjs-config.js (+ js/emailjs-secret.js)
  const pub = window.NEXORA_EMAILJS || {};
  const secret = window.NEXORA_EMAILJS_SECRET || {};
  if (pub.apiKey || secret.secretKey) {
    return {
      apiKey: pub.apiKey || "",
      secretKey: secret.secretKey || "",
      serviceId: pub.serviceId || "",
      templateId: pub.templateId || "",
      fromName: pub.fromName || "Nexora-Mail",
      fromEmail: pub.fromEmail || "contact@nexora-mail-7fdk.onrender.com",
    };
  }
  return null;
}

function saveExtConfig(cfg) {
  localStorage.setItem(EXT_CONFIG_KEY, JSON.stringify(cfg));
}

function isExtConfigured() {
  const c = getExtConfig();
  return !!(c && c.apiKey && c.secretKey && c.serviceId && c.templateId);
}

/* Envoi via l'API REST EmailJS v1.2
   - Clé API (publique) → identifiant du compte
   - Clé API Secrète    → Bearer token d'authentification
   https://api.emailjs.com/api/v1.2/email/send  */
const EMAILJS_SEND_URL = "https://api.emailjs.com/api/v1.0/email/send";

function emailjsTemplateParams(cfg, { to, subject, body }) {
  return {
    to_email: to,
    to_name: to,
    from_name: cfg.fromName || ((USER && USER.name) || "Nexora-Mail"),
    reply_to: cfg.fromEmail || ((USER && USER.email) || "contact@nexora-mail-7fdk.onrender.com"),
    subject: subject || "(sans objet)",
    message: body,
  };
}

async function emailjsSendREST(cfg, params) {
  const res = await fetch(EMAILJS_SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Bearer " + cfg.secretKey,
    },
    body: JSON.stringify({
      service_id: cfg.serviceId,
      template_id: cfg.templateId,
      user_id: cfg.apiKey,
      template_params: params,
    }),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error("EmailJS " + res.status + " : " + (text || res.statusText));
  }
  return { ok: true };
}

async function sendExternalMail({ to, subject, body }) {
  if (!isExtConfigured()) throw new Error("EmailJS n'est pas configuré (clés API requises).");
  const cfg = getExtConfig();
  const params = emailjsTemplateParams(cfg, { to, subject, body });
  return emailjsSendREST(cfg, params);
}

function updateExtStatus() {
  const el = document.getElementById("extStatus");
  if (!el) return;
  if (isExtConfigured()) {
    el.className = "app-ext-status is-ok";
    el.textContent = "Envoi externe : ✅ actif (Gmail, Outlook…)";
  } else {
    el.className = "app-ext-status is-warn";
    el.innerHTML =
      'Envoi externe : ⚠️ non configuré — <a href="#" id="openSettingsLink" style="color:inherit">⚙️ configurer</a>';
    const link = document.getElementById("openSettingsLink");
    if (link) link.addEventListener("click", (e) => e.preventDefault() || openSettings());
  }
}

let currentFolder = "inbox";
let currentMailId = null;
let allMails = [];
let counts = {};

const FOLDER_LABELS = {
  inbox: "Boîte de réception",
  sent: "Messages envoyés",
  drafts: "Brouillons",
  spam: "Spam",
  trash: "Corbeille",
};

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function snippet(text) {
  return (text || "").replace(/\s+/g, " ").slice(0, 90);
}

/* ---------- Rendu liste ---------- */

function renderList(mails) {
  const listEl = document.getElementById("mailList");

  if (!mails.length) {
    listEl.innerHTML = `<div class="app-list__empty">Aucun message dans ce dossier.</div>`;
    return;
  }

  listEl.innerHTML = mails
    .map((m) => {
      const unread = m.folder === "inbox" && !m.read;
      const senderName = m.direction === "out" ? "Moi" : m.from.name;
      const isActive = m.id === currentMailId ? " is-active" : "";
      const unreadClass = unread ? " is-unread" : "";
      return `
        <div class="mail-row${isActive}${unreadClass}" data-id="${m.id}">
          <span class="mail-row__dot" aria-hidden="true"></span>
          <span class="mail-row__avatar">${initials(senderName)}</span>
          <div class="mail-row__main">
            <div class="mail-row__head">
              <span class="mail-row__sender">${escapeHtml(senderName)}</span>
              <span class="mail-row__date">${formatDate(m.date)}</span>
            </div>
            <div class="mail-row__subject">${escapeHtml(m.subject)}</div>
            <div class="mail-row__snippet">${escapeHtml(snippet(m.body))}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ---------- Rendu lecture ---------- */

function renderRead(mail) {
  const pane = document.getElementById("readPane");
  if (!mail) {
    pane.innerHTML = `<p class="app-read__empty">Sélectionnez un message pour le lire.</p>`;
    return;
  }

  const from = mail.from || { name: "Inconnu", email: "" };
  const to = mail.to || "";

  pane.innerHTML = `
    <div class="mail-detail">
      <button type="button" class="btn btn--ghost mail-detail__back" id="readBack">← Retour</button>
      <div class="mail-detail__head">
        <h2 class="mail-detail__subject">${escapeHtml(mail.subject)}</h2>
        <div class="mail-detail__meta">
          <span class="avatar">${initials(from.name)}</span>
          <div>
            <p class="mail-detail__sender">${escapeHtml(from.name)}</p>
            <p class="mail-detail__addr">${escapeHtml(from.email)}</p>
          </div>
          <span class="mail-detail__date">${formatDate(mail.date)}</span>
        </div>
      </div>
      <div class="mail-detail__body">${escapeHtml(mail.body)}</div>
      <div class="mail-detail__meta" style="margin-top:1.6rem;border-top:1px solid var(--c-border);padding-top:1rem;">
        <span style="font-size:0.82rem;color:var(--c-muted);">À&nbsp;: ${escapeHtml(to)}</span>
      </div>
    </div>
  `;

  const back = document.getElementById("readBack");
  if (back) back.addEventListener("click", () => {
    document.getElementById("readPane").classList.remove("is-open");
  });
}

/* ---------- Chargement ---------- */

async function loadFolder(folder) {
  currentFolder = folder;
  try {
    const data = await api("/api/inbox?folder=" + encodeURIComponent(folder));
    allMails = data.mails;
    counts = data.counts;
    currentMailId = null;
    renderList(allMails);
    renderRead(null);
    updateBadges();
  } catch (err) {
    if (err.message === "Non connecté") {
      window.location.href = "login.html";
    }
  }
}

function updateBadges() {
  const map = { inbox: "badgeInbox", sent: "badgeSent", drafts: "badgeDrafts", spam: "badgeSpam", trash: "badgeTrash" };
  Object.entries(map).forEach(([folder, id]) => {
    const el = document.getElementById(id);
    const n = counts[folder] || 0;
    if (el) el.textContent = n > 0 ? n : "";
  });
  const unreadEl = document.getElementById("badgeInbox");
  if (unreadEl && counts.unread) unreadEl.textContent = counts.unread;
}

/* ---------- Fenêtre de configuration EmailJS ---------- */

function fillSettingsForm() {
  const cfg = getExtConfig() || {};
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };
  set("cfgFromName", cfg.fromName || (USER && USER.name) || "");
  set("cfgFromEmail", cfg.fromEmail || (USER && USER.email) || "");
  set("cfgApiKey", cfg.apiKey || "");
  set("cfgSecretKey", cfg.secretKey || "");
  set("cfgServiceId", cfg.serviceId || "");
  set("cfgTemplateId", cfg.templateId || "");
}

function openSettings() {
  fillSettingsForm();
  const st = document.getElementById("settingsStatus");
  if (st) {
    st.textContent = "";
    st.className = "form-status";
  }
  document.getElementById("settingsOverlay").hidden = false;
}

function closeSettings() {
  document.getElementById("settingsOverlay").hidden = true;
}

function readSettingsForm() {
  const g = (id) => (document.getElementById(id) || {}).value || "";
  return {
    fromName: g("cfgFromName").trim(),
    fromEmail: g("cfgFromEmail").trim(),
    serviceId: g("cfgServiceId").trim(),
    templateId: g("cfgTemplateId").trim(),
    apiKey: g("cfgApiKey").trim(),
    secretKey: g("cfgSecretKey").trim(),
  };
}

async function testEmailJsSend() {
  const st = document.getElementById("settingsStatus");
  if (!st) return;
  const cfg = readSettingsForm();
  if (!cfg.apiKey || !cfg.secretKey || !cfg.serviceId || !cfg.templateId || !cfg.fromEmail) {
    st.textContent = "Renseignez Clé API, Clé API Secrète, Service, Template et un e-mail de réponse.";
    st.className = "form-status is-error";
    return;
  }
  saveExtConfig(cfg);
  const btn = document.getElementById("testSendBtn");
  if (btn) btn.disabled = true;
  st.textContent = "⏳ Envoi de test en cours…";
  st.className = "form-status";
  try {
    await emailjsSendREST(
      cfg,
      emailjsTemplateParams(cfg, {
        to: cfg.fromEmail,
        subject: "Test Nexora-Mail ✔",
        body: "Ceci est un e-mail de test envoyé depuis votre boîte Nexora-Mail.",
      })
    );
    st.textContent = "✅ E-mail de test envoyé à " + cfg.fromEmail + " !";
    st.className = "form-status is-success";
  } catch (err) {
    st.textContent = "❌ Échec de l'envoi : " + (err && err.message ? err.message : String(err));
    st.className = "form-status is-error";
  } finally {
    if (btn) btn.disabled = false;
    updateExtStatus();
  }
}

/* ---------- Événements ---------- */

document.addEventListener("DOMContentLoaded", () => {
  // Pas de session → retour à la connexion
  if (!TOKEN) {
    window.location.href = "login.html";
    return;
  }

  // Afficher les infos utilisateur
  if (USER) {
    document.getElementById("userName").textContent = USER.name;
    document.getElementById("userEmail").textContent = USER.email;
    document.getElementById("userAvatar").textContent = initials(USER.name);
    const badge = document.getElementById("userBadge");
    if (badge && (USER.verified || String(USER.role).toUpperCase() === "PDG")) {
      badge.hidden = false;
      const isCeo = String(USER.role).toUpperCase() === "PDG";
      badge.innerHTML = `<img src="assets/${isCeo ? "ceo-gold" : "verified-blue"}.svg" alt="">`;
      badge.title = isCeo ? "PDG vérifié" : "Compte vérifié";
    }
  }

  // Dossiers
  document.querySelectorAll(".app-folder").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".app-folder").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      loadFolder(btn.dataset.folder);
    });
  });

  // Sélection d'un message
  document.getElementById("mailList").addEventListener("click", async (e) => {
    const row = e.target.closest(".mail-row");
    if (!row) return;

    const id = row.dataset.id;
    const mail = allMails.find((m) => m.id === id);
    if (!mail) return;

    currentMailId = id;
    renderList(allMails);
    renderRead(mail);

    // Marquer comme lu côté serveur
    if (mail.folder === "inbox" && !mail.read) {
      try {
        await api("/api/mail/" + id + "/read", {
          method: "POST",
          body: JSON.stringify({ read: true }),
        });
        mail.read = true;
        const unreadEl = document.getElementById("badgeInbox");
        if (counts && counts.unread > 0) {
          counts.unread -= 1;
          if (unreadEl) unreadEl.textContent = counts.unread > 0 ? counts.unread : "";
        }
      } catch (err) {}
    }

    // Mobile : ouvrir le panneau de lecture
    if (window.innerWidth <= 900) {
      document.getElementById("readPane").classList.add("is-open");
    }
  });

  // Recherche
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      renderList(allMails);
      return;
    }
    const filtered = allMails.filter((m) => {
      const hay = (m.subject + " " + (m.from?.name || "") + " " + (m.from?.email || "") + " " + m.body).toLowerCase();
      return hay.includes(q);
    });
    renderList(filtered);
  });

  // Composer
  const overlay = document.getElementById("composeOverlay");
  const openCompose = () => {
    document.getElementById("composeForm").reset();
    document.getElementById("composeStatus").textContent = "";
    document.getElementById("composeStatus").className = "form-status";
    overlay.hidden = false;
  };
  const closeCompose = () => {
    overlay.hidden = true;
  };

  document.getElementById("composeBtn").addEventListener("click", openCompose);
  document.getElementById("composeClose").addEventListener("click", closeCompose);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeCompose();
  });

  document.getElementById("composeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById("composeStatus");
    statusEl.textContent = "";
    statusEl.className = "form-status";

    const to = document.getElementById("composeTo").value.trim();
    const subject = document.getElementById("composeSubject").value.trim();
    const body = document.getElementById("composeBody").value.trim();

    if (!to || !body) {
      statusEl.textContent = "Destinataire et message requis.";
      statusEl.className = "form-status is-error";
      return;
    }

    try {
      const data = await api("/api/send", {
        method: "POST",
        body: JSON.stringify({ to, subject, body }),
      });

      // Destinataire externe (Gmail, Outlook…) → envoi réel via EmailJS
      if (!data.internal) {
        if (isExtConfigured()) {
          try {
            await sendExternalMail({ to, subject, body });
            statusEl.textContent = "✅ Envoyé à " + to + " (livraison externe !)";
            statusEl.className = "form-status is-success";
          } catch (extErr) {
            statusEl.textContent = "⚠️ Archivé en local, mais échec externe : " + extErr.message;
            statusEl.className = "form-status is-error";
            setTimeout(closeCompose, 2500);
            loadFolder(currentFolder);
            return;
          }
        } else {
          statusEl.textContent =
            "⚠️ Archivé localement. Configurez EmailJS (bouton ⚙️) pour livrer vers " + to + ".";
          statusEl.className = "form-status is-warn";
          setTimeout(closeCompose, 2500);
          loadFolder(currentFolder);
          return;
        }
      } else {
        statusEl.textContent = "✅ Message envoyé à " + to + " !";
        statusEl.className = "form-status is-success";
      }
      setTimeout(closeCompose, 900);
      loadFolder(currentFolder);
    } catch (err) {
      statusEl.textContent = "❌ " + err.message;
      statusEl.className = "form-status is-error";
    }
  });

  // Configuration EmailJS (envoi externe)
  updateExtStatus();

  document.getElementById("settingsBtn")?.addEventListener("click", openSettings);
  document.getElementById("settingsClose")?.addEventListener("click", closeSettings);
  document.getElementById("settingsOverlay")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("settingsOverlay")) closeSettings();
  });
  document.getElementById("settingsForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const cfg = readSettingsForm();
    saveExtConfig(cfg);
    const st = document.getElementById("settingsStatus");
    if (st) {
      st.textContent = "✅ Configuration enregistrée.";
      st.className = "form-status is-success";
    }
    updateExtStatus();
  });
  document.getElementById("testSendBtn")?.addEventListener("click", testEmailJsSend);

  // Déconnexion
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    try {
      await api("/api/logout", { method: "POST" });
    } catch (err) {}
    localStorage.removeItem("nexora_token");
    localStorage.removeItem("nexora_user");
    window.location.href = "login.html";
  });

  // Chargement initial
  loadFolder("inbox");
});