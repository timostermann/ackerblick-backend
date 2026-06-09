import { describe, expect, it, vi } from "vitest";

import { DashboardService } from "./dashboard.service";

import type { IrrigationEvent, SensorReading } from "../generated/prisma/client";
import type { IrrigationEventsService } from "../irrigation-events/irrigation-events.service";
import type { ReadingsService } from "../readings/readings.service";
import type { ConfigService } from "@nestjs/config";

function buildReading(overrides: Partial<SensorReading> = {}): SensorReading {
  return {
    id: "cuid-1",
    deviceId: "device-1",
    soilMoisturePercent: 42,
    airTemperatureCelsius: null,
    relativeHumidityPercent: null,
    airPressureHpa: null,
    batteryVoltage: null,
    recordedAt: new Date("2024-01-15T10:00:00.000Z"),
    createdAt: new Date("2024-01-15T10:00:00.000Z"),
    ...overrides,
  };
}

function buildIrrigationEvent(overrides: Partial<IrrigationEvent> = {}): IrrigationEvent {
  return {
    id: "cuid-evt-1",
    deviceId: "device-1",
    durationSeconds: 10,
    moistureBeforePercent: 18,
    moistureAfterPercent: null,
    waterVolumeLiters: null,
    occurredAt: new Date("2024-01-15T10:05:00.000Z"),
    createdAt: new Date("2024-01-15T10:05:00.000Z"),
    ...overrides,
  };
}

function buildService(
  configValue: string | undefined,
  readings: SensorReading[] = [],
  events: IrrigationEvent[] = [],
) {
  const findRecentReadings = vi.fn().mockResolvedValue(readings);
  const findRecentEvents = vi.fn().mockResolvedValue(events);
  const mockReadings = { findRecent: findRecentReadings } as unknown as ReadingsService;
  const mockIrrigationEvents = {
    findRecent: findRecentEvents,
  } as unknown as IrrigationEventsService;
  const mockConfig = { get: () => configValue } as unknown as ConfigService;
  return {
    service: new DashboardService(mockReadings, mockIrrigationEvents, mockConfig),
    findRecentReadings,
    findRecentEvents,
  };
}

describe("DashboardService.resolveLimit", () => {
  it("passes the configured limit to findRecent", async () => {
    const { service, findRecentReadings } = buildService("50");
    await service.renderHtml();
    expect(findRecentReadings).toHaveBeenCalledWith(50);
  });

  it("uses the default limit when the env var is undefined", async () => {
    const { service, findRecentReadings } = buildService(undefined);
    await service.renderHtml();
    expect(findRecentReadings).toHaveBeenCalledWith(200);
  });

  it("uses the default limit when the env var is not a number", async () => {
    const { service, findRecentReadings } = buildService("abc");
    await service.renderHtml();
    expect(findRecentReadings).toHaveBeenCalledWith(200);
  });

  it("uses the default limit when the env var is zero", async () => {
    const { service, findRecentReadings } = buildService("0");
    await service.renderHtml();
    expect(findRecentReadings).toHaveBeenCalledWith(200);
  });

  it("uses the default limit when the env var is negative", async () => {
    const { service, findRecentReadings } = buildService("-5");
    await service.renderHtml();
    expect(findRecentReadings).toHaveBeenCalledWith(200);
  });

  it("caps the limit at 1000", async () => {
    const { service, findRecentReadings } = buildService("2000");
    await service.renderHtml();
    expect(findRecentReadings).toHaveBeenCalledWith(1000);
  });
});

describe("DashboardService.renderHtml", () => {
  it("renders the empty-state paragraph when there are no readings", async () => {
    const { service } = buildService(undefined, []);
    const html = await service.renderHtml();
    expect(html).toContain('<p class="empty">');
  });

  it("HTML-escapes special characters in deviceId", async () => {
    const { service } = buildService(undefined, [buildReading({ deviceId: "<b>bold</b>" })]);
    const html = await service.renderHtml();
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("renders chart labels in chronological order even when readings arrive newest-first", async () => {
    const older = buildReading({ id: "a", recordedAt: new Date("2024-01-14T10:00:00.000Z") });
    const newer = buildReading({ id: "b", recordedAt: new Date("2024-01-15T10:00:00.000Z") });
    const { service } = buildService(undefined, [newer, older]);
    const html = await service.renderHtml();
    const labelsJson = html.split("const labels = ")[1]?.split(";")[0] ?? "[]";
    const labels = JSON.parse(labelsJson) as string[];
    expect(labels[0]).toBe("2024-01-14T10:00:00.000Z");
  });
});

describe("DashboardService.renderHtml — irrigation events", () => {
  it("renders the irrigation empty-state when there are no events", async () => {
    const { service } = buildService(undefined);
    const html = await service.renderHtml();
    expect(html).toContain("No irrigation events yet.");
  });

  it("renders the event duration in the irrigation table", async () => {
    const { service } = buildService(
      undefined,
      [],
      [buildIrrigationEvent({ durationSeconds: 10 })],
    );
    const html = await service.renderHtml();
    expect(html).toContain("10s");
  });

  it("fetches irrigation events with a limit of 50", async () => {
    const { service, findRecentEvents } = buildService(undefined);
    await service.renderHtml();
    expect(findRecentEvents).toHaveBeenCalledWith(50);
  });
});
