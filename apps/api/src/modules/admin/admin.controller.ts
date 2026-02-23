import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../../common/auth/roles.decorator";
import { RolesGuard } from "../../common/auth/roles.guard";
import { Role } from "@prisma/client";

@Controller("/admin")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class AdminController {
  @Roles(Role.ADMIN)
  @Get("/ping")
  ping() {
    return { ok: true, scope: "admin" };
  }
}
