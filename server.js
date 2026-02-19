import express from "express";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const { Pool } = pkg;

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "segredo_rcc";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Criar tabelas automaticamente
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      whatsapp TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      role TEXT DEFAULT 'USER'
    );
  `);

  const adminCheck = await pool.query(
    "SELECT * FROM users WHERE whatsapp = $1",
    ["99982477467"]
  );

  if (adminCheck.rows.length === 0) {
    const hash = await bcrypt.hash("ucra01", 10);
    await pool.query(
      "INSERT INTO users (nome, whatsapp, senha, role) VALUES ($1,$2,$3,$4)",
      ["ADMIN MASTER", "99982477467", hash, "ADMIN"]
    );
    console.log("Admin criado.");
  }
}

initDB();

// Rota teste
app.get("/", (req, res) => {
  res.send("RCC MA Nota 10 Online 🚀");
});

// Cadastro
app.post("/register", async (req, res) => {
  const { nome, whatsapp, senha } = req.body;
  const hash = await bcrypt.hash(senha, 10);
  await pool.query(
    "INSERT INTO users (nome, whatsapp, senha) VALUES ($1,$2,$3)",
    [nome, whatsapp, hash]
  );
  res.json({ message: "Usuário criado!" });
});

// Login
app.post("/login", async (req, res) => {
  const { whatsapp, senha } = req.body;
  const user = await pool.query(
    "SELECT * FROM users WHERE whatsapp = $1",
    [whatsapp]
  );

  if (user.rows.length === 0) {
    return res.status(401).json({ message: "Usuário não encontrado" });
  }

  const valid = await bcrypt.compare(senha, user.rows[0].senha);
  if (!valid) {
    return res.status(401).json({ message: "Senha inválida" });
  }

  const token = jwt.sign(
    { id: user.rows[0].id, role: user.rows[0].role },
    JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({ token });
});

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
