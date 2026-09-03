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
  apiKey: "",
  serviceId: "",
  templateId: "",

  // Valeurs par défaut pour l'expéditeur (modifiables dans ⚙️)
  fromName: "Nexora-Mail",
  fromEmail: "contact@nexora-mail.com",
};