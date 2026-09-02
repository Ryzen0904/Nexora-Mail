/* =========================================
   Nexora-Mail — Inscription (signup.js)
   ========================================= */

const PLAN_NAMES = {
  free: "Free (0 €/mois)",
  pro: "Pro (2,90 €/mois)",
  business: "Business (5,90 €/mois)",
  business_test: "Business TEST (essai gratuit)",
};

function slug(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function computeEmail() {
  const first = document.getElementById("firstname").value.trim();
  const last = document.getElementById("lastname").value.trim();
  if (!first && !last) return "prenom.nom@nexora-mail.com";
  const local = [slug(first), slug(last)].filter(Boolean).join(".");
  return (local.length ? local : "prenom.nom") + "@nexora-mail.com";
}

function updatePreview() {
  const preview = document.getElementById("emailPreview").querySelector(".email-preview__addr");
  preview.textContent = computeEmail();
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const plan = ["free", "pro", "business", "business_test"].includes(params.get("plan"))
    ? params.get("plan")
    : "free";
  const paymentId = params.get("payment") || "";

  document.getElementById("planLabel").innerHTML =
    "Plan choisi : <strong>" + PLAN_NAMES[plan] + "</strong>";

  // Plans payants : un paiement validé est obligatoire
  if (plan !== "free") {
    if (!paymentId) {
      document.getElementById("signupForm").hidden = true;
      document.getElementById("signupStatus").textContent =
        "❌ Le paiement est requis pour ce plan. Retournez aux tarifs.";
      document.getElementById("signupStatus").className = "form-status is-error";
      return;
    }
    // Vérifier que le paiement est valide côté serveur avant d'afficher le formulaire
    fetch(window.NEXORA_API_BASE + "/api/payment/" + encodeURIComponent(paymentId))
      .then((r) => r.json())
      .then((data) => {
        if (!data.valid) {
          document.getElementById("signupForm").hidden = true;
          document.getElementById("signupStatus").textContent =
            "❌ Paiement introuvable ou déjà utilisé. Retournez aux tarifs.";
          document.getElementById("signupStatus").className = "form-status is-error";
        }
      })
      .catch(() => {});
  } else {
    document.getElementById("paymentBadge")?.remove();
  }

  const first = document.getElementById("firstname");
  const last = document.getElementById("lastname");
  first.addEventListener("input", updatePreview);
  last.addEventListener("input", updatePreview);

  const form = document.getElementById("signupForm");
  const status = document.getElementById("signupStatus");
  const btn = document.getElementById("signupBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    status.className = "form-status";

    const firstname = first.value.trim();
    const lastname = last.value.trim();
    const password = document.getElementById("password").value;

    if (!firstname || !lastname) {
      status.textContent = "Merci de renseigner votre prénom et votre nom.";
      status.className = "form-status is-error";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Création en cours…";

    try {
      const res = await fetch(window.NEXORA_API_BASE + "/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstname, lastname, password, plan, payment: paymentId }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erreur lors de la création.");

      // Succès : masquer le formulaire, afficher la confirmation
      form.hidden = true;
      document.getElementById("emailPreview").hidden = true;
      document.getElementById("successEmail").textContent = data.email;
      document.getElementById("signupSuccess").hidden = false;
    } catch (err) {
      status.textContent = "❌ " + err.message;
      status.className = "form-status is-error";
    } finally {
      btn.disabled = false;
      btn.textContent = "Créer mon e-mail";
    }
  });
});