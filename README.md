# RCC MARANHÃO — Plataforma 2.0 (Node + Postgres)

Base pronta para produção (Railway), com:
- Autenticação (WhatsApp + senha) via JWT
- Perfis: **ADMIN_MASTER**, **COMUNICACAO**, **TESOUREIRO**, **USER**
- Conteúdo editável do **Início** e **A RCC**
- **Meu GO Nota 10** (registro de contribuições — PagBank entra na próxima etapa)
- **Campanhas** (rifas): campanhas, cotas, vendedores e reserva/compra
- Frontend em HTML/CSS/JS responsivo (mobile com menu hamburger)

## Variáveis de ambiente (Railway)
- `DATABASE_URL` = Postgres (Railway fornece)
- `JWT_SECRET` = chave forte (32+ chars)
- `ADMIN_NAME` (opcional) padrão: "ADMIN MASTER"
- `ADMIN_WHATSAPP` (opcional) padrão: "99982477467"
- `ADMIN_PASSWORD` (opcional) padrão: "ucra01"

## Deploy no Railway (passo a passo)
1. Acesse railway.app e crie um **Project**
2. **New -> GitHub Repo** e selecione este repositório
3. Adicione **Postgres** no projeto
4. Em **Variables** do serviço do app:
   - crie `DATABASE_URL` usando **Add Reference -> Postgres -> DATABASE_URL**
   - crie `JWT_SECRET`
5. Deploy. O Railway já fornece `PORT`.

## Acesso
- Abra o site
- Vá em **Sou Carismático** e faça login
- Em **Admin**, o ADMIN_MASTER promove/retira perfis COMUNICACAO e TESOUREIRO

## API (resumo)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/status`
- `GET/PUT /api/content/home` (COMUNICACAO ou ADMIN_MASTER)
- `GET/PUT /api/content/rcc` (COMUNICACAO ou ADMIN_MASTER)
- `POST /api/contributions` (logado)
- `GET /api/reports/contributions` (TESOUREIRO ou ADMIN_MASTER)
- `POST /api/campaigns` (ADMIN_MASTER)
- `POST /api/campaigns/:id/sellers` (ADMIN_MASTER)
- `POST /api/campaigns/:id/quotas/generate` (ADMIN_MASTER)
- `POST /api/campaigns/:id/purchase` (logado) -> exige vendedor
