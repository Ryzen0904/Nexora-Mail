# Nexora-Mail 📬

Nexora-Mail est une plateforme de messagerie web légère et performante, construite avec un backend Node.js, une base de données Supabase et une interface moderne.

## 🚀 Fonctionnalités

- 🔐 **Authentification sécurisée** : Gestion de la connexion et de la base utilisateurs via Supabase.
- ✉️ **Gestion des e-mails** : Envoi et réception de messages avec stockage optimisé.
- ⚡ **Backend rapide** : API REST construite sur Node.js (`server.js`).
- 🎨 **Interface moderne** : Déployée sur Netlify pour un affichage fluide et rapide.
- 📧 **Envoi externe via EmailJS** : Envoi de vrais e-mails vers Gmail, Outlook, etc.

## ⚙️ Configuration EmailJS (Envoi externe)

Pour activer l'envoi de vrais e-mails vers des adresses externes (Gmail, Outlook, Yahoo, etc.) :

1. **Créez un compte** sur [dashboard.emailjs.com](https://dashboard.emailjs.com)
2. **Ajoutez un service** : Email → Gmail / Outlook / SMTP personnalisé
3. **Créez un template** avec ces variables dans l'onglet **Content** :
   - `{{to_email}}` — Email destinataire
   - `{{to_name}}` — Nom destinataire
   - `{{from_name}}` — Votre nom d'expéditeur
   - `{{reply_to}}` — Votre email de réponse
   - `{{subject}}` — Objet du message
   - `{{message}}` — Corps du message

4. **⚠️ CRITIQUE - Onglet Settings du template** :
   - **To Email** → `{{to_email}}` (pas d'adresse fixe !)
   - **From Name** → `{{from_name}}`
   - **Reply To** → `{{reply_to}}`
   - **Subject** → `{{subject}}`

5. **Récupérez vos identifiants** dans Account → API :
   - **Public Key** (Clé API)
   - **Private Key** (Clé API Secrète)
   - **Service ID** (ex: `service_abc123`)
   - **Template ID** (ex: `template_xyz789`)

6. **Configurez dans Nexora-Mail** : Boîte de réception → ⚙️ → collez les 4 identifiants + votre nom/email

## 🛠️ Stack Technique

- **Frontend** : HTML5, CSS3, JavaScript / Netlify
- **Backend** : Node.js, Express / Render
- **Base de données & Auth** : Supabase (PostgreSQL)

🔒 Licence
Tous droits réservés. Projet privé.
