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
  fromEmail: "contact@nexora-mail-7fdk.onrender.com",
};

/*
  ⚠️ IMPORTANT — Configuration du template EmailJS (dashboard.emailjs.com) :
  
  Dans votre template EmailJS, onglet SETTINGS (pas Content), vous DEVEZ mettre :
  - To Email       → {{to_email}}      (variable dynamique, PAS d'adresse fixe !)
  - From Name      → {{from_name}}
  - Reply To       → {{reply_to}}
  - Subject        → {{subject}}
  
  Dans l'onglet CONTENT, utilisez ces variables :
  {{to_email}}, {{to_name}}, {{from_name}}, {{reply_to}}, {{subject}}, {{message}}
  
  Ainsi, quand vous saisissez un destinataire dans Nexora-Mail,
  l'e-mail partira vers CETTE adresse (pas une adresse pré-remplie).
*/