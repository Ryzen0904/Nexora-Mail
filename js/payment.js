/* =========================================
   Nexora-Mail — Paiement (payment.js)
   ========================================= */

const PLAN_INFO = {
  pro: {
    name: "Pro",
    desc: "Pour les indépendants et les petites équipes.",
    monthly: "2,90",
    annual: "2,32",
  },
  business: {
    name: "Business",
    desc: "Pour les entreprises en croissance.",
    monthly: "5,90",
    annual: "4,72",
  },
};

let billing = "monthly";

function formatPrice(amount) {
  return amount.replace(".", ",") + " €";
}

function renderSummary() {
  const info = PLAN_INFO[PLAN];
  if (!info) return;
  document.getElementById("paySummary").innerHTML = `
    <p class="pay-summary__plan">${info.name}</p>
    <p class="pay-summary__desc">${info.desc}</p>
    <p class="pay-summary__price">${formatPrice(billing === "annual" ? info.annual : info.monthly)}<small>/mois</small></p>
    <p class="pay-summary__billing">${billing === "annual" ? "Facturé annuellement (soit " + formatPrice((Number(info.annual.replace(",", ".")) * 12).toFixed(2).replace(".", ",")) + " / an)" : "Facturé mensuellement, sans engagement"}</p>
  `;
  document.getElementById("payAmount").textContent = "— " + formatPrice(billing === "annual" ? info.annual : info.monthly);
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  PLAN = ["pro", "business"].includes(params.get("plan")) ? params.get("plan") : "pro";

  renderSummary();

  // Bascule mensuel / annuel
  const tabMonthly = document.getElementById("tabMonthly");
  const tabAnnual = document.getElementById("tabAnnual");
  tabMonthly.addEventListener("click", () => {
    billing = "monthly";
    tabMonthly.classList.add("is-active");
    tabAnnual.classList.remove("is-active");
    renderSummary();
  });
  tabAnnual.addEventListener("click", () => {
    billing = "annual";
    tabAnnual.classList.add("is-active");
    tabMonthly.classList.remove("is-active");
    renderSummary();
  });

  const form = document.getElementById("payForm");
  const status = document.getElementById("payStatus");
  const btn = document.getElementById("payBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    status.className = "form-status";

    const cardName = form.elements.cardName.value.trim();
    const cardNumber = form.elements.cardNumber.value.replace(/\s+/g, "");
    const exp = form.elements.cardExp.value.trim();
    const cvc = form.elements.cardCvc.value.trim();

    // Validation simple de la carte (démo)
    if (!cardName || !cardNumber || !exp || !cvc) {
      status.textContent = "Merci de remplir tous les champs de la carte.";
      status.className = "form-status is-error";
      return;
    }
    if (!/^\d{12,19}$/.test(cardNumber)) {
      status.textContent = "Numéro de carte invalide.";
      status.className = "form-status is-error";
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(exp)) {
      status.textContent = "Date d'expiration invalide (format MM/AA).";
      status.className = "form-status is-error";
      return;
    }
    if (!/^\d{3,4}$/.test(cvc)) {
      status.textContent = "CVC invalide.";
      status.className = "form-status is-error";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Paiement en cours…";
    status.textContent = "⏳ Traitement du paiement…";
    status.className = "form-status";

    try {
      const res = await fetch(window.NEXORA_API_BASE + "/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: PLAN, billing }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Paiement refusé.");

      // Paiement validé → redirection vers la création de l'e-mail
      status.textContent = "✅ Paiement validé !";
      status.className = "form-status is-success";
      setTimeout(() => {
        window.location.href = "signup.html?plan=" + PLAN + "&payment=" + data.paymentId;
      }, 700);
    } catch (err) {
      status.textContent = "❌ " + err.message;
      status.className = "form-status is-error";
    } finally {
      btn.disabled = false;
      btn.textContent = "Payer — " + formatPrice(billing === "annual" ? PLAN_INFO[PLAN].annual : PLAN_INFO[PLAN].monthly);
    }
  });
});