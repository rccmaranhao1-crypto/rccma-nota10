import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

if (!DATABASE_URL) {
  console.error("Missing env DATABASE_URL");
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error("Missing env JWT_SECRET");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ---------- DB init ----------
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      whatsapp TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      whatsapp TEXT UNIQUE,
      grupo TEXT,
      paroquia TEXT,
      cidade TEXT,
      status TEXT NOT NULL DEFAULT 'ATIVO',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS donations (
      id SERIAL PRIMARY KEY,
      donor_name TEXT,
      donor_whatsapp TEXT,
      amount_cents INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'PIX',
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      price_cents INTEGER NOT NULL,
      image_url TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      buyer_name TEXT,
      buyer_whatsapp TEXT,
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      total_cents INTEGER NOT NULL,
      items_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at);
    CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
  `);

  // seed admin user
  const ADMIN_NAME = process.env.ADMIN_NAME || "ADMIN MASTER";
  const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP || "99982477467";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ucra01";

  const adminCheck = await pool.query("SELECT id FROM users WHERE whatsapp = $1", [ADMIN_WHATSAPP]);
  if (adminCheck.rows.length === 0) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await pool.query(
      "INSERT INTO users (nome, whatsapp, senha, role) VALUES ($1,$2,$3,$4)",
      [ADMIN_NAME, ADMIN_WHATSAPP, hash, "ADMIN"]
    );
    console.log("Admin criado:", ADMIN_WHATSAPP);
  }
}

initDB().catch((e) => {
  console.error("DB init error:", e);
  process.exit(1);
});

// ---------- Helpers ----------
function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, whatsapp: user.whatsapp, nome: user.nome },
    JWT_SECRET,
    { expiresIn: "1d" }
  );
}

function auth(requiredRole = null) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Sem token" });

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      if (requiredRole && payload.role !== requiredRole) {
        return res.status(403).json({ message: "Sem permissão" });
      }
      return next();
    } catch {
      return res.status(401).json({ message: "Token inválido" });
    }
  };
}

function centsFromBRL(value) {
  // accepts "10", "10.50", "10,50"
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

// ---------- API ----------
app.get("/api/health", async (_req, res) => {
  try {
    const r = await pool.query("SELECT 1 as ok");
    res.json({ ok: true, db: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: "db" });
  }
});

// Auth
app.post("/api/auth/register", async (req, res) => {
  const { nome, whatsapp, senha } = req.body || {};
  if (!nome || !whatsapp || !senha) {
    return res.status(400).json({ message: "Campos obrigatórios: nome, whatsapp, senha" });
  }

  try {
    const hash = await bcrypt.hash(String(senha), 10);
    const q = await pool.query(
      "INSERT INTO users (nome, whatsapp, senha, role) VALUES ($1,$2,$3,'USER') RETURNING id,nome,whatsapp,role",
      [String(nome).trim(), String(whatsapp).trim(), hash]
    );
    const token = signToken(q.rows[0]);
    return res.json({ token, user: q.rows[0] });
  } catch (e) {
    if (String(e?.message || "").includes("duplicate key")) {
      return res.status(409).json({ message: "WhatsApp já cadastrado" });
    }
    console.error(e);
    return res.status(500).json({ message: "Erro ao cadastrar" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { whatsapp, senha } = req.body || {};
  if (!whatsapp || !senha) return res.status(400).json({ message: "Informe whatsapp e senha" });

  const user = await pool.query("SELECT * FROM users WHERE whatsapp = $1", [String(whatsapp).trim()]);
  if (user.rows.length === 0) return res.status(401).json({ message: "Usuário não encontrado" });

  const valid = await bcrypt.compare(String(senha), user.rows[0].senha);
  if (!valid) return res.status(401).json({ message: "Senha inválida" });

  const payloadUser = {
    id: user.rows[0].id,
    nome: user.rows[0].nome,
    whatsapp: user.rows[0].whatsapp,
    role: user.rows[0].role
  };

  return res.json({ token: signToken(payloadUser), user: payloadUser });
});

// Members (admin)
app.get("/api/admin/members", auth("ADMIN"), async (req, res) => {
  const { q } = req.query;
  const like = q ? `%${String(q).trim()}%` : null;

  const result = like
    ? await pool.query(
        "SELECT * FROM members WHERE nome ILIKE $1 OR whatsapp ILIKE $1 OR grupo ILIKE $1 OR cidade ILIKE $1 ORDER BY created_at DESC LIMIT 500",
        [like]
      )
    : await pool.query("SELECT * FROM members ORDER BY created_at DESC LIMIT 500");

  res.json({ items: result.rows });
});

app.post("/api/admin/members", auth("ADMIN"), async (req, res) => {
  const { nome, whatsapp, grupo, paroquia, cidade, status } = req.body || {};
  if (!nome) return res.status(400).json({ message: "nome é obrigatório" });

  try {
    const r = await pool.query(
      "INSERT INTO members (nome, whatsapp, grupo, paroquia, cidade, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [
        String(nome).trim(),
        whatsapp ? String(whatsapp).trim() : null,
        grupo ? String(grupo).trim() : null,
        paroquia ? String(paroquia).trim() : null,
        cidade ? String(cidade).trim() : null,
        status ? String(status).trim() : "ATIVO"
      ]
    );
    res.json(r.rows[0]);
  } catch (e) {
    if (String(e?.message || "").includes("duplicate key")) {
      return res.status(409).json({ message: "WhatsApp já existe na base" });
    }
    console.error(e);
    res.status(500).json({ message: "Erro ao criar membro" });
  }
});

app.put("/api/admin/members/:id", auth("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });

  const { nome, whatsapp, grupo, paroquia, cidade, status } = req.body || {};

  const r = await pool.query(
    `UPDATE members
     SET nome = COALESCE($1,nome),
         whatsapp = COALESCE($2,whatsapp),
         grupo = COALESCE($3,grupo),
         paroquia = COALESCE($4,paroquia),
         cidade = COALESCE($5,cidade),
         status = COALESCE($6,status)
     WHERE id = $7
     RETURNING *`,
    [
      nome !== undefined ? String(nome).trim() : null,
      whatsapp !== undefined ? (whatsapp ? String(whatsapp).trim() : null) : null,
      grupo !== undefined ? (grupo ? String(grupo).trim() : null) : null,
      paroquia !== undefined ? (paroquia ? String(paroquia).trim() : null) : null,
      cidade !== undefined ? (cidade ? String(cidade).trim() : null) : null,
      status !== undefined ? (status ? String(status).trim() : null) : null,
      id
    ]
  );

  if (r.rows.length === 0) return res.status(404).json({ message: "não encontrado" });
  res.json(r.rows[0]);
});

app.delete("/api/admin/members/:id", auth("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
  await pool.query("DELETE FROM members WHERE id = $1", [id]);
  res.json({ ok: true });
});

// Products (public + admin)
app.get("/api/products", async (_req, res) => {
  const r = await pool.query("SELECT * FROM products WHERE active = TRUE ORDER BY created_at DESC LIMIT 200");
  res.json({ items: r.rows });
});

app.get("/api/admin/products", auth("ADMIN"), async (_req, res) => {
  const r = await pool.query("SELECT * FROM products ORDER BY created_at DESC LIMIT 500");
  res.json({ items: r.rows });
});

app.post("/api/admin/products", auth("ADMIN"), async (req, res) => {
  const { title, description, price, image_url, active } = req.body || {};
  if (!title || price === undefined) return res.status(400).json({ message: "title e price são obrigatórios" });

  const cents = centsFromBRL(price);
  if (!cents) return res.status(400).json({ message: "Preço inválido" });

  const r = await pool.query(
    "INSERT INTO products (title, description, price_cents, image_url, active) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [
      String(title).trim(),
      description ? String(description).trim() : null,
      cents,
      image_url ? String(image_url).trim() : null,
      active === false ? false : true
    ]
  );

  res.json(r.rows[0]);
});

app.put("/api/admin/products/:id", auth("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });

  const { title, description, price, image_url, active } = req.body || {};
  const cents = price !== undefined ? centsFromBRL(price) : null;
  if (price !== undefined && !cents) return res.status(400).json({ message: "Preço inválido" });

  const r = await pool.query(
    `UPDATE products
     SET title = COALESCE($1,title),
         description = COALESCE($2,description),
         price_cents = COALESCE($3,price_cents),
         image_url = COALESCE($4,image_url),
         active = COALESCE($5,active)
     WHERE id = $6
     RETURNING *`,
    [
      title !== undefined ? String(title).trim() : null,
      description !== undefined ? (description ? String(description).trim() : null) : null,
      cents,
      image_url !== undefined ? (image_url ? String(image_url).trim() : null) : null,
      active !== undefined ? Boolean(active) : null,
      id
    ]
  );

  if (r.rows.length === 0) return res.status(404).json({ message: "não encontrado" });
  res.json(r.rows[0]);
});

app.delete("/api/admin/products/:id", auth("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
  await pool.query("DELETE FROM products WHERE id = $1", [id]);
  res.json({ ok: true });
});

// Donations (public create, admin list/update)
app.post("/api/donations", async (req, res) => {
  const { donor_name, donor_whatsapp, amount, method, notes } = req.body || {};
  const cents = centsFromBRL(amount);
  if (!cents) return res.status(400).json({ message: "Valor inválido" });

  const r = await pool.query(
    "INSERT INTO donations (donor_name, donor_whatsapp, amount_cents, method, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [
      donor_name ? String(donor_name).trim() : null,
      donor_whatsapp ? String(donor_whatsapp).trim() : null,
      cents,
      method ? String(method).trim().toUpperCase() : "PIX",
      notes ? String(notes).trim() : null
    ]
  );

  res.json({ donation: r.rows[0] });
});

app.get("/api/admin/donations", auth("ADMIN"), async (_req, res) => {
  const r = await pool.query("SELECT * FROM donations ORDER BY created_at DESC LIMIT 500");
  res.json({ items: r.rows });
});

app.put("/api/admin/donations/:id", auth("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
  const { status, notes } = req.body || {};
  const r = await pool.query(
    "UPDATE donations SET status = COALESCE($1,status), notes = COALESCE($2,notes) WHERE id = $3 RETURNING *",
    [status ? String(status).trim().toUpperCase() : null, notes !== undefined ? (notes ? String(notes).trim() : null) : null, id]
  );
  if (r.rows.length === 0) return res.status(404).json({ message: "não encontrado" });
  res.json(r.rows[0]);
});

// Orders (public create, admin list/update)
app.post("/api/orders", async (req, res) => {
  const { buyer_name, buyer_whatsapp, items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "items obrigatório" });

  // Validate items and compute total from DB prices
  const ids = items.map((i) => Number(i.product_id)).filter((n) => Number.isFinite(n));
  if (ids.length === 0) return res.status(400).json({ message: "items inválido" });

  const products = await pool.query("SELECT id, title, price_cents FROM products WHERE id = ANY($1)", [ids]);
  const byId = new Map(products.rows.map((p) => [p.id, p]));

  let total = 0;
  const normalized = [];
  for (const it of items) {
    const pid = Number(it.product_id);
    const qty = Math.max(1, Number(it.qty || 1));
    const p = byId.get(pid);
    if (!p) continue;
    const line = p.price_cents * qty;
    total += line;
    normalized.push({ product_id: pid, title: p.title, qty, price_cents: p.price_cents, line_cents: line });
  }

  if (normalized.length === 0) return res.status(400).json({ message: "Nenhum produto válido" });

  const r = await pool.query(
    "INSERT INTO orders (buyer_name, buyer_whatsapp, total_cents, items_json) VALUES ($1,$2,$3,$4) RETURNING *",
    [buyer_name ? String(buyer_name).trim() : null, buyer_whatsapp ? String(buyer_whatsapp).trim() : null, total, normalized]
  );

  res.json({ order: r.rows[0] });
});

app.get("/api/admin/orders", auth("ADMIN"), async (_req, res) => {
  const r = await pool.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500");
  res.json({ items: r.rows });
});

app.put("/api/admin/orders/:id", auth("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
  const { status } = req.body || {};
  const r = await pool.query(
    "UPDATE orders SET status = COALESCE($1,status) WHERE id = $2 RETURNING *",
    [status ? String(status).trim().toUpperCase() : null, id]
  );
  if (r.rows.length === 0) return res.status(404).json({ message: "não encontrado" });
  res.json(r.rows[0]);
});

// ---------- Static Frontend ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

app.use(express.static(publicDir));

app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/login", (_req, res) => res.sendFile(path.join(publicDir, "login.html")));
app.get("/admin", (_req, res) => res.sendFile(path.join(publicDir, "admin.html")));

// SPA fallback for known pages
app.get(["/membros", "/doacoes", "/loja"], (req, res) => {
  const map = { "/membros": "members.html", "/doacoes": "donations.html", "/loja": "store.html" };
  res.sendFile(path.join(publicDir, map[req.path]));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor rodando na porta " + PORT);
});
