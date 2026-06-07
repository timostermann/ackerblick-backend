import "dotenv/config";

import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { API_KEY_HEADER } from "./common/guards/api-key.guard";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("v1", { exclude: ["dashboard"] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Ackerblick API")
    .setDescription("IoT garden monitoring backend — readings ingest and dashboard.")
    .setVersion("0.1.0")
    .addApiKey({ type: "apiKey", name: "X-API-Key", in: "header" }, API_KEY_HEADER)
    .addBasicAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api", app, document);

  const config = app.get(ConfigService);
  const port = Number(config.get("PORT")) || 3000;
  await app.listen(port);

  new Logger("Bootstrap").log(`Ackerblick API listening on http://localhost:${String(port)}`);
}

void bootstrap();
