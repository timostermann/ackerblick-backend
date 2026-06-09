import { Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";

import type { CreateReadingDto } from "./dto/create-reading.dto";
import type { SensorReading } from "../generated/prisma/client";

@Injectable()
export class ReadingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist a single reading. The device self-registers (upsert) so the FK is
   * satisfied even though the Device table starts empty. `recordedAt` is stamped
   * server-side because the firmware has no clock.
   */
  async ingest(dto: CreateReadingDto): Promise<SensorReading> {
    const recordedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.device.upsert({
        where: { id: dto.deviceId },
        create: { id: dto.deviceId, lastSeenAt: recordedAt },
        update: { lastSeenAt: recordedAt },
      });

      return tx.sensorReading.create({
        data: {
          deviceId: dto.deviceId,
          soilMoisturePercent: dto.soilMoisture,
          airTemperatureCelsius: dto.temperature ?? null,
          relativeHumidityPercent: dto.humidity ?? null,
          airPressureHpa: dto.pressure ?? null,
          recordedAt,
        },
      });
    });
  }

  /** Most recent readings across all devices, newest first — for the dashboard. */
  findRecent(limit: number): Promise<SensorReading[]> {
    return this.prisma.sensorReading.findMany({
      orderBy: { recordedAt: "desc" },
      take: limit,
    });
  }
}
