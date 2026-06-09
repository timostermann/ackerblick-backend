import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFixture } from "../../test-utils/fixtures";
import { PrismaService } from "../database/prisma.service";

import { IrrigationEventsService } from "./irrigation-events.service";

import type { CreateIrrigationEventDto } from "./dto/create-irrigation-event.dto";

const createIrrigationEventDto = createFixture<CreateIrrigationEventDto>({
  deviceId: "hochbeet-001",
  durationSeconds: 10,
  moistureBeforePercent: 18,
});

const tx = {
  device: { upsert: vi.fn() },
  irrigationEvent: { create: vi.fn() },
};

const mockPrisma = {
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  irrigationEvent: { findMany: vi.fn() },
};

describe("IrrigationEventsService", () => {
  let service: IrrigationEventsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [IrrigationEventsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(IrrigationEventsService);
  });

  it("persists the event with the durationSeconds value", async () => {
    await service.ingest(createIrrigationEventDto());

    expect(tx.irrigationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deviceId: "hochbeet-001", durationSeconds: 10 }),
    });
  });

  it("stamps occurredAt server-side", async () => {
    await service.ingest(createIrrigationEventDto());

    expect(tx.irrigationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ occurredAt: expect.any(Date) }),
    });
  });

  it("auto-registers the device on ingest", async () => {
    await service.ingest(createIrrigationEventDto({ deviceId: "hochbeet-007" }));

    expect(tx.device.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "hochbeet-007" } }),
    );
  });

  it("writes lastSeenAt to the device record on ingest", async () => {
    await service.ingest(createIrrigationEventDto());

    expect(tx.device.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ lastSeenAt: expect.any(Date) }),
        update: expect.objectContaining({ lastSeenAt: expect.any(Date) }),
      }),
    );
  });

  it("maps moistureBeforePercent when provided", async () => {
    await service.ingest(createIrrigationEventDto({ moistureBeforePercent: 18 }));

    expect(tx.irrigationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ moistureBeforePercent: 18 }),
    });
  });

  it("writes null for moistureBeforePercent when omitted", async () => {
    await service.ingest(createIrrigationEventDto({ moistureBeforePercent: undefined }));

    expect(tx.irrigationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ moistureBeforePercent: null }),
    });
  });

  it("does not write moistureAfterPercent to the DB", async () => {
    await service.ingest(createIrrigationEventDto());

    expect(tx.irrigationEvent.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ moistureAfterPercent: expect.anything() }),
    });
  });

  it("requests recent events newest-first with the given limit", async () => {
    mockPrisma.irrigationEvent.findMany.mockResolvedValue([]);

    await service.findRecent(50);

    expect(mockPrisma.irrigationEvent.findMany).toHaveBeenCalledWith({
      orderBy: { occurredAt: "desc" },
      take: 50,
    });
  });
});
