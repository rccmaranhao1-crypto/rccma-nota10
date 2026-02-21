# RCC MA • Nota 10 (Pronto para produção)

Stack: **Node.js + Express + Postgres** (Railway) + Frontend estático (HTML + Tailwind CDN).

## 1) Como rodar local

```bash
npm install
# crie um .env
cp .env.example .env
npm start
```

Abra: http://localhost:3000

## 2) Variáveis de ambiente

Crie as variáveis no Railway (Service → Variables):

- `DATABASE_URL` (Postgres do Railway)
- `JWT_SECRET` (crie um segredo forte)

Opcional (para criar Admin automaticamente na primeira execução):
- `ADMIN_NAME` (ex: "ADMIN MASTER")
- `ADMIN_WHATSAPP` (ex: "99982477467")
- `ADMIN_PASSWORD` (ex: "ucra01")

## 3) Deploy no Railway

1. Conecte seu repositório GitHub ao Railway
2. Adicione um **Postgres** no mesmo projeto
3. No service do app, em **Variables**, defina:
   - `DATABASE_URL` (use o do Postgres)
   - `JWT_SECRET`
4. Railway detecta Node automaticamente e roda `npm start`.

## 4) Rotas

- Site: `/` (home)
- Login: `/login`
- Admin: `/admin`

API:
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- Admin:
  - `GET/POST/PUT/DELETE /api/admin/members`
  - `GET/POST/PUT/DELETE /api/admin/products`
  - `GET/PUT /api/admin/donations`
  - `GET/PUT /api/admin/orders`
- Public:
  - `GET /api/products`
  - `POST /api/orders`
  - `POST /api/donations`

## 5) Observações

- O servidor cria as tabelas automaticamente na inicialização.
- Para pagamento real (PIX/Cartão), integramos depois (ex: Mercado Pago / Stripe). Aqui já está preparado o fluxo de doação e pedido.

