# RCC Maranhão (Plataforma)

Portal web (Node.js + Express + Postgres) para:
- Início (destaques + links rápidos)
- A RCC (conteúdo editável)
- Meu GO Nota 10 (registro de doações – integração PagBank pode ser adicionada depois)
- Campanhas (rifas: campanhas, cotas e vendedor obrigatório)
- Loja
- Sou Carismático
- Admin (gestão + relatórios)

## Acesso padrão (criado automaticamente no primeiro boot)
- **ADMIN MASTER**
  - WhatsApp: `99982477467`
  - Senha: `ucra01`

> Recomendo trocar a senha via variável de ambiente e promover usuários somente pelo ADMIN MASTER.

## Variáveis de ambiente (Railway / produção)
- `DATABASE_URL` (obrigatório)
- `JWT_SECRET` (obrigatório)
- Opcional:
  - `ADMIN_WHATSAPP` (padrão: 99982477467)
  - `ADMIN_PASSWORD` (padrão: ucra01)
  - `ADMIN_ROLE` (padrão: ADMIN_MASTER)

## Rodar local
```bash
npm install
npm start
```

Depois abra: http://localhost:3000
