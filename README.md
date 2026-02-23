# RCCMA Portal (Monorepo) — API + WEB (Railway-ready)

Este repositório contém:
- **apps/api**: NestJS + Prisma + PostgreSQL (Railway) com Auth (JWT), RBAC e seed do ADMIN.
- **apps/web**: Next.js + Tailwind + shadcn-like base (sem dependências extras) com Login/Cadastro e estrutura de abas.

> **Importante:** Este é um esqueleto profissional para você subir agora e ir completando as funcionalidades.
> Já vem com:
> - Cadastro/Login por WhatsApp + senha
> - Diocese como lista suspensa (enum)
> - RBAC (ADMIN, COMUNICACAO, TESOUREIRO, ARRECADACAO, USER)
> - Seed do ADMIN: WhatsApp **(99)9824-7746** senha **ucra01**
> - Estrutura de módulos para Doações/Loja/Campanhas e Webhooks (stubs prontos)

## 1) Rodar localmente (opcional)
Requisitos: Node 18+ e Docker (para Postgres).

```bash
docker compose -f docker-compose.dev.yml up -d
cd apps/api
npm i
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run start:dev
```

Em outro terminal:
```bash
cd apps/web
npm i
npm run dev
```

## 2) Deploy no Railway (online)
Você pode manter tudo no Railway. Faça 2 serviços com o mesmo repo:

### Serviço API
- **Root Directory**: `apps/api`
- Build: `npm ci && npm run build`
- Start: `npm run start:prod`

Variáveis (mínimo):
- DATABASE_URL (Railway fornece ao conectar Postgres)
- JWT_SECRET
- JWT_REFRESH_SECRET
- CORS_ORIGIN (ex: URL do WEB)

### Serviço WEB
- **Root Directory**: `apps/web`
- Build: `npm ci && npm run build`
- Start: `npm run start`

Variáveis:
- NEXT_PUBLIC_API_URL = URL do serviço API

## 3) Endpoints principais (API)
- `POST /auth/register`
- `POST /auth/login`
- `GET /me` (protegido)
- `GET /admin/ping` (ADMIN)

## 4) Próximos módulos (stubs)
Veja `apps/api/src/modules/*`:
- donations
- store
- campaigns
- payments (PagBank)
- dashboards

## 5) Segurança
- Senhas com bcrypt
- JWT access token
- CORS configurável via env

---
