/* =========================================
   Nexora-Mail — Serveur local (Node.js)
   Usage   : node server.js
   Adresse : http://localhost:3000

   Routes API :
     POST /api/login            {email, password}
     GET  /api/me               → utilisateur connecté
     POST /api/logout
     GET  /api/inbox?folder=inbox
     POST /api/mail/:id/read    {read: true|false}
     POST /api/send             {to, subject, body}
   ========================================= */

require("dotenv").config({ override: true });
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const Stripe = require("stripe");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const MAILS_FILE = path.join(DATA_DIR, "mails.json");
const PAYMENTS_FILE = path.join(DATA_DIR, "payments.json");
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const APP_URL = process.env.APP_URL || "https://nexora-mail-7fdk.onrender.com";
const STRIPE_PRICES = {
  pro: {
    monthly: "price_1UBM7ACep0LEOT6UIfDDdeKq",
    annual: "price_1UBKyRCep0LEOT6Uh4TslusH",
  },
  business: {
    monthly: "price_1UBL32Cep0LEOT6UtWySVnDK",
    annual: "price_1UBL48Cep0LEOT6UgJpGpbP5",
  },
};
const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

/* ---------- Helpers fichiers JSON ---------- */

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

async function query(sql, values = []) {
  if (!pool) return null;
  return pool.query(sql, values);
}

