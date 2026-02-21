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

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "mude_esta_chave_em_producao";

if (!DATABASE_URL) console.error("❌ DATABASE_URL não configurada. Defina no Railway Variables.");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, whatsapp: user.whatsapp }, JWT_SECRET, { expiresIn: "1d" });
}

function authRequired(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Não autenticado" });
  try { req.user = jwt.verify(token, JWT_SECRET); return next(); }
  catch { return res.status(401).json({ message: "Token inválido/expirado" }); }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(401).json({ message: "Não autenticado" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: "Sem permissão" });
    return next();
  };
}

async function initDB() {
  try { await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`); } catch {}

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      whatsapp TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      nascimento DATE,
      diocese TEXT,
      cidade TEXT,
      grupo_oracao TEXT,
      role TEXT NOT NULL DEFAULT 'USER',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_pages (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contributions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      nome TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      valor_cents INTEGER NOT NULL,
      diocese TEXT,
      grupo_oracao TEXT,
      metodo TEXT NOT NULL DEFAULT 'PENDENTE',
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      imagem_url TEXT,
      valor_cota_cents INTEGER NOT NULL,
      total_cotas INTEGER NOT NULL,
      modelo_cotas TEXT NOT NULL DEFAULT 'SEQUENCIAL',
      data_sorteio DATE,
      local_sorteio TEXT,
      reserva_minutos INTEGER NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'ATIVA',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaign_sellers (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      seller_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (campaign_id, seller_user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaign_quotas (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      numero TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DISPONIVEL',
      reserved_by_user_id INTEGER REFERENCES users(id),
      reserved_at TIMESTAMP,
      sold_by_seller_user_id INTEGER REFERENCES users(id),
      buyer_nome TEXT,
      buyer_whatsapp TEXT,
      payment_status TEXT NOT NULL DEFAULT 'PENDENTE',
      UNIQUE (campaign_id, numero)
    );
  `);

  await pool.query(`
    INSERT INTO content_pages (slug, title, body)
    VALUES 
      ('home', 'Início', 'Bem-vindo ao portal RCC Maranhão. Aqui você verá destaques e links rápidos.'),
      ('rcc', 'A RCC', 'Conte a história da RCC Maranhão aqui.')
    ON CONFLICT (slug) DO NOTHING;
  `);

  const adminName = process.env.ADMIN_NAME || "ADMIN MASTER";
  const adminWhatsapp = process.env.ADMIN_WHATSAPP || "99982477467";
  const adminPassword = process.env.ADMIN_PASSWORD || "ucra01";

  const adminCheck = await pool.query("SELECT id FROM users WHERE whatsapp = $1", [adminWhatsapp]);
  if (adminCheck.rows.length === 0) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await pool.query("INSERT INTO users (nome, whatsapp, senha, role) VALUES ($1,$2,$3,$4)", [adminName, adminWhatsapp, hash, "ADMIN_MASTER"]);
    console.log("✅ ADMIN MASTER criado.");
  } else {
    await pool.query("UPDATE users SET role='ADMIN_MASTER' WHERE whatsapp=$1", [adminWhatsapp]);
  }

  console.log("✅ Banco inicializado.");
}
initDB().catch((e) => console.error("Erro initDB:", e));

app.get("/api/status", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.json({ ok: true, db: "ok" }); }
  catch { res.status(500).json({ ok: false, db: "erro" }); }
});

app.use(express.static(path.join(__dirname, "public")));

// Auth
app.post("/api/auth/register", async (req, res) => {
  try {
    const { nome, whatsapp, senha, nascimento, diocese, cidade, grupo_oracao } = req.body || {};
    if (!nome || !whatsapp || !senha) return res.status(400).json({ message: "Campos obrigatórios: nome, whatsapp, senha" });

    const exists = await pool.query("SELECT id FROM users WHERE whatsapp=$1", [whatsapp]);
    if (exists.rows.length) return res.status(409).json({ message: "WhatsApp já cadastrado" });

    const hash = await bcrypt.hash(senha, 10);
    const ins = await pool.query(
      `INSERT INTO users (nome, whatsapp, senha, nascimento, diocese, cidade, grupo_oracao, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'USER') RETURNING id, nome, whatsapp, role`,
      [nome, whatsapp, hash, nascimento || null, diocese || null, cidade || null, grupo_oracao || null]
    );
    const user = ins.rows[0];
    res.json({ user, token: signToken(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro no cadastro" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { whatsapp, senha } = req.body || {};
    const q = await pool.query("SELECT * FROM users WHERE whatsapp=$1", [whatsapp]);
    if (!q.rows.length) return res.status(401).json({ message: "Usuário não encontrado" });

    const user = q.rows[0];
    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) return res.status(401).json({ message: "Senha inválida" });

    res.json({ token: signToken(user), user: { id: user.id, nome: user.nome, whatsapp: user.whatsapp, role: user.role } });
  } catch {
    res.status(500).json({ message: "Erro no login" });
  }
});

app.get("/api/me", authRequired, async (req, res) => {
  const q = await pool.query("SELECT id,nome,whatsapp,role,diocese,cidade,grupo_oracao,nascimento FROM users WHERE id=$1", [req.user.id]);
  res.json(q.rows[0]);
});

// Conteúdo
app.get("/api/content/:slug", async (req, res) => {
  const { slug } = req.params;
  const q = await pool.query("SELECT slug,title,body,updated_at FROM content_pages WHERE slug=$1", [slug]);
  if (!q.rows.length) return res.status(404).json({ message: "Página não encontrada" });
  res.json(q.rows[0]);
});

app.put("/api/content/:slug", authRequired, requireRole("ADMIN_MASTER", "COMUNICACAO"), async (req, res) => {
  const { slug } = req.params;
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ message: "title e body são obrigatórios" });

  await pool.query(
    `INSERT INTO content_pages (slug,title,body,updated_by,updated_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (slug) DO UPDATE SET title=$2, body=$3, updated_by=$4, updated_at=NOW()`,
    [slug, title, body, req.user.id]
  );
  res.json({ ok: true });
});

