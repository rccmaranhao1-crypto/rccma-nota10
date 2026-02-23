import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import cookieParser from "cookie-parser";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  const corsOrigin = process.env.CORS_ORIGIN || "*";
  app.enableCors({
    origin: corsOrigin === "*" ? true : corsOrigin.split(",").map(s => s.trim()),
    credentials: true
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API running on port ${port}`);
}

bootstrap();