async function initDatabase() {
  if (!pool) return;
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT NOT NULL,
      salt TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL,
      plan TEXT DEFAULT 'free', created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mails (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, folder TEXT NOT NULL,
      sender JSONB NOT NULL, recipient TEXT NOT NULL, subject TEXT NOT NULL,
      body TEXT NOT NULL, sent_at TIMESTAMPTZ NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, plan TEXT NOT NULL, billing TEXT NOT NULL,
      amount TEXT NOT NULL, approved BOOLEAN NOT NULL DEFAULT FALSE,
      used BOOLEAN NOT NULL DEFAULT FALSE, paid_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  const [{ rows: userRows }, { rows: mailRows }, { rows: paymentRows }] = await Promise.all([
    query("SELECT email FROM users LIMIT 1"),
    query("SELECT id FROM mails LIMIT 1"),
    query("SELECT id FROM payments LIMIT 1"),
  ]);
  if (!userRows.length) {
    for (const user of readJSON(USERS_FILE) || []) await query(
      "INSERT INTO users (email,name,avatar,salt,password,role,plan,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
      [user.email, user.name, user.avatar, user.salt, user.password, user.role, user.plan || "free", user.createdAt || new Date()]
    );
  }
  if (!mailRows.length) {
    for (const mail of readJSON(MAILS_FILE) || []) await query(
      "INSERT INTO mails (id,owner,folder,sender,recipient,subject,body,sent_at,is_read) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING",
      [mail.id, mail.owner, mail.folder, mail.from, mail.to, mail.subject, mail.body, mail.date, mail.read]
    );
  }
  if (!paymentRows.length) {
    for (const payment of readJSON(PAYMENTS_FILE) || []) await query(
      "INSERT INTO payments (id,plan,billing,amount,approved,used,paid_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
      [payment.id, payment.plan, payment.billing, payment.amount, payment.approved, payment.used, payment.date]
    );
  }
}

async function getUsers() {
  if (!pool) return readJSON(USERS_FILE) || [];
  const { rows } = await query('SELECT email,name,avatar,salt,password,role,plan,created_at AS "createdAt" FROM users');
  return rows;
}

async function getMails() {
  if (!pool) return readJSON(MAILS_FILE) || [];
  const { rows } = await query('SELECT id,owner,folder,sender AS "from",recipient AS "to",subject,body,sent_at AS date,is_read AS read FROM mails');
  return rows;
}

async function getPayments() {
  if (!pool) return readJSON(PAYMENTS_FILE) || [];
  const { rows } = await query('SELECT id,plan,billing,amount,approved,used,paid_at AS date FROM payments');
  return rows;
}

async function saveMails(mails) {
  if (!pool) return writeJSON(MAILS_FILE, mails);
  await query("DELETE FROM mails");
  for (const mail of mails) await query(
    "INSERT INTO mails (id,owner,folder,sender,recipient,subject,body,sent_at,is_read) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [mail.id, mail.owner, mail.folder, mail.from, mail.to, mail.subject, mail.body, mail.date, mail.read]
  );
}

async function saveUsers(users) {
  if (!pool) return writeJSON(USERS_FILE, users);
  const user = users[users.length - 1];
  await query("INSERT INTO users (email,name,avatar,salt,password,role,plan,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [user.email, user.name, user.avatar, user.salt, user.password, user.role, user.plan, user.createdAt]);
}

async function savePayments(payments) {
  if (!pool) return writeJSON(PAYMENTS_FILE, payments);
  const payment = payments[payments.length - 1];
  await query("INSERT INTO payments (id,plan,billing,amount,approved,used,paid_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET used = EXCLUDED.used",
    [payment.id, payment.plan, payment.billing, payment.amount, payment.approved, payment.used, payment.date]);
}

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(salt + password).digest("hex");
}

/* ---------- Données de démo (générées au 1er lancement) ---------- */

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // Comptes de démonstration
  if (!fs.existsSync(USERS_FILE)) {
    const salt = "nexora-demo-salt";
    const users = [
      {
        email: "sophie.martin@nexora-mail.com",
        name: "Sophie Martin",
        avatar: "SM",
        salt,
        password: hashPassword("nexora123", salt),
        role: "fondateur",
      },
      {
        email: "arthur.robert@nexora-mail.com",
        name: "Arthur Robert",
        avatar: "AR",
        salt,
        password: hashPassword("nexora123", salt),
        role: "fondateur",
      },
    ];
    writeJSON(USERS_FILE, users);
  }

  // Boîtes mail de démo
  if (!fs.existsSync(MAILS_FILE)) {
    const now = Date.now();
    const h = 3600 * 1000; // 1 heure en ms
    const d = (x) => new Date(now - x).toISOString();

    const mails = [
      // ---- Boîte de Sophie ----
      {
        id: "s1",
        owner: "sophie.martin@nexora-mail.com",
        folder: "inbox",
        from: { name: "Arthur Robert", email: "arthur.robert@nexora-mail.com" },
        to: "sophie.martin@nexora-mail.com",
        subject: "RDV demain à 9h30 — salle Nexus",
        body: "Bonjour Sophie,\n\nPetit rappel : le point équipe est demain à 9h30 en salle Nexus.\nMerci de confirmer ta présence.\n\nArthur",
        date: d(2 * h),
        read: false,
      },
      {
        id: "s2",
        owner: "sophie.martin@nexora-mail.com",
        folder: "inbox",
        from: { name: "Chloé Laurent", email: "chloe.laurent@oentreprise.fr" },
        to: "sophie.martin@nexora-mail.com",
        subject: "Devis révisé joint",
        body: "Sophie,\n\nVoici la version révisée du devis avec les corrections demandées.\nDis-moi ce que tu en penses !\n\nChloé",
        date: d(5 * h),
        read: false,
      },
      {
        id: "s3",
        owner: "sophie.martin@nexora-mail.com",
        folder: "inbox",
        from: { name: "Léa Simon", email: "lea.simon@oentreprise.fr" },
        to: "sophie.martin@nexora-mail.com",
        subject: "Partage du document stratégique",
        body: "Bonjour,\n\nVous trouverez ci-joint notre document stratégique pour l'année à venir.\nBonne lecture !\n\nL'équipe",
        date: d(1 * h + 30 * 60 * 1000),
        read: true,
      },
      {
        id: "s4",
        owner: "sophie.martin@nexora-mail.com",
        folder: "sent",
        from: { name: "Sophie Martin", email: "sophie.martin@nexora-mail.com" },
        to: "arthur.robert@nexora-mail.com",
        subject: "Re: RDV demain à 9h30 — salle Nexus",
        body: "Présente, à demain !\n\nSophie",
        date: d(1 * h),
        read: true,
      },
      {
        id: "s5",
        owner: "sophie.martin@nexora-mail.com",
        folder: "drafts",
        from: { name: "Sophie Martin", email: "sophie.martin@nexora-mail.com" },
        to: "lea.simon@oentreprise.fr",
        subject: "Brouillon — Proposition commerciale",
        body: "Bonjour Léa,\n\nSuite à nos échanges, voici notre proposition commerciale…",
        date: d(20 * h),
        read: false,
      },
      {
        id: "s6",
        owner: "sophie.martin@nexora-mail.com",
        folder: "spam",
        from: { name: "Offre Promo", email: "promo@solde-avantage.fr" },
        to: "sophie.martin@nexora-mail.com",
        subject: "Gagnez un bon cadeau !",
        body: "Cliquez vite pour récupérer votre bon cadeau de 500 €.",
        date: d(8 * h),
        read: false,
      },
      {
        id: "s7",
        owner: "sophie.martin@nexora-mail.com",
        folder: "trash",
        from: { name: "Newsletter", email: "news@ecommerce.fr" },
        to: "sophie.martin@nexora-mail.com",
        subject: "Votre panier vous attend",
        body: "Il vous reste des articles dans votre panier…",
        date: d(12 * h),
        read: true,
      },
    ];
    writeJSON(MAILS_FILE, mails);
  }
}

