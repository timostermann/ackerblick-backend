import { Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";

import type { CreateIrrigationEventDto } from "./dto/create-irrigation-event.dto";
import type { IrrigationEvent } from "../generated/prisma/client";

@Injectable()
export class IrrigationEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist a single irrigation event. The device self-registers (upsert) so
   * the FK is satisfied even though the Device table starts empty. `occurredAt`
   * is stamped server-side because the firmware has no clock.
   */
  async ingest(dto: CreateIrrigationEventDto): Promise<IrrigationEvent> {
    const occurredAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.device.upsert({
        where: { id: dto.deviceId },
        create: { id: dto.deviceId, lastSeenAt: occurredAt },
        update: { lastSeenAt: occurredAt },
      });

      return tx.irrigationEvent.create({
        data: {
          deviceId: dto.deviceId,
          durationSeconds: dto.durationSeconds,
          moistureBeforePercent: dto.moistureBeforePercent ?? null,
          occurredAt,
        },
      });
    });
  }

  /** Most recent irrigation events across all devices, newest first — for the dashboard. */
  findRecent(limit: number): Promise<IrrigationEvent[]> {
    return this.prisma.irrigationEvent.findMany({
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  }
}
