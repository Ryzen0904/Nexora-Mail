# 📬 Nexora-Mail

Messagerie professionnelle : landing page + connexion + boîte de réception + inscription avec plans (Free / Pro / Business) et paiement de démonstration.

## 🚀 Démarrer le serveur local (tests)

### Méthode 1 — Double-clic (recommandé)

1. Double-cliquez sur **`demarrer-serveur.bat`**
2. Votre navigateur s'ouvre sur **http://localhost:3000**
3. Pour arrêter : fermez la fenêtre noire, ou double-cliquez sur **`arreter-serveur.bat`**

### Méthode 2 — Terminal (Node)

```bash
cd chemin/vers/nexora-mail
set DATABASE_URL=postgresql://postgres:[VOTRE-MOT-DE-PASSE]@db.fybbcnrwbxswesnesjwc.supabase.co:5432/postgres
node server.js        # ou : npm start
```

Au premier démarrage avec `DATABASE_URL`, le serveur crée automatiquement les
tables PostgreSQL nécessaires (`users`, `mails`, `payments`) et importe les
données présentes dans `data/`. Ne committez jamais le mot de passe Supabase;
un modèle est disponible dans `.env.example`.

Puis ouvrez **http://localhost:3000**

## 🔑 Comptes de démonstration

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Fondatrice | `sophie.martin@nexora-mail.com` | `nexora123` |
| Fondateur | `arthur.robert@nexora-mail.com` | `nexora123` |

Vous pouvez aussi créer un compte via les tarifs (Free → gratuit, Pro/Business → paiement simulé avec la carte `4242 4242 4242 4242`).

## 📁 Structure

```
nexora-mail/
├── index.html              → page d'accueil (landing)
├── login.html              → connexion
├── inbox.html              → boîte de réception (+ envoyer, dossiers, recherche)
├── signup.html             → création de l'adresse e-mail
├── payment.html            → paiement simulé (Pro / Business)
├── mentions-legales.html   → mentions légales & CGU
├── css/                    → styles
├── js/                     → scripts (main, login, inbox, signup, payment)
├── server.js               → petit serveur Node + API locale (données dans data/)
├── data/                   → users.json, mails.json, payments.json (générés au 1er lancement)
├── demarrer-serveur.bat    → allume le serveur local (double-clic)
├── arreter-serveur.bat     → arrête le serveur local
├── package.json
└── netlify.toml            → config de déploiement Netlify
```

## ✉️ Envoyer de vrais e-mails (EmailJS → Gmail, Outlook…)

La boîte de réception gère **deux types d'envoi** :

- **Interne** : vers une autre boîte `@nexora-mail.com` → livraison immédiate dans sa boîte (aucune configuration).
- **Externe** : vers Gmail, Outlook, etc. → livraison via **EmailJS** (gratuit, ~200 e-mails/mois, fonctionne aussi en statique sur Netlify).

### Configurer EmailJS (3 minutes, gratuit)

1. Créez un compte sur **https://dashboard.emailjs.com**
2. **Email Services** → *Add New Service* → choisissez **Gmail** (ou Outlook/autre) → connectez la boîte qui enverra vos e-mails
3. **Email Templates** → *Create New Template* → dans le corps du modèle, ajoutez les variables :
   - `{{to_email}}`, `{{to_name}}`, `{{from_name}}`, `{{reply_to}}`
   - `{{subject}}`, `{{message}}`
4. Récupérez dans le dashboard : **Service ID**, **Template ID**, **Public Key**
5. Sur **http://localhost:3000/inbox.html** → cliquez sur le bouton **⚙️** (en haut à droite) → collez vos identifiants → « Enregistrer » → « Envoyer un test »
6. Vérifiez la réception du test dans votre boîte Gmail/Outlook

> Astuce : sur EmailJS, le service **Gmail** impose des limites SMTP ; pour de plus gros volumes, privilégiez un service dédié (EmailJS *SMTP Relay* ou un domaine vérifié).

Le statut « Envoi externe » (colonne de gauche de la boîte) passe de ⚠️ non configuré à ✅ actif une fois branché.

## 🌐 Mettre le site en ligne avec Netlify

> ⚠️ **Important** : le site est conçu autour d'un petit serveur Node (`server.js`)
> pour la connexion/inscription/boîte de réception.
> En déployant le dossier tel quel sur Netlify, **les pages s'affichent** (landing,
> mentions légales, formulaire de contact FormSubmit) mais **l'API (login / inbox) ne
> fonctionnera pas** tant que l'API n'est pas réécrite en *fonctions serverless*
> avec une vraie base de données.

### Option A — Netlify Drop (le plus simple pour un aperçu statique)
1. Aller sur **https://app.netlify.com/drop**
2. Glisser-déposer le dossier **`nexora-mail`**
3. C'est en ligne ! (adresse du type `https://xxx.netlify.app`)

### Option B — Git (recommandé pour la suite)
1. Pousser le projet sur GitHub
2. Nouveau site dans Netlify → *"Import from Git"*
3. Netlify lira automatiquement `netlify.toml`

### FormSubmit
Le formulaire de contact envoie vers FormSubmit. Au **premier test**, pensez à
activer le formulaire via l'e-mail de confirmation reçu sur `nexorateam306@gmail.com`.

## 🧪 Tester le formulaire de contact en local

Serveur allumé → http://localhost:3000 → section Contact →
remplir le formulaire → le message arrive dans la boîte Gmail de l'équipe.

## 📄 Licence

Usage personnel / démo. Les mentions légales et CGU sont dans `mentions-legales.html`.