// Admin users
app.get("/api/admin/users", authRequired, requireRole("ADMIN_MASTER"), async (_req, res) => {
  const q = await pool.query("SELECT id,nome,whatsapp,role,created_at FROM users ORDER BY created_at DESC LIMIT 500");
  res.json(q.rows);
});

app.put("/api/admin/users/:id/role", authRequired, requireRole("ADMIN_MASTER"), async (req, res) => {
  const { id } = req.params;
  const { role } = req.body || {};
  const allowed = ["ADMIN_MASTER", "COMUNICACAO", "TESOUREIRO", "USER"];
  if (!allowed.includes(role)) return res.status(400).json({ message: "Role inválida" });
  await pool.query("UPDATE users SET role=$1 WHERE id=$2", [role, id]);
  res.json({ ok: true });
});

// Contribuições
app.post("/api/contributions", authRequired, async (req, res) => {
  try {
    const { valor, diocese, grupo_oracao, metodo } = req.body || {};
    const valorNum = Number(valor);
    if (!valorNum || valorNum <= 0) return res.status(400).json({ message: "Valor inválido" });

    const me = await pool.query("SELECT nome, whatsapp FROM users WHERE id=$1", [req.user.id]);
    const nome = me.rows[0]?.nome || "Contribuinte";
    const whatsapp = me.rows[0]?.whatsapp || req.user.whatsapp;

    const valor_cents = round(valorNum * 100);
    const ins = await pool.query(
      `INSERT INTO contributions (user_id,nome,whatsapp,valor_cents,diocese,grupo_oracao,metodo,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDENTE') RETURNING id`,
      [req.user.id, nome, whatsapp, valor_cents, diocese || null, grupo_oracao || null, (metodo || "PENDENTE")]
    );
    res.json({ ok: true, contribution_id: ins.rows[0].id, status: "PENDENTE" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao registrar contribuição" });
  }
});
function round(n){ return Math.round(Number(n) || 0) }

app.get("/api/reports/contributions", authRequired, requireRole("ADMIN_MASTER", "TESOUREIRO"), async (_req, res) => {
  const q = await pool.query("SELECT id,nome,whatsapp,valor_cents,diocese,grupo_oracao,metodo,status,created_at FROM contributions ORDER BY created_at DESC LIMIT 2000");
  res.json(q.rows);
});

// Campanhas
app.get("/api/campaigns", async (_req, res) => {
  const q = await pool.query("SELECT id,titulo,descricao,imagem_url,valor_cota_cents,total_cotas,modelo_cotas,data_sorteio,local_sorteio,reserva_minutos,status,created_at FROM campaigns ORDER BY created_at DESC LIMIT 100");
  res.json(q.rows);
});
app.get("/api/campaigns/:id", async (req, res) => {
  const q = await pool.query("SELECT * FROM campaigns WHERE id=$1", [req.params.id]);
  if (!q.rows.length) return res.status(404).json({ message: "Campanha não encontrada" });
  res.json(q.rows[0]);
});
app.post("/api/campaigns", authRequired, requireRole("ADMIN_MASTER"), async (req, res) => {
  const { titulo, descricao, imagem_url, valor_cota, total_cotas, modelo_cotas, data_sorteio, local_sorteio, reserva_minutos } = req.body || {};
  if (!titulo || !descricao) return res.status(400).json({ message: "titulo e descricao são obrigatórios" });
  const total = Number(total_cotas);
  const valorNum = Number(valor_cota);
  if (!total || total <= 0) return res.status(400).json({ message: "total_cotas inválido" });
  if (!valorNum || valorNum <= 0) return res.status(400).json({ message: "valor_cota inválido" });

  const ins = await pool.query(
    `INSERT INTO campaigns (titulo,descricao,imagem_url,valor_cota_cents,total_cotas,modelo_cotas,data_sorteio,local_sorteio,reserva_minutos,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [titulo, descricao, imagem_url || null, round(valorNum * 100), total, (modelo_cotas || "SEQUENCIAL"), data_sorteio || null, local_sorteio || null, Number(reserva_minutos) || 10, req.user.id]
  );
  res.json({ ok: true, campaign_id: ins.rows[0].id });
});
app.post("/api/campaigns/:id/sellers", authRequired, requireRole("ADMIN_MASTER"), async (req, res) => {
  const { seller_user_ids } = req.body || {};
  if (!Array.isArray(seller_user_ids) || !seller_user_ids.length) return res.status(400).json({ message: "seller_user_ids deve ser uma lista" });
  for (const uid of seller_user_ids) {
    await pool.query("INSERT INTO campaign_sellers (campaign_id, seller_user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [req.params.id, uid]);
  }
  res.json({ ok: true });
});
app.get("/api/campaigns/:id/sellers", authRequired, requireRole("ADMIN_MASTER"), async (req, res) => {
  const q = await pool.query(`SELECT cs.seller_user_id as id, u.nome, u.whatsapp FROM campaign_sellers cs JOIN users u ON u.id = cs.seller_user_id WHERE cs.campaign_id=$1 ORDER BY u.nome ASC`, [req.params.id]);
  res.json(q.rows);
});
app.post("/api/campaigns/:id/quotas/generate", authRequired, requireRole("ADMIN_MASTER"), async (req, res) => {
  const campQ = await pool.query("SELECT total_cotas, modelo_cotas FROM campaigns WHERE id=$1", [req.params.id]);
  if (!campQ.rows.length) return res.status(404).json({ message: "Campanha não encontrada" });
  const total = campQ.rows[0].total_cotas;
  const m = String((req.body?.modelo || campQ.rows[0].modelo_cotas || "SEQUENCIAL")).toUpperCase();
  const prefixo = req.body?.prefixo || "";
  let inserted = 0;
  for (let i = 1; i <= total; i++) {
    const numero = m === "PERSONALIZADO" ? `${prefixo}${String(i).padStart(4,"0")}` : String(i).padStart(4,"0");
    await pool.query("INSERT INTO campaign_quotas (campaign_id, numero) VALUES ($1,$2) ON CONFLICT DO NOTHING", [req.params.id, numero]);
    inserted++;
  }
  res.json({ ok: true, total, inserted });
});
app.get("/api/campaigns/:id/quotas", async (req, res) => {
  const q = await pool.query("SELECT id,numero,status,buyer_nome,buyer_whatsapp FROM campaign_quotas WHERE campaign_id=$1 ORDER BY numero ASC LIMIT 5000", [req.params.id]);
  res.json(q.rows);
});
app.post("/api/campaigns/:id/purchase", authRequired, async (req, res) => {
  const { quota_numero, seller_user_id, buyer_nome, buyer_whatsapp } = req.body || {};
  if (!quota_numero) return res.status(400).json({ message: "quota_numero obrigatório" });
  if (!seller_user_id) return res.status(400).json({ message: "seller_user_id obrigatório (selecione o vendedor)" });
  if (!buyer_nome || !buyer_whatsapp) return res.status(400).json({ message: "buyer_nome e buyer_whatsapp obrigatórios" });

  const sellerOk = await pool.query("SELECT 1 FROM campaign_sellers WHERE campaign_id=$1 AND seller_user_id=$2", [req.params.id, seller_user_id]);
  if (!sellerOk.rows.length) return res.status(400).json({ message: "Vendedor inválido para esta campanha" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const q = await client.query("SELECT id,status FROM campaign_quotas WHERE campaign_id=$1 AND numero=$2 FOR UPDATE", [req.params.id, quota_numero]);
    if (!q.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Cota não encontrada" }); }
    if (q.rows[0].status !== "DISPONIVEL") { await client.query("ROLLBACK"); return res.status(409).json({ message: "Cota indisponível" }); }

    await client.query(
      `UPDATE campaign_quotas SET status='RESERVADA', reserved_by_user_id=$1, reserved_at=NOW(),
       sold_by_seller_user_id=$2, buyer_nome=$3, buyer_whatsapp=$4, payment_status='PENDENTE' WHERE id=$5`,
      [req.user.id, seller_user_id, buyer_nome, buyer_whatsapp, q.rows[0].id]
    );
    await client.query("COMMIT");
    res.json({ ok: true, status: "RESERVADA", payment_status: "PENDENTE" });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ message: "Erro ao reservar cota" });
  } finally {
    client.release();
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => console.log("✅ Servidor rodando na porta " + PORT));
