import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AppController } from "./app.controller";
import { PrismaService } from "./prisma.service";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { AdminModule } from "./modules/admin/admin.module";

@Module({
  imports: [
    JwtModule.register({}), // config usado nos services
    AuthModule,
    UsersModule,
    AdminModule
  ],
  controllers: [AppController],
  providers: [PrismaService]
})
export class AppModule {}
