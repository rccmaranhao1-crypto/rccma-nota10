import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || "dev-secret"
    });
  }

  async validate(payload: any) {
    const userId = payload.sub as string;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, whatsapp: true, diocese: true, city: true, prayerGroup: true, role: true }
    });
    return user;
  }
}
