import "dotenv/config";

import { defineConfig, env } from "prisma/config";

// Prisma 7 reads the migrate/CLI datasource from here (the schema no longer
// carries a `url`). The runtime connection is provided separately via the
// @prisma/adapter-pg driver adapter in PrismaService.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
