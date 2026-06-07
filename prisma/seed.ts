import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * Minimal idempotent seed. The prototype only exercises the time-series side and
 * devices self-register on ingest, so we just ensure the demo device exists for
 * convenience. Tenancy/agronomy tables stay empty by design.
 */
async function main(): Promise<void> {
  await prisma.device.upsert({
    where: { id: "hochbeet-001" },
    create: {
      id: "hochbeet-001",
      label: "Demo Hochbeet",
      hardware: "ESP32-WROVER + capacitive moisture",
    },
    update: {},
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch((error: unknown) => {
    console.error(error);
    void prisma.$disconnect();
    process.exitCode = 1;
  });