/* ---------- Sessions (simple, en mémoire) ---------- */

const sessions = new Map(); // token -> email

function createSession(email) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, email);
  return token;
}

function getEmailFromToken(req) {
  const header = req.headers["authorization"] || "";
  const m = header.match(/^Bearer\s+(.+)$/);
  if (!m) return null;
  const token = m[1].trim();
  return sessions.has(token) ? sessions.get(token) : null;
}

function getToken(req) {
  const header = req.headers["authorization"] || "";
  const m = header.match(/^Bearer\s+(.+)$/);
  return m ? m[1].trim() : null;
}

async function findUser(email) {
  const users = await getUsers();
  return users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
}

/* ---------- Helpers de réponse ---------- */

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function publicUser(u) {
  return { name: u.name, email: u.email, avatar: u.avatar, role: u.role, plan: u.plan || "free" };
}

/* ---------- Routes API ---------- */

async function handleApi(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;

  // POST /api/login
  if (pathname === "/api/login" && method === "POST") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const user = await findUser(email);
    if (!user || hashPassword(password, user.salt) !== user.password) {
      return sendJSON(res, 401, { error: "Adresse e-mail ou mot de passe incorrect." });
    }

    const token = createSession(user.email);
    return sendJSON(res, 200, { token, user: publicUser(user) });
  }

  // GET /api/me
  if (pathname === "/api/me" && method === "GET") {
    const email = getEmailFromToken(req);
    if (!email) return sendJSON(res, 401, { error: "Non connecté" });
    const user = await findUser(email);
    if (!user) return sendJSON(res, 401, { error: "Utilisateur introuvable" });
    return sendJSON(res, 200, { user: publicUser(user) });
  }

  // POST /api/logout
  if (pathname === "/api/logout" && method === "POST") {
    const token = getToken(req);
    if (token) sessions.delete(token);
    return sendJSON(res, 200, { ok: true });
  }

  // GET /api/inbox?folder=inbox
  if (pathname === "/api/inbox" && method === "GET") {
    const email = getEmailFromToken(req);
    if (!email) return sendJSON(res, 401, { error: "Non connecté" });
    const folder = url.searchParams.get("folder") || "inbox";
    const mails = await getMails();
    const all = mails.filter((m) => m.owner.toLowerCase() === email.toLowerCase());
    const counts = {};
    ["inbox", "sent", "drafts", "spam", "trash"].forEach((f) => {
      counts[f] = all.filter((m) => m.folder === f).length;
    });
    counts.unread = all.filter((m) => m.folder === "inbox" && !m.read).length;
    const list = all
      .filter((m) => m.folder === folder)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return sendJSON(res, 200, { folder, mails: list, counts });
  }

  // POST /api/mail/:id/read  {read: bool}
  const readMatch = pathname.match(/^\/api\/mail\/([^/]+)\/read$/);
  if (readMatch && method === "POST") {
    const email = getEmailFromToken(req);
    if (!email) return sendJSON(res, 401, { error: "Non connecté" });
    const body = await readBody(req);
    const mails = await getMails();
    const mail = mails.find((m) => m.id === readMatch[1]);
    if (!mail || mail.owner.toLowerCase() !== email.toLowerCase()) {
      return sendJSON(res, 404, { error: "Message introuvable" });
    }
    mail.read = body.read === true;
    await saveMails(mails);
    return sendJSON(res, 200, { ok: true });
  }

  // POST /api/send  {to, subject, body}
  if (pathname === "/api/send" && method === "POST") {
    const email = getEmailFromToken(req);
    if (!email) return sendJSON(res, 401, { error: "Non connecté" });
    const body = await readBody(req);
    const to = String(body.to || "").trim().toLowerCase();
    const subject = String(body.subject || "").trim() || "(sans objet)";
    const content = String(body.body || "").trim();

    if (!to || !content) {
      return sendJSON(res, 400, { error: "Destinataire et message requis." });
    }

    const sender = await findUser(email);
    const mails = await getMails();
    const id = "m" + crypto.randomBytes(6).toString("hex");
    const nowIso = new Date().toISOString();

    mails.push({
      id,
      owner: sender.email,
      folder: "sent",
      from: { name: sender.name, email: sender.email },
      to,
      subject,
      body: content,
      date: nowIso,
      read: true,
    });

    // Si le destinataire est un compte Nexora, on dépose dans sa boîte de réception
    const target = await findUser(to);
    if (target) {
      mails.push({
        id: "i" + crypto.randomBytes(6).toString("hex"),
        owner: target.email,
        folder: "inbox",
        from: { name: sender.name, email: sender.email },
        to,
        subject,
        body: content,
        date: nowIso,
        read: false,
      });
    }

    await saveMails(mails);
    return sendJSON(res, 200, { ok: true, id, internal: Boolean(target) });
  }

  // POST /api/register  {firstname, lastname, password, plan}
  if (pathname === "/api/register" && method === "POST") {
    const body = await readBody(req);
    const first = String(body.firstname || "").trim();
    const last = String(body.lastname || "").trim();
    const password = String(body.password || "");
    const plan = String(body.plan || "free").toLowerCase();

    const firstName = first[0] ? first[0].toUpperCase() + first.slice(1).toLowerCase() : "";
    const lastName = last[0] ? last[0].toUpperCase() + last.slice(1).toLowerCase() : "";

    if (!firstName || !lastName) {
      return sendJSON(res, 400, { error: "Prénom et nom sont obligatoires." });
    }
    if (password.length < 6) {
      return sendJSON(res, 400, { error: "Le mot de passe doit contenir au moins 6 caractères." });
    }
    if (!["free", "pro", "business"].includes(plan)) {
      return sendJSON(res, 400, { error: "Plan invalide." });
    }

    // Les plans payants nécessitent un paiement validé, non utilisé
    if (plan !== "free") {
      const payId = String(body.payment || "").trim();
      if (!payId) {
        return sendJSON(res, 400, { error: "Le paiement est requis pour ce plan." });
      }
      if (!stripe) return sendJSON(res, 503, { error: "Paiement Stripe non configuré." });
      let session;
      try {
        session = await stripe.checkout.sessions.retrieve(payId);
      } catch {
        return sendJSON(res, 400, { error: "Session de paiement Stripe invalide." });
      }
      const payments = await getPayments();
      const pay = payments.find((p) => p.id === payId);
      if (!pay || pay.used || session.payment_status !== "paid" || session.metadata?.plan !== plan) {
        return sendJSON(res, 400, { error: "Paiement introuvable ou déjà utilisé." });
      }
      pay.used = true;
      pay.approved = true;
      await savePayments(payments);
    }

    const slug = (s) =>
      String(s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "");

    const users = await getUsers();
    const base = slug(firstName) + "." + slug(lastName);
    let email = base + "@nexora-mail.com";
    let suffix = 2;
    while (users.some((u) => u.email.toLowerCase() === email)) {
      email = base + suffix + "@nexora-mail.com";
      suffix++;
    }

    const salt = "nexora-salt-" + crypto.randomBytes(8).toString("hex");
    const avatar = (firstName[0] + lastName[0]).toUpperCase();
    users.push({
      email,
      name: firstName + " " + lastName,
      avatar,
      salt,
      password: hashPassword(password, salt),
      role: "client",
      plan,
      createdAt: new Date().toISOString(),
    });
    await saveUsers(users);

    // E-mail de bienvenue dans la boîte du nouveau compte
    const mails = await getMails();
    const welcomeSubject = "Bienvenue dans votre boîte " + email;
    mails.push({
      id: "w" + crypto.randomBytes(6).toString("hex"),
      owner: email,
      folder: "inbox",
      from: { name: "Équipe Nexora-Mail", email: "contact@nexora-mail.com" },
      to: email,
      subject: welcomeSubject,
      body:
        "Bonjour " + firstName + ",\n\n" +
        "Félicitations, votre adresse " + email + " est active !\n" +
        "Vous êtes sur le plan " + plan.toUpperCase() + ".\n\n" +
        "Connectez-vous dès maintenant pour découvrir votre boîte de réception.\n\n" +
        "L'équipe Nexora-Mail",
      date: new Date().toISOString(),
      read: false,
    });
    await saveMails(mails);

    return sendJSON(res, 200, { email, plan, name: firstName + " " + lastName });
  }

  // POST /api/pay  {plan, billing} → crée une session Stripe Checkout
  if (pathname === "/api/pay" && method === "POST") {
    const body = await readBody(req);
    const plan = String(body.plan || "").toLowerCase();
    const billing = String(body.billing || "monthly").toLowerCase();
    const priceId = STRIPE_PRICES[plan]?.[billing];
    if (!priceId) {
      return sendJSON(res, 400, { error: "Plan de paiement invalide." });
    }
    if (!stripe) return sendJSON(res, 503, { error: "Paiement Stripe non configuré sur Render." });

    try {
      const stripePrice = await stripe.prices.retrieve(priceId);
      if (!stripePrice.active || !stripePrice.recurring) {
        return sendJSON(res, 400, { error: "Le tarif Stripe doit être actif et récurrent." });
      }
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: APP_URL + "/signup.html?plan=" + plan + "&payment={CHECKOUT_SESSION_ID}",
        cancel_url: APP_URL + "/payment.html?plan=" + plan,
        metadata: { plan, billing },
        subscription_data: { metadata: { plan, billing } },
      });
      const payments = await getPayments();
      payments.push({
        id: session.id,
        plan,
        billing,
        amount: priceId,
        approved: false,
        used: false,
        date: new Date().toISOString(),
      });
      await savePayments(payments);
      return sendJSON(res, 200, { checkoutUrl: session.url });
    } catch (error) {
      console.error("Stripe Checkout error:", error.message);
      return sendJSON(res, 502, { error: "Stripe: " + error.message });
    }
  }

  // GET /api/payment/:id → vérifie qu'un paiement est valable (approuvé, non utilisé)
  const payCheckMatch = pathname.match(/^\/api\/payment\/([^/]+)$/);
  if (payCheckMatch && method === "GET") {
    const payments = await getPayments();
    const pay = payments.find((p) => p.id === payCheckMatch[1]);
    if (!pay || pay.used || !stripe) {
      return sendJSON(res, 200, { valid: false });
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(pay.id);
      const paid = session.payment_status === "paid" && session.metadata?.plan === pay.plan;
      return sendJSON(res, 200, { valid: paid, plan: pay.plan, billing: pay.billing, amount: pay.amount });
    } catch {
      return sendJSON(res, 200, { valid: false });
    }
  }

  return sendJSON(res, 404, { error: "Route API inconnue" });
}

