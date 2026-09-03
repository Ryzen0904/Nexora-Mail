/* =========================================
   Nexora-Mail — Configuration EmailJS (publique)
   =========================================
   ⚠️  Ce fichier ne contient QUE des valeurs PUBLIQUES
      (clé API publique, Service ID, Template ID).
      La CLÉ SECRÈTE vit dans js/emailjs-secret.js
      (fichier local, exclu de Git ; à créer si absent).

   Utilisé pour pré-remplir la fenêtre ⚙️ de la boîte
   de réception → plus besoin de tout ressaisir.
   ========================================= */

window.NEXORA_EMAILJS = {
  // Clé API publique (dashboard.emailjs.com → Account → API)
  apiKey: "29dfb8f9d4d9d8ea048a72ee66a67f1e",
  serviceId: "service_4838zpc",
  templateId: "template_hx5g6ig",

  // Valeurs par défaut pour l'expéditeur (modifiables dans ⚙️)
  fromName: "Nexora-Mail",
  fromEmail: "contact@nexora-mail.com",
};