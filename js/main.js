                               /* =========================================
   Nexora-Mail — Interactions du site
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
  initHeaderScroll();
  initMobileMenu();
  initScrollSpy();
  initReveal();
  initPricingToggle();
  initContactForm();
  initFaq();
});

/* ---------- Header : ombre au scroll ---------- */
function initHeaderScroll() {
  const header = document.getElementById("header");
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 10);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ---------- Menu mobile ---------- */
function initMobileMenu() {
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("nav");
  if (!toggle || !nav) return;

  const setMenu = (open) => {
    toggle.classList.toggle("is-open", open);
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
  };

  toggle.addEventListener("click", () => {
    setMenu(!nav.classList.contains("is-open"));
  });

  // Fermer le menu après un clic sur un lien
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenu(false));
  });

  // Fermer avec la touche Échap
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenu(false);
  });
}

/* ---------- Scrollspy : lien actif dans la navigation ---------- */
function initScrollSpy() {
  const links = document.querySelectorAll('.nav__link[href^="#"]');
  if (!links.length) return;

  const sections = [...links]
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const setActive = (id) => {
    links.forEach((link) => {
      link.classList.toggle(
        "is-active",
        link.getAttribute("href") === `#${id}`
      );
    });
  };

  const onScroll = () => {
    const position = window.scrollY + 120;
    let currentId = sections[0]?.id;

    for (const section of sections) {
      if (section.offsetTop <= position) {
        currentId = section.id;
      }
    }

    // Section contact en bas de page
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 40) {
      const contact = document.getElementById("contact");
      if (contact) currentId = contact.id;
    }

    setActive(currentId);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ---------- Apparition au défilement ---------- */
function initReveal() {
  const elements = document.querySelectorAll(".reveal");
  if (!elements.length) return;

  if (!("IntersectionObserver" in window)) {
    elements.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  elements.forEach((el) => observer.observe(el));
}

/* ---------- Bascule tarifs mensuel / annuel ---------- */
function initPricingToggle() {
  const tabMensuel = document.getElementById("tabMensuel");
  const tabAnnuel = document.getElementById("tabAnnuel");
  const prices = document.querySelectorAll(".price-card__price[data-monthly]");
  if (!tabMensuel || !tabAnnuel || !prices.length) return;

  const applyMode = (annual) => {
    tabMensuel.classList.toggle("is-active", !annual);
    tabAnnuel.classList.toggle("is-active", annual);

    prices.forEach((el) => {
      const value = annual
        ? el.getAttribute("data-annual-total")
        : el.getAttribute("data-monthly");
      const annualMonthly = el.getAttribute("data-annually");
      const trial = el.getAttribute("data-trial");
      el.innerHTML = annual
        ? `${value} €<small>/an</small><span class="price-card__billing">${annualMonthly} € au mois • payé à l'année</span>`
        : `${value} €<small>/mois</small><span class="price-card__billing">${trial || ""}</span>`;
    });
  };

  tabMensuel.addEventListener("click", () => applyMode(false));
  tabAnnuel.addEventListener("click", () => applyMode(true));
  applyMode(false);
}

/* ---------- Formulaire de contact (envoi réel via FormSubmit.co) ---------- */
function initContactForm() {
  const form = document.getElementById("contactForm");
  const status = document.getElementById("formStatus");
  if (!form || !status) return;

  // Messages reçus sur : nexorateam306@gmail.com
  const ENDPOINT = "https://formsubmit.co/ajax/nexorateam306@gmail.com";

  const fields = {
    nom: form.elements.nom,
    email: form.elements.email,
    message: form.elements.message,
  };

  const submitBtn = form.querySelector('button[type="submit"]');

  const setInvalid = (field, invalid) => {
    field.classList.toggle("is-invalid", invalid);
  };

  const validateField = (name) => {
    const field = fields[name];
    if (!field) return true;

    if (name === "email") {
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(field.value.trim());
      setInvalid(field, !valid);
      return valid;
    }

    const valid = field.value.trim().length > 0;
    setInvalid(field, !valid);
    return valid;
  };

  Object.values(fields).forEach((field) => {
    field.addEventListener("input", () => {
      setInvalid(field, false);
      if (status.textContent.trim()) {
        status.textContent = "";
        status.className = "form-status";
      }
    });
    field.addEventListener("blur", () => {
      if (field.value.trim().length > 0) validateField(field.id);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const results = Object.keys(fields).map(validateField);
    const isValid = results.every(Boolean);

    if (!isValid) {
      status.textContent = "Merci de remplir correctement les champs obligatoires.";
      status.className = "form-status is-error";
      form.querySelector(".is-invalid")?.focus();
      return;
    }

    // Honeypot anti-spam : si rempli par un robot, on ignore silencieusement
    const honeypot = form.querySelector('input[name="_honey"]');
    if (honeypot && honeypot.value) return;

    submitBtn.disabled = true;
    status.textContent = "⏳ Envoi en cours…";
    status.className = "form-status";

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          "Nom complet": fields.nom.value.trim(),
          "Entreprise": form.elements.entreprise.value.trim(),
          "E-mail": fields.email.value.trim(),
          "Téléphone": form.elements.telephone.value.trim(),
          "Message": fields.message.value.trim(),
          _subject: "Nouveau message depuis le site Nexora-Mail",
          _template: "table",
          _captcha: "false",
        }),
      });

      const data = await res.json();

      if (res.ok && (data.success === "true" || data.success === true)) {
        status.textContent = "✅ Merci ! Votre message a bien été transmis. Nous vous répondrons sous 2 heures ouvrables.";
        status.className = "form-status is-success";
        form.reset();
      } else {
        // Affiche le vrai message renvoyé par FormSubmit (ex. formulaire à activer)
        const detail = data.message || "Réponse inattendue";
        status.textContent = "❌ " + detail;
        status.className = "form-status is-error";
      }
    } catch (err) {
      status.textContent = "❌ Une erreur est survenue lors de l'envoi. Merci de réessayer dans quelques instants.";
      status.className = "form-status is-error";
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ---------- FAQ : fermer les autres items ---------- */
function initFaq() {
  const items = document.querySelectorAll(".faq__item");
  if (!items.length) return;

  items.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      items.forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });
}