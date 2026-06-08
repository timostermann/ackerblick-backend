import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import type { INestApplication, ModuleMetadata } from "@nestjs/common";

/**
 * Build and initialize a NestJS app for integration tests, mirroring the global
 * ValidationPipe configured in `main.ts`. Pass module metadata (imports,
 * controllers, providers) and override providers as needed before calling.
 */
export async function createTestingApp(metadata: ModuleMetadata): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule(metadata).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("v1", { exclude: ["dashboard"] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  await app.init();
  return app;
}
