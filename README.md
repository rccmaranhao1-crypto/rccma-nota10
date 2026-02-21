# RCC MARANHÃO — Plataforma Profissional v3.0 (Railway)

## O que esta versão entrega (alinhado ao seu DOC)
- **Sou Carismático**: cadastro + login (WhatsApp como login) com **Diocese em lista suspensa** (carregada do banco)
- **Perfis (RBAC)**: ADMIN_MASTER, COMUNICACAO, TESOUREIRO, USER
- **Início** e **A RCC**: conteúdo editável (COMUNICACAO/ADMIN_MASTER)
- **Meu GO Nota 10**: registro de contribuições (pronto para PagBank PIX/Cartão)
- **Campanhas (Rifas)**:
  - Criação de campanha (Admin)
  - Total de cotas + modelo sequencial
  - Reserva 10 ou 30 minutos
  - Cadastro de vendedores (Admin)
  - Compra/reserva exige **vendedor obrigatório**
  - Ranking por vendedor e relatórios (Admin/Tesoureiro)
- **PagBank READY**:
  - endpoints para criar pagamento PIX e Cartão (stubs prontos)
  - webhook endpoint para confirmação automática
  - tabela de pagamentos e vínculo com contribuição / rifa / loja

> Requisitos do seu documento: Diocese select e Campanhas estilo Rifa Digital com vendedor obrigatório e PagBank. (ver doc: "diocese (select)" e "Campanha ... vendedor ... integração PagBank") 

## Admin Master (seed automático)
- WhatsApp: **99982477467**
- Senha: **ucra01**
- Role: **ADMIN_MASTER**

## Variáveis de ambiente (Railway -> Service -> Variables)
Obrigatórias:
- `DATABASE_URL` (Add Reference -> Postgres -> DATABASE_URL)
- `JWT_SECRET` (crie uma chave forte)

PagBank (quando você tiver credenciais):
- `PAGBANK_TOKEN` (Bearer token)
- `PAGBANK_ENV` = `sandbox` ou `production`
- `PAGBANK_WEBHOOK_SECRET` (se você usar validação adicional)
- `PUBLIC_BASE_URL` (URL pública do Railway do app para compor callback/webhook, opcional)

## Deploy no Railway (sem instalar nada no PC)
1. Railway -> New Project
2. Deploy from GitHub repo (seu repo)
3. Add -> Database -> PostgreSQL
4. No serviço do app -> Variables: configure DATABASE_URL e JWT_SECRET
5. Deploy. Acesse a URL pública.

## Rotas principais
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me`
- Diocese: `GET /api/dioceses`
- Conteúdo: `GET/PUT /api/content/:slug`
- Contribuições: `POST /api/contribuicoes` e relatórios `GET /api/relatorios/contribuicoes`
- Campanhas: `POST /api/campanhas`, `POST /api/campanhas/:id/vendedores`, `POST /api/campanhas/:id/gerar-cotas`, `POST /api/campanhas/:id/reservar`
- PagBank: `POST /api/pagbank/pix`, `POST /api/pagbank/cartao`, `POST /api/pagbank/webhook`
