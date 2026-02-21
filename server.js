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

const PORT = process.env.PORT || 8080;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "troque_este_segredo_em_producao";

if (!DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL não configurada. O sistema vai iniciar, mas o banco pode falhar.");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

const app = express();
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Auth helpers ----
function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Token ausente" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "Token inválido" });
  }
}

function requireRole(roles) {
  const set = new Set(Array.isArray(roles) ? roles : [roles]);
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Não autenticado" });
    if (!set.has(req.user.role)) return res.status(403).json({ message: "Sem permissão" });
    return next();
  };
}

// ---- DB init ----
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      whatsapp TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rcc_content (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      price_cents INTEGER NOT NULL,
      total_quotas INTEGER NOT NULL,
      model TEXT DEFAULT 'SEQUENTIAL',
      status TEXT DEFAULT 'ACTIVE',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaign_sellers (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      whatsapp TEXT,
      UNIQUE (campaign_id, name)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaign_quotas (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      status TEXT DEFAULT 'AVAILABLE',
      reserved_by_name TEXT,
      reserved_by_whatsapp TEXT,
      seller_id INTEGER REFERENCES campaign_sellers(id),
      reserved_at TIMESTAMP,
      paid_at TIMESTAMP,
      UNIQUE (campaign_id, number)
    );
  `);

  // Admin master default
  const adminWhatsapp = process.env.ADMIN_WHATSAPP || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || "admin123";
  const adminName = process.env.ADMIN_NAME || "ADMIN MASTER";

  const existing = await pool.query("SELECT id FROM users WHERE whatsapp=$1", [adminWhatsapp]);
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(adminPass, 10);
    await pool.query(
      "INSERT INTO users (name, whatsapp, senha, role) VALUES ($1,$2,$3,$4)",
      [adminName, adminWhatsapp, hash, "ADMIN_MASTER"]
    );
    console.log("✅ ADMIN MASTER criado (whatsapp:", adminWhatsapp + ")");
  }

  const rcc = await pool.query("SELECT id FROM rcc_content WHERE slug='rcc'");
  if (rcc.rows.length === 0) {
    await pool.query(
      "INSERT INTO rcc_content (slug, title, body) VALUES ($1,$2,$3)",
      ["rcc", "A RCC Maranhão", "Conte aqui a história da RCC Maranhão. (Editável pelo perfil COMUNICAÇÃO e ADMIN MASTER)."]
    );
  }

  const camp = await pool.query("SELECT id FROM campaigns LIMIT 1");
  if (camp.rows.length === 0) {
    const adminId = (await pool.query("SELECT id FROM users WHERE role='ADMIN_MASTER' ORDER BY id LIMIT 1")).rows[0]?.id || null;
    const created = await pool.query(
      "INSERT INTO campaigns (title, description, price_cents, total_quotas, model, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      ["Campanha Exemplo", "Exemplo para você editar no Admin.", 1000, 100, "SEQUENTIAL", adminId]
    );
    const campaignId = created.rows[0].id;
    await pool.query("INSERT INTO campaign_sellers (campaign_id, name) VALUES ($1,$2),($1,$3)", [campaignId, "Vendedor 1", "Vendedor 2"]);
    const values = [];
    for (let i = 1; i <= 100; i++) values.push(`(${campaignId}, ${i}, 'AVAILABLE')`);
    await pool.query(`INSERT INTO campaign_quotas (campaign_id, number, status) VALUES ${values.join(",")}`);
  }
}

initDB().catch((e) => {
  console.error("Erro initDB:", e);
});

// ---- API ----
app.get("/api/status", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "OK" });
  } catch (e) {
    res.json({ ok: true, db: "ERRO", detail: String(e?.message || e) });
  }
});

// Auth
app.post("/auth/login", async (req, res) => {
  const { whatsapp, senha } = req.body;
  if (!whatsapp || !senha) return res.status(400).json({ message: "Informe whatsapp e senha" });

  const q = await pool.query("SELECT * FROM users WHERE whatsapp=$1", [whatsapp]);
  if (q.rows.length === 0) return res.status(401).json({ message: "Usuário não encontrado" });

  const user = q.rows[0];
  const ok = await bcrypt.compare(senha, user.senha);
  if (!ok) return res.status(401).json({ message: "Senha inválida" });

  res.json({
    token: signToken(user),
    user: { id: user.id, name: user.name, whatsapp: user.whatsapp, role: user.role },
  });
});

// Content (A RCC)
app.get("/api/content/:slug", async (req, res) => {
  const { slug } = req.params;
  const q = await pool.query("SELECT slug,title,body,updated_at FROM rcc_content WHERE slug=$1", [slug]);
  if (q.rows.length === 0) return res.status(404).json({ message: "Não encontrado" });
  res.json(q.rows[0]);
});

app.put("/api/content/:slug", auth, requireRole(["ADMIN_MASTER", "COMUNICACAO"]), async (req, res) => {
  const { slug } = req.params;
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ message: "Informe title e body" });

  const up = await pool.query(
    `INSERT INTO rcc_content (slug,title,body) VALUES ($1,$2,$3)
     ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, body=EXCLUDED.body, updated_at=NOW()
     RETURNING slug,title,body,updated_at`,
    [slug, title, body]
  );
  res.json(up.rows[0]);
});

// Users (roles)
app.get("/api/users", auth, requireRole(["ADMIN_MASTER"]), async (req, res) => {
  const q = await pool.query("SELECT id,name,whatsapp,role,created_at FROM users ORDER BY id DESC LIMIT 200");
  res.json(q.rows);
});

app.patch("/api/users/:id/role", auth, requireRole(["ADMIN_MASTER"]), async (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body;
  const allowed = new Set(["USER", "COMUNICACAO", "TESOUREIRO", "ADMIN_MASTER"]);
  if (!allowed.has(role)) return res.status(400).json({ message: "Role inválida" });

  const q = await pool.query("UPDATE users SET role=$1 WHERE id=$2 RETURNING id,name,whatsapp,role", [role, id]);
  if (q.rows.length === 0) return res.status(404).json({ message: "Usuário não encontrado" });
  res.json(q.rows[0]);
});

// Campaigns
app.get("/api/campaigns", async (req, res) => {
  const q = await pool.query(
    `SELECT c.*, 
      (SELECT COUNT(*) FROM campaign_quotas q WHERE q.campaign_id=c.id AND q.status='PAID')::int AS paid,
      (SELECT COUNT(*) FROM campaign_quotas q WHERE q.campaign_id=c.id AND q.status='RESERVED')::int AS reserved
     FROM campaigns c
     WHERE c.status <> 'DELETED'
     ORDER BY c.id DESC`
  );
  res.json(q.rows);
});

app.get("/api/campaigns/:id", async (req, res) => {
  const id = Number(req.params.id);
  const c = await pool.query("SELECT * FROM campaigns WHERE id=$1", [id]);
  if (c.rows.length === 0) return res.status(404).json({ message: "Campanha não encontrada" });

  const sellers = await pool.query("SELECT id,name,whatsapp FROM campaign_sellers WHERE campaign_id=$1 ORDER BY name", [id]);
  res.json({ ...c.rows[0], sellers: sellers.rows });
});

app.get("/api/campaigns/:id/quotas", async (req, res) => {
  const id = Number(req.params.id);
  const q = await pool.query(
    "SELECT number,status,seller_id,reserved_by_name,reserved_by_whatsapp,reserved_at,paid_at FROM campaign_quotas WHERE campaign_id=$1 ORDER BY number ASC",
    [id]
  );
  res.json(q.rows);
});

app.post("/api/campaigns", auth, requireRole(["ADMIN_MASTER"]), async (req, res) => {
  const { title, description, price_cents, total_quotas, model } = req.body;
  if (!title || !price_cents || !total_quotas) return res.status(400).json({ message: "Campos obrigatórios faltando" });

  const created = await pool.query(
    "INSERT INTO campaigns (title,description,price_cents,total_quotas,model,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [title, description || "", Number(price_cents), Number(total_quotas), model || "SEQUENTIAL", req.user.id]
  );

  const campaignId = created.rows[0].id;
  const values = [];
  for (let i = 1; i <= Number(total_quotas); i++) values.push(`(${campaignId}, ${i}, 'AVAILABLE')`);
  await pool.query(`INSERT INTO campaign_quotas (campaign_id, number, status) VALUES ${values.join(",")}`);

  res.json(created.rows[0]);
});

app.post("/api/campaigns/:id/sellers", auth, requireRole(["ADMIN_MASTER"]), async (req, res) => {
  const campaignId = Number(req.params.id);
  const { name, whatsapp } = req.body;
  if (!name) return res.status(400).json({ message: "Informe name" });

  const q = await pool.query(
    "INSERT INTO campaign_sellers (campaign_id,name,whatsapp) VALUES ($1,$2,$3) RETURNING id,name,whatsapp",
    [campaignId, name, whatsapp || ""]
  );
  res.json(q.rows[0]);
});

// Reserva (pagamento via PagBank será integrado depois)
app.post("/api/campaigns/:id/reserve", async (req, res) => {
  const campaignId = Number(req.params.id);
  const { buyer_name, buyer_whatsapp, seller_id, quotas } = req.body;

  if (!buyer_name || !seller_id || !Array.isArray(quotas) || quotas.length === 0) {
    return res.status(400).json({ message: "Informe buyer_name, seller_id e quotas[]" });
  }

  // travar cotas selecionadas
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // conferir vendedor pertence à campanha
    const s = await client.query("SELECT id FROM campaign_sellers WHERE id=$1 AND campaign_id=$2", [seller_id, campaignId]);
    if (s.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Vendedor inválido" });
    }

    for (const n of quotas.map(Number)) {
      const q = await client.query(
        "SELECT status FROM campaign_quotas WHERE campaign_id=$1 AND number=$2 FOR UPDATE",
        [campaignId, n]
      );
      if (q.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: `Cota ${n} não existe` });
      }
      if (q.rows[0].status !== "AVAILABLE") {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: `Cota ${n} indisponível` });
      }

      await client.query(
        `UPDATE campaign_quotas
         SET status='RESERVED', reserved_by_name=$1, reserved_by_whatsapp=$2, seller_id=$3, reserved_at=NOW()
         WHERE campaign_id=$4 AND number=$5`,
        [buyer_name, buyer_whatsapp || "", seller_id, campaignId, n]
      );
    }

    await client.query("COMMIT");
    return res.json({ ok: true, message: "Cotas reservadas. Integração PagBank será feita no próximo passo." });
  } catch (e) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Erro ao reservar", detail: String(e?.message || e) });
  } finally {
    client.release();
  }
});

// marcar pagamento (tesoureiro/admin master)
app.post("/api/campaigns/:id/mark-paid", auth, requireRole(["ADMIN_MASTER", "TESOUREIRO"]), async (req, res) => {
  const campaignId = Number(req.params.id);
  const { quotas } = req.body;
  if (!Array.isArray(quotas) || quotas.length === 0) return res.status(400).json({ message: "Informe quotas[]" });

  const nums = quotas.map(Number);
  await pool.query(
    `UPDATE campaign_quotas
     SET status='PAID', paid_at=NOW()
     WHERE campaign_id=$1 AND number = ANY($2::int[])`,
    [campaignId, nums]
  );
  res.json({ ok: true });
});

// ---- Static ----
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor rodando na porta", PORT);
});
