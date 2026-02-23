/**
 * Seed idempotente: cria o ADMIN inicial se não existir.
 * ADMIN:
 *  WhatsApp: (99)9824-7746
 *  Senha: ucra01
 */
const { PrismaClient, Role, Diocese } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function normalizeWhatsApp(input) {
  // mantém apenas dígitos para comparar; grava no formato original.
  return String(input).replace(/\D/g, "");
}

async function main() {
  const adminWhats = "(99)9824-7746";
  const adminKey = normalizeWhatsApp(adminWhats);

  const existing = await prisma.user.findFirst({
    where: { whatsapp: adminWhats }
  });

  if (existing) {
    console.log("ADMIN já existe:", existing.whatsapp);
    return;
  }

  const hash = await bcrypt.hash("ucra01", 10);

  await prisma.user.create({
    data: {
      name: "ADMIN RCCMA",
      whatsapp: adminWhats,
      birthDate: new Date("1990-01-01T00:00:00.000Z"),
      diocese: Diocese.SAO_LUIS_DO_MARANHAO,
      city: "São Luís",
      prayerGroup: "Administração",
      passwordHash: hash,
      role: Role.ADMIN
    }
  });

  console.log("ADMIN criado com sucesso:", adminWhats);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
