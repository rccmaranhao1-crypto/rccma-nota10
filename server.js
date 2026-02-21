import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

dotenv.config();

const { Pool } = pkg;
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { message: "Muitas tentativas. Tente novamente em alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "mude_esta_chave_em_producao";

const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP || "99982477467";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ucra01";
const ADMIN_NAME = process.env.ADMIN_NAME || "ADMIN MASTER";

const PAGBANK_TOKEN = process.env.PAGBANK_TOKEN || "";
const PAGBANK_ENV = (process.env.PAGBANK_ENV || "sandbox").toLowerCase(); // sandbox | production

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeWhatsApp(input) {
  return String(input || "").replace(/\D/g, "");
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, whatsapp: user.whatsapp }, JWT_SECRET, { expiresIn: "1d" });
}

function authRequired(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Não autenticado" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "Token inválido/expirado" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(401).json({ message: "Não autenticado" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: "Sem permissão" });
    return next();
  };
}

async function q(text, params) {
  return pool.query(text, params);
}

async function initDB() {
  // Core tables
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      whatsapp TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      nascimento DATE NOT NULL,
      diocese_id INTEGER,
      cidade TEXT NOT NULL,
      grupo_oracao TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'USER',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS dioceses (
      id SERIAL PRIMARY KEY,
      nome TEXT UNIQUE NOT NULL,
      ativa BOOLEAN NOT NULL DEFAULT TRUE
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS content_pages (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS contributions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      nome TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      valor_cents INTEGER NOT NULL,
      diocese_id INTEGER REFERENCES dioceses(id),
      grupo_oracao TEXT NOT NULL,
      metodo TEXT NOT NULL DEFAULT 'PENDENTE', -- PIX | CARTAO
      status TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE | PAGO | CANCELADO
      payment_id INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      imagem_url TEXT,
      premios_json TEXT NOT NULL DEFAULT '[]',
      valor_cota_cents INTEGER NOT NULL,
      total_cotas INTEGER NOT NULL,
      reserva_minutos INTEGER NOT NULL DEFAULT 10, -- 10 ou 30
      data_sorteio DATE,
      local_sorteio TEXT,
      status TEXT NOT NULL DEFAULT 'ATIVA',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS campaign_sellers (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      seller_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (campaign_id, seller_user_id)
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS campaign_quotas (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      numero INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'DISPONIVEL', -- DISPONIVEL | RESERVADA | PAGA
      reserved_by_user_id INTEGER REFERENCES users(id),
      reserved_at TIMESTAMP,
      sold_by_seller_user_id INTEGER REFERENCES users(id),
      buyer_nome TEXT,
      buyer_whatsapp TEXT,
      payment_id INTEGER,
      UNIQUE (campaign_id, numero)
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'PAGBANK',
      kind TEXT NOT NULL, -- PIX | CARTAO
      reference_type TEXT NOT NULL, -- CONTRIBUTION | CAMPAIGN_QUOTA | ORDER
      reference_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE | PAGO | CANCELADO | EXPIRADO
      provider_charge_id TEXT,
      pix_qr_text TEXT,
      pix_qr_image_url TEXT,
      raw_json TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Seed dioceses
  const dioceses = [
    "Bacabal","Balsas","Brejo","Carolina","Caxias","Coroatá","Grajaú","Imperatriz","Pinheiro","São Luís do Maranhão","Viana","Zé Doca","Outro"
  ];
  for (const nome of dioceses) {
    await q(`INSERT INTO dioceses (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING`, [nome]);
  }

  // Seed content pages
  await q(`
    INSERT INTO content_pages (slug, title, body)
    VALUES
      ('home','Início','Bem-vindo ao portal RCC Maranhão. Aqui você verá destaques e links rápidos.'),
      ('rcc','A RCC','Conte aqui a história e informações oficiais da RCC Maranhão.')
    ON CONFLICT (slug) DO NOTHING;
  `);

  // Ensure admin master
  const adminW = normalizeWhatsApp(ADMIN_WHATSAPP);
  const existing = await q(`SELECT id FROM users WHERE whatsapp=$1`, [adminW]);
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    // diocese default "São Luís do Maranhão"
    const did = await q(`SELECT id FROM dioceses WHERE nome=$1`, ["São Luís do Maranhão"]);
    const diocese_id = did.rows[0]?.id || null;
    await q(
      `INSERT INTO users (nome, whatsapp, senha, nascimento, diocese_id, cidade, grupo_oracao, email, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [ADMIN_NAME, adminW, hash, "1990-01-01", diocese_id, "São Luís", "Coordenação", null, "ADMIN_MASTER"]
    );
    console.log("✅ ADMIN_MASTER criado automaticamente.");
  } else {
    await q(`UPDATE users SET role='ADMIN_MASTER' WHERE whatsapp=$1`, [adminW]);
  }

  console.log("✅ Banco inicializado.");
}

initDB().catch((e)=>console.error("initDB erro:", e));

// Static
app.use(express.static(path.join(__dirname, "public")));

// Status
app.get("/api/status", async (_req, res) => {
  try { await q("SELECT 1"); return res.json({ ok: true, db: "ok" }); }
  catch { return res.status(500).json({ ok: false, db: "erro" }); }
});

// Diocese
app.get("/api/dioceses", async (_req, res) => {
  const d = await q(`SELECT id,nome FROM dioceses WHERE ativa=TRUE ORDER BY nome ASC`);
  res.json(d.rows);
});

// Auth
const registerSchema = z.object({
  nome: z.string().min(2),
  whatsapp: z.string().min(8),
  senha: z.string().min(4),
  nascimento: z.string().min(8),
  diocese_id: z.coerce.number().int().positive(),
  cidade: z.string().min(2),
  grupo_oracao: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")).optional()
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body || {});
    const whatsapp = normalizeWhatsApp(data.whatsapp);
    const exists = await q(`SELECT id FROM users WHERE whatsapp=$1`, [whatsapp]);
    if (exists.rows.length) return res.status(409).json({ message: "WhatsApp já cadastrado" });

    const hash = await bcrypt.hash(data.senha, 10);
    const ins = await q(
      `INSERT INTO users (nome,whatsapp,senha,nascimento,diocese_id,cidade,grupo_oracao,email,role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'USER')
       RETURNING id,nome,whatsapp,role`,
      [data.nome, whatsapp, hash, data.nascimento, data.diocese_id, data.cidade, data.grupo_oracao, data.email || null]
    );
    const user = ins.rows[0];
    res.json({ user, token: signToken(user) });
  } catch (e) {
    const msg = e?.issues?.[0]?.message || e?.message || "Erro no cadastro";
    res.status(400).json({ message: msg });
  }
});

const loginSchema = z.object({
  whatsapp: z.string().min(8),
  senha: z.string().min(1),
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const data = loginSchema.parse(req.body || {});
    const whatsapp = normalizeWhatsApp(data.whatsapp);
    const u = await q(`SELECT id,nome,whatsapp,senha,role FROM users WHERE whatsapp=$1`, [whatsapp]);
    if (!u.rows.length) return res.status(401).json({ message: "Usuário não encontrado" });

    const user = u.rows[0];
    const ok = await bcrypt.compare(data.senha, user.senha);
    if (!ok) return res.status(401).json({ message: "Senha inválida" });

    res.json({ token: signToken(user), user: { id:user.id, nome:user.nome, whatsapp:user.whatsapp, role:user.role } });
  } catch (e) {
    const msg = e?.issues?.[0]?.message || e?.message || "Erro no login";
    res.status(400).json({ message: msg });
  }
});

app.get("/api/me", authRequired, async (req, res) => {
  const me = await q(`
    SELECT u.id,u.nome,u.whatsapp,u.role,u.nascimento,u.cidade,u.grupo_oracao,u.email,d.nome as diocese
    FROM users u LEFT JOIN dioceses d ON d.id=u.diocese_id
    WHERE u.id=$1`, [req.user.id]);
  res.json(me.rows[0]);
});

// Content pages
app.get("/api/content/:slug", async (req, res) => {
  const p = await q(`SELECT slug,title,body,updated_at FROM content_pages WHERE slug=$1`, [req.params.slug]);
  if (!p.rows.length) return res.status(404).json({ message: "Página não encontrada" });
  res.json(p.rows[0]);
});

app.put("/api/content/:slug", authRequired, requireRole("ADMIN_MASTER","COMUNICACAO"), async (req, res) => {
  const schema = z.object({ title: z.string().min(2), body: z.string().min(1) });
  try {
    const data = schema.parse(req.body || {});
    await q(`
      INSERT INTO content_pages (slug,title,body,updated_by,updated_at)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (slug) DO UPDATE SET title=$2, body=$3, updated_by=$4, updated_at=NOW()
    `, [req.params.slug, data.title, data.body, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ message: e?.issues?.[0]?.message || "Dados inválidos" });
  }
});

// Admin user management
app.get("/api/admin/users", authRequired, requireRole("ADMIN_MASTER"), async (_req, res) => {
  const u = await q(`SELECT id,nome,whatsapp,role,created_at FROM users ORDER BY created_at DESC LIMIT 2000`);
  res.json(u.rows);
});

app.put("/api/admin/users/:id/role", authRequired, requireRole("ADMIN_MASTER"), async (req, res) => {
  const schema = z.object({ role: z.enum(["ADMIN_MASTER","COMUNICACAO","TESOUREIRO","USER"]) });
  try {
    const data = schema.parse(req.body || {});
    await q(`UPDATE users SET role=$1 WHERE id=$2`, [data.role, Number(req.params.id)]);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ message: "Role inválida" });
  }
});

// Contribuições (Meu GO Nota 10)
app.post("/api/contribuicoes", authRequired, async (req, res) => {
  const schema = z.object({
    valor: z.coerce.number().positive(),
    diocese_id: z.coerce.number().int().positive(),
    grupo_oracao: z.string().min(2),
    metodo: z.enum(["PIX","CARTAO"]).optional()
  });
  try {
    const data = schema.parse(req.body || {});
    const me = await q(`SELECT nome, whatsapp FROM users WHERE id=$1`, [req.user.id]);
    const valor_cents = Math.round(data.valor * 100);
    const ins = await q(`
      INSERT INTO contributions (user_id,nome,whatsapp,valor_cents,diocese_id,grupo_oracao,metodo,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDENTE') RETURNING id
    `, [req.user.id, me.rows[0].nome, me.rows[0].whatsapp, valor_cents, data.diocese_id, data.grupo_oracao, (data.metodo || "PENDENTE")]);
    res.json({ ok:true, contribution_id: ins.rows[0].id });
  } catch (e) {
    res.status(400).json({ message: e?.issues?.[0]?.message || "Dados inválidos" });
  }
});

app.get("/api/relatorios/contribuicoes", authRequired, requireRole("ADMIN_MASTER","TESOUREIRO"), async (_req, res) => {
  const r = await q(`
    SELECT c.id,c.nome,c.whatsapp,c.valor_cents,c.metodo,c.status,c.created_at, d.nome as diocese, c.grupo_oracao
    FROM contributions c LEFT JOIN dioceses d ON d.id=c.diocese_id
    ORDER BY c.created_at DESC LIMIT 5000
  `);
  res.json(r.rows);
});

// Campanhas (Rifas)
app.get("/api/campanhas", async (_req, res) => {
  const c = await q(`SELECT id,titulo,descricao,imagem_url,premios_json,valor_cota_cents,total_cotas,reserva_minutos,data_sorteio,local_sorteio,status,created_at FROM campaigns ORDER BY created_at DESC LIMIT 200`);
  res.json(c.rows.map(row=>({ ...row, premios: safeJson(row.premios_json, []) })));
});

app.post("/api/campanhas", authRequired, requireRole("ADMIN_MASTER"), async (req, res) => {
  const schema = z.object({
    titulo: z.string().min(3),
    descricao: z.string().min(5),
    imagem_url: z.string().optional().or(z.literal("")).optional(),
    premios: z.array(z.object({ titulo: z.string().min(2), imagem_url: z.string().optional().or(z.literal("")).optional() })).default([]),
    valor_cota: z.coerce.number().positive(),
    total_cotas: z.coerce.number().int().positive(),
    reserva_minutos: z.coerce.number().int().refine(v=>v===10||v===30, "reserva_minutos deve ser 10 ou 30"),
    data_sorteio: z.string().optional().or(z.literal("")).optional(),
    local_sorteio: z.string().optional().or(z.literal("")).optional()
  });
  try {
    const data = schema.parse(req.body || {});
    const ins = await q(`
      INSERT INTO campaigns (titulo,descricao,imagem_url,premios_json,valor_cota_cents,total_cotas,reserva_minutos,data_sorteio,local_sorteio,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
    `, [
      data.titulo, data.descricao, data.imagem_url || null, JSON.stringify(data.premios || []),
      Math.round(data.valor_cota*100), data.total_cotas, data.reserva_minutos,
      data.data_sorteio ? data.data_sorteio : null,
      data.local_sorteio ? data.local_sorteio : null,
      req.user.id
    ]);
    res.json({ ok:true, campaign_id: ins.rows[0].id });
  } catch (e) {
    res.status(400).json({ message: e?.issues?.[0]?.message || "Dados inválidos" });
  }
});

app.post("/api/campanhas/:id/gerar-cotas", authRequired, requireRole("ADMIN_MASTER"), async (req, res) => {
  const id = Number(req.params.id);
  const camp = await q(`SELECT total_cotas FROM campaigns WHERE id=$1`, [id]);
  if (!camp.rows.length) return res.status(404).json({ message: "Campanha não encontrada" });

  const total = camp.rows[0].total_cotas;
  let inserted = 0;
  for (let i=1;i<=total;i++){
    await q(`INSERT INTO campaign_quotas (campaign_id,numero) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id,i]);
    inserted++;
  }
  res.json({ ok:true, total, inserted });
});

app.post("/api/campanhas/:id/vendedores", authRequired, requireRole("ADMIN_MASTER"), async (req, res) => {
  const schema = z.object({ seller_user_ids: z.array(z.coerce.number().int().positive()).min(1) });
  try{
    const data = schema.parse(req.body||{});
    for (const uid of data.seller_user_ids){
      await q(`INSERT INTO campaign_sellers (campaign_id,seller_user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [Number(req.params.id), uid]);
    }
    res.json({ ok:true });
  } catch(e){
    res.status(400).json({ message: e?.issues?.[0]?.message || "Dados inválidos" });
  }
});

app.get("/api/campanhas/:id/vendedores", authRequired, requireRole("ADMIN_MASTER","COMUNICACAO","TESOUREIRO"), async (req,res)=>{
  const rows = await q(`
    SELECT cs.seller_user_id as id, u.nome, u.whatsapp
    FROM campaign_sellers cs JOIN users u ON u.id=cs.seller_user_id
    WHERE cs.campaign_id=$1
    ORDER BY u.nome ASC
  `,[Number(req.params.id)]);
  res.json(rows.rows);
});

app.get("/api/campanhas/:id/cotas", async (req,res)=>{
  const id=Number(req.params.id);
  const rows = await q(`SELECT id,numero,status,buyer_nome,buyer_whatsapp FROM campaign_quotas WHERE campaign_id=$1 ORDER BY numero ASC`, [id]);
  res.json(rows.rows);
});

app.post("/api/campanhas/:id/reservar", authRequired, async (req,res)=>{
  const schema = z.object({
    numero: z.coerce.number().int().positive(),
    seller_user_id: z.coerce.number().int().positive(),
    buyer_nome: z.string().min(2),
    buyer_whatsapp: z.string().min(8),
  });
  try{
    const data = schema.parse(req.body||{});
    const campId = Number(req.params.id);

    // validate seller belongs to campaign
    const sellerOk = await q(`SELECT 1 FROM campaign_sellers WHERE campaign_id=$1 AND seller_user_id=$2`, [campId, data.seller_user_id]);
    if (!sellerOk.rows.length) return res.status(400).json({ message: "Vendedor inválido para esta campanha" });

    // transaction reserve quota
    const client = await pool.connect();
    try{
      await client.query("BEGIN");
      const quota = await client.query(`SELECT id,status FROM campaign_quotas WHERE campaign_id=$1 AND numero=$2 FOR UPDATE`, [campId, data.numero]);
      if (!quota.rows.length){ await client.query("ROLLBACK"); return res.status(404).json({ message:"Cota não encontrada" }); }
      if (quota.rows[0].status !== "DISPONIVEL"){ await client.query("ROLLBACK"); return res.status(409).json({ message:"Cota indisponível" }); }

      await client.query(`
        UPDATE campaign_quotas
        SET status='RESERVADA', reserved_by_user_id=$1, reserved_at=NOW(),
            sold_by_seller_user_id=$2, buyer_nome=$3, buyer_whatsapp=$4
        WHERE id=$5
      `,[req.user.id, data.seller_user_id, data.buyer_nome, normalizeWhatsApp(data.buyer_whatsapp), quota.rows[0].id]);

      await client.query("COMMIT");
      res.json({ ok:true, status:"RESERVADA" });
    }catch(e){
      await client.query("ROLLBACK");
      console.error(e);
      res.status(500).json({ message:"Erro ao reservar" });
    }finally{
      client.release();
    }
  }catch(e){
    res.status(400).json({ message: e?.issues?.[0]?.message || "Dados inválidos" });
  }
});

// Ranking por vendedor (admin/tesoureiro)
app.get("/api/relatorios/campanhas/:id/ranking", authRequired, requireRole("ADMIN_MASTER","TESOUREIRO"), async (req,res)=>{
  const campId = Number(req.params.id);
  const rows = await q(`
    SELECT u.id, u.nome, u.whatsapp,
      SUM(CASE WHEN q.status IN ('RESERVADA','PAGA') THEN 1 ELSE 0 END) as cotas_vendidas
    FROM campaign_quotas q
    JOIN users u ON u.id=q.sold_by_seller_user_id
    WHERE q.campaign_id=$1
    GROUP BY u.id,u.nome,u.whatsapp
    ORDER BY cotas_vendidas DESC, u.nome ASC
  `,[campId]);
  res.json(rows.rows);
});

// --------------------
// PagBank READY (stubs + estrutura real de dados)
// --------------------
function pagbankBaseUrl(){
  // Placeholder: quando você for integrar, basta ajustar aqui conforme o endpoint oficial da "Nova API" PagBank
  // e manter o token via Bearer.
  // Por padrão mantemos genérico para não travar o deploy sem credencial.
  return PAGBANK_ENV === "production" ? "https://api.pagbank.com.br" : "https://sandbox.api.pagbank.com.br";
}

async function pagbankRequest(endpoint, payload){
  if (!PAGBANK_TOKEN) {
    // Sem token, devolvemos erro amigável para o front (mas sistema continua rodando)
    return { ok:false, message:"PagBank não configurado (sem token). Configure PAGBANK_TOKEN no Railway." };
  }
  const url = pagbankBaseUrl() + endpoint;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${PAGBANK_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = { raw:text }; }
  if (!res.ok) return { ok:false, status:res.status, data };
  return { ok:true, data };
}

// Criar PIX para contribuição / cota de campanha
app.post("/api/pagbank/pix", authRequired, async (req,res)=>{
  // reference_type: CONTRIBUTION | CAMPAIGN_QUOTA
  const schema = z.object({
    reference_type: z.enum(["CONTRIBUTION","CAMPAIGN_QUOTA"]),
    reference_id: z.coerce.number().int().positive(),
    amount: z.coerce.number().positive(),
    description: z.string().min(2).optional()
  });
  try{
    const data = schema.parse(req.body||{});
    const amount_cents = Math.round(data.amount*100);

    // grava pagamento local (PENDENTE)
    const p = await q(`
      INSERT INTO payments (kind,reference_type,reference_id,amount_cents,status)
      VALUES ('PIX',$1,$2,$3,'PENDENTE') RETURNING id
    `,[data.reference_type, data.reference_id, amount_cents]);
    const paymentId = p.rows[0].id;

    // payload (placeholder)
    const payload = {
      reference_id: String(paymentId),
      description: data.description || "Pagamento RCC Maranhão",
      amount: { value: amount_cents, currency: "BRL" },
    };

    const out = await pagbankRequest("/payments/pix", payload);
    if (!out.ok){
      // mantém pagamento pendente e devolve instrução
      return res.status(400).json({ message: out.message || "Falha PagBank", details: out.data || null, payment_id: paymentId });
    }

    // exemplo de retorno esperado (ajustaremos quando tiver documentação/credenciais)
    const qrText = out.data?.qr_codes?.[0]?.text || out.data?.qr_text || null;
    const qrImg  = out.data?.qr_codes?.[0]?.links?.find(l=>l.rel==="QRCODE")?.href || out.data?.qr_image_url || null;
    const providerId = out.data?.id || out.data?.charge_id || null;

    await q(`UPDATE payments SET provider_charge_id=$1, pix_qr_text=$2, pix_qr_image_url=$3, raw_json=$4, updated_at=NOW() WHERE id=$5`,
      [providerId, qrText, qrImg, JSON.stringify(out.data), paymentId]);

    res.json({ ok:true, payment_id: paymentId, provider_charge_id: providerId, qr_text: qrText, qr_image_url: qrImg });
  }catch(e){
    res.status(400).json({ message: e?.issues?.[0]?.message || "Dados inválidos" });
  }
});

// Criar Cartão (placeholder)
app.post("/api/pagbank/cartao", authRequired, async (req,res)=>{
  const schema = z.object({
    reference_type: z.enum(["CONTRIBUTION","CAMPAIGN_QUOTA"]),
    reference_id: z.coerce.number().int().positive(),
    amount: z.coerce.number().positive(),
    card: z.object({
      number: z.string().min(12),
      holder: z.string().min(2),
      exp_month: z.coerce.number().int().min(1).max(12),
      exp_year: z.coerce.number().int().min(2024),
      cvv: z.string().min(3).max(4),
      installments: z.coerce.number().int().min(1).max(12).default(1)
    }),
    buyer: z.object({
      name: z.string().min(2),
      email: z.string().email().optional().or(z.literal("")).optional(),
      phone: z.string().min(8)
    }).optional()
  });

  try{
    const data = schema.parse(req.body||{});
    const amount_cents = Math.round(data.amount*100);

    const p = await q(`
      INSERT INTO payments (kind,reference_type,reference_id,amount_cents,status)
      VALUES ('CARTAO',$1,$2,$3,'PENDENTE') RETURNING id
    `,[data.reference_type, data.reference_id, amount_cents]);
    const paymentId = p.rows[0].id;

    const payload = {
      reference_id: String(paymentId),
      amount: { value: amount_cents, currency: "BRL" },
      card: {
        number: data.card.number,
        holder: data.card.holder,
        exp_month: data.card.exp_month,
        exp_year: data.card.exp_year,
        security_code: data.card.cvv,
        installments: data.card.installments
      },
      buyer: data.buyer || undefined
    };

    const out = await pagbankRequest("/payments/card", payload);
    if (!out.ok){
      return res.status(400).json({ message: out.message || "Falha PagBank", details: out.data || null, payment_id: paymentId });
    }

    const providerId = out.data?.id || out.data?.charge_id || null;
    const status = out.data?.status || "PENDENTE";

    await q(`UPDATE payments SET provider_charge_id=$1, status=$2, raw_json=$3, updated_at=NOW() WHERE id=$4`,
      [providerId, status, JSON.stringify(out.data), paymentId]);

    res.json({ ok:true, payment_id: paymentId, provider_charge_id: providerId, status });
  }catch(e){
    res.status(400).json({ message: e?.issues?.[0]?.message || "Dados inválidos" });
  }
});

// Webhook PagBank (confirmação automática) — pronto para receber evento e atualizar status local
app.post("/api/pagbank/webhook", async (req,res)=>{
  // Aqui você recebe o payload do PagBank e atualiza o pagamento local.
  // Nesta versão, aceitamos o payload e tentamos mapear por reference_id (payment_id).
  try{
    const payload = req.body || {};
    const referenceId = payload?.reference_id || payload?.data?.reference_id || payload?.id || null;
    const status = payload?.status || payload?.data?.status || null;

    if (!referenceId || !status){
      return res.status(200).json({ ok:true, ignored:true });
    }

    const paymentId = Number(referenceId);
    if (!Number.isFinite(paymentId)) return res.status(200).json({ ok:true, ignored:true });

    await q(`UPDATE payments SET status=$1, raw_json=$2, updated_at=NOW() WHERE id=$3`,
      [String(status).toUpperCase(), JSON.stringify(payload), paymentId]);

    // TODO: quando você integrar de verdade, aqui você também marca a contribuição/cota como PAGA
    res.status(200).json({ ok:true });
  }catch(e){
    console.error(e);
    res.status(200).json({ ok:true });
  }
});

function safeJson(s, fallback){
  try{ return JSON.parse(s); }catch{ return fallback; }
}

app.get("*", (_req,res)=> res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT,"0.0.0.0", ()=> console.log("✅ RCC Maranhão v3.0 rodando na porta "+PORT));