/* ---------- Fichiers statiques ---------- */

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("500 — Erreur serveur");
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  let url;
  try {
    url = new URL(req.url, `http://localhost:${PORT}`);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("400 — Requête invalide");
    return;
  }

  const pathname = decodeURIComponent(url.pathname);

  // Routes API
  if (pathname.startsWith("/api/")) {
    return handleApi(req, res, url);
  }

  const target = pathname === "/" ? "/index.html" : pathname;
  let filePath = path.normalize(path.join(ROOT, target));

  // Protection anti traversée de dossier
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 — Accès refusé");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) return serveFile(filePath, res);

    // Si c'est un dossier, tente son index.html
    fs.stat(path.join(filePath, "index.html"), (err2, stats2) => {
      if (err2 || !stats2.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 — Fichier introuvable");
        return;
      }
      serveFile(path.join(filePath, "index.html"), res);
    });
  });
});

/* ---------- Démarrage ---------- */

if (require.main === module) {
  ensureData();
  initDatabase().then(() => server.listen(PORT, HOST, () => {
    console.log("\n  ✅ Nexora-Mail est en ligne en local : http://localhost:" + PORT);
    console.log("  🔑 Comptes démo : sophie.martin@nexora-mail.com  /  nexora123");
    console.log("  📬 Connexion : http://localhost:" + PORT + "/login.html\n");
  })).catch((error) => {
    console.error("Impossible d'initialiser PostgreSQL:", error.message);
    process.exit(1);
  });
}

module.exports = { server, ensureData };