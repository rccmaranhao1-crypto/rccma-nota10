import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Role } from "@prisma/client";
import { Roles } from "../../common/auth/roles.decorator";
import { RolesGuard } from "../../common/auth/roles.guard";
import { UsersService } from "./users.service";

@Controller("/users")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Roles(Role.ADMIN, Role.TESOUREIRO, Role.ARRECADACAO)
  @Get()
  list() {
    return this.users.list();
  }
}
