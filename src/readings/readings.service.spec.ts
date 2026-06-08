import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFixture } from "../../test-utils/fixtures";
import { PrismaService } from "../database/prisma.service";

import { ReadingsService } from "./readings.service";

import type { CreateReadingDto } from "./dto/create-reading.dto";

const createReadingDto = createFixture<CreateReadingDto>({
  deviceId: "hochbeet-001",
  soilMoisture: 42,
});

const tx = {
  device: { upsert: vi.fn() },
  sensorReading: { create: vi.fn() },
};

const mockPrisma = {
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  sensorReading: { findMany: vi.fn() },
};

describe("ReadingsService", () => {
  let service: ReadingsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ReadingsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(ReadingsService);
  });

  it("persists the reading with the soil moisture value", async () => {
    await service.ingest(createReadingDto());

    expect(tx.sensorReading.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deviceId: "hochbeet-001", soilMoisturePercent: 42 }),
    });
  });

  it("stamps recordedAt server-side", async () => {
    await service.ingest(createReadingDto());

    expect(tx.sensorReading.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ recordedAt: expect.any(Date) }),
    });
  });

  it("auto-registers the device on ingest", async () => {
    await service.ingest(createReadingDto({ deviceId: "hochbeet-007" }));

    expect(tx.device.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "hochbeet-007" } }),
    );
  });

  it("writes lastSeenAt to the device record on ingest", async () => {
    await service.ingest(createReadingDto());

    expect(tx.device.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ lastSeenAt: expect.any(Date) }),
        update: expect.objectContaining({ lastSeenAt: expect.any(Date) }),
      }),
    );
  });

  it("requests recent readings newest-first with the given limit", async () => {
    mockPrisma.sensorReading.findMany.mockResolvedValue([]);

    await service.findRecent(50);

    expect(mockPrisma.sensorReading.findMany).toHaveBeenCalledWith({
      orderBy: { recordedAt: "desc" },
      take: 50,
    });
  });
});
