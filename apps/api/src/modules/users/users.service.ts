import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, whatsapp: true, diocese: true, city: true, prayerGroup: true, role: true, createdAt: true }
    });
  }
}
