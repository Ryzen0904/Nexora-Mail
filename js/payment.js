/* =========================================
   Nexora-Mail — Paiement (payment.js)
   ========================================= */

const PLAN_INFO = {
  pro: {
    name: "Pro",
    desc: "Pour les indépendants et les petites équipes.",
    monthly: "2,90",
    annual: "2,32",
    annualTotal: "27,84",
  },
  business: {
    name: "Business",
    desc: "Pour les entreprises en croissance.",
    monthly: "5,90",
    annual: "4,72",
    annualTotal: "56,64",
  },
  business_test: {
    name: "Business TEST",
    desc: "Pour tester l'essai gratuit Business.",
    monthly: "0",
    annual: "0",
    annualTotal: "0",
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
    <p class="pay-summary__price">${formatPrice(billing === "annual" ? info.annualTotal : info.monthly)}<small>/${billing === "annual" ? "an" : "mois"}</small></p>
    <p class="pay-summary__billing">${billing === "annual" ? "Facturé en une seule fois chaque année" : "Facturé mensuellement, sans engagement"}</p>
  `;
  document.getElementById("payAmount").textContent = "— " + formatPrice(billing === "annual" ? info.annualTotal : info.monthly);
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  PLAN = ["pro", "business", "business_test"].includes(params.get("plan")) ? params.get("plan") : "pro";

  renderSummary();

  if (PLAN === "business_test") document.getElementById("tabAnnual").hidden = true;

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

    btn.disabled = true;
    btn.textContent = "Redirection vers Stripe…";
    status.textContent = "⏳ Ouverture du paiement sécurisé…";
    status.className = "form-status";

    try {
      const res = await fetch(window.NEXORA_API_BASE + "/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: PLAN, billing }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Paiement refusé.");

      if (!data.checkoutUrl) throw new Error("Lien de paiement indisponible.");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      status.textContent = "❌ " + err.message;
      status.className = "form-status is-error";
    } finally {
      btn.disabled = false;
      btn.textContent = "Payer avec Stripe — " + formatPrice(billing === "annual" ? PLAN_INFO[PLAN].annualTotal : PLAN_INFO[PLAN].monthly);
    }
  });
});