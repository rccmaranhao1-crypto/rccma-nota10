import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../prisma.service";
import { LoginDto, RegisterDto } from "./dto";
import bcrypt from "bcryptjs";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private sign(payload: any) {
    const secret = process.env.JWT_SECRET || "dev-secret";
    return this.jwt.sign(payload, { secret, expiresIn: "12h" });
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { whatsapp: dto.whatsapp } });
    if (existing) throw new BadRequestException("WhatsApp já cadastrado");

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        whatsapp: dto.whatsapp,
        birthDate: new Date(dto.birthDate),
        diocese: dto.diocese,
        city: dto.city,
        prayerGroup: dto.prayerGroup,
        passwordHash
      },
      select: {
        id: true, name: true, whatsapp: true, diocese: true, city: true, prayerGroup: true, role: true, createdAt: true
      }
    });

    const token = this.sign({ sub: user.id, role: user.role });
    return { user, token };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { whatsapp: dto.whatsapp } });
    if (!user) throw new UnauthorizedException("Credenciais inválidas");

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Credenciais inválidas");

    const token = this.sign({ sub: user.id, role: user.role });

    return {
      user: {
        id: user.id,
        name: user.name,
        whatsapp: user.whatsapp,
        diocese: user.diocese,
        city: user.city,
        prayerGroup: user.prayerGroup,
        role: user.role
      },
      token
    };
  }
}
