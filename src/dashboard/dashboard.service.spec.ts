import { describe, expect, it, vi } from "vitest";

import { DashboardService } from "./dashboard.service";

import type { SensorReading } from "../generated/prisma/client";
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

function buildService(configValue: string | undefined, readings: SensorReading[] = []) {
  const findRecent = vi.fn().mockResolvedValue(readings);
  const mockReadings = { findRecent } as unknown as ReadingsService;
  const mockConfig = { get: () => configValue } as unknown as ConfigService;
  return { service: new DashboardService(mockReadings, mockConfig), findRecent };
}

describe("DashboardService.resolveLimit", () => {
  it("passes the configured limit to findRecent", async () => {
    const { service, findRecent } = buildService("50");
    await service.renderHtml();
    expect(findRecent).toHaveBeenCalledWith(50);
  });

  it("uses the default limit when the env var is undefined", async () => {
    const { service, findRecent } = buildService(undefined);
    await service.renderHtml();
    expect(findRecent).toHaveBeenCalledWith(200);
  });

  it("uses the default limit when the env var is not a number", async () => {
    const { service, findRecent } = buildService("abc");
    await service.renderHtml();
    expect(findRecent).toHaveBeenCalledWith(200);
  });

  it("uses the default limit when the env var is zero", async () => {
    const { service, findRecent } = buildService("0");
    await service.renderHtml();
    expect(findRecent).toHaveBeenCalledWith(200);
  });

  it("uses the default limit when the env var is negative", async () => {
    const { service, findRecent } = buildService("-5");
    await service.renderHtml();
    expect(findRecent).toHaveBeenCalledWith(200);
  });

  it("caps the limit at 1000", async () => {
    const { service, findRecent } = buildService("2000");
    await service.renderHtml();
    expect(findRecent).toHaveBeenCalledWith(1000);
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
