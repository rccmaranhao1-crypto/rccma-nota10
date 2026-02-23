import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto } from "./dto";
import { AuthGuard } from "@nestjs/passport";

@Controller()
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("/auth/register")
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("/auth/login")
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("/me")
  async me(@Req() req: any) {
    return req.user;
  }
}
