import { ConfigService } from "@nestjs/config";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestingApp } from "../../test-utils";
import { ApiKeyGuard } from "../common/guards/api-key.guard";

import { ReadingsController } from "./readings.controller";
import { ReadingsService } from "./readings.service";

import type { INestApplication } from "@nestjs/common";

const mockReadingsService = { ingest: vi.fn().mockResolvedValue(undefined) };
const mockConfigService = {
  get: (key: string) => (key === "API_KEY" ? "test-key" : undefined),
};

async function post(
  app: INestApplication,
  body: object,
  apiKey?: string,
): Promise<request.Response> {
  const req = request(app.getHttpServer()).post("/v1/readings").send(body);
  if (apiKey !== undefined) {
    req.set("x-api-key", apiKey);
  }
  return req;
}

describe("POST /v1/readings (HTTP integration)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestingApp({
      controllers: [ReadingsController],
      providers: [
        { provide: ReadingsService, useValue: mockReadingsService },
        { provide: ConfigService, useValue: mockConfigService },
        ApiKeyGuard,
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 201 for a valid payload", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", soilMoisture: 42 }, "test-key");

    expect(res.status).toBe(201);
  });

  it("returns the structured command envelope for a valid payload", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", soilMoisture: 42 }, "test-key");

    expect(res.body).toEqual({ status: "ok", commands: [] });
  });

  it("returns 401 when the API key header is missing", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", soilMoisture: 42 });

    expect(res.status).toBe(401);
  });

  it("returns 401 when the API key is wrong", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", soilMoisture: 42 }, "wrong-key");

    expect(res.status).toBe(401);
  });

  it("returns 400 when deviceId is missing", async () => {
    const res = await post(app, { soilMoisture: 42 }, "test-key");

    expect(res.status).toBe(400);
  });

  it("returns 400 when deviceId is an empty string", async () => {
    const res = await post(app, { deviceId: "", soilMoisture: 42 }, "test-key");

    expect(res.status).toBe(400);
  });

  it("returns 400 when deviceId exceeds 128 characters", async () => {
    const res = await post(app, { deviceId: "a".repeat(129), soilMoisture: 42 }, "test-key");

    expect(res.status).toBe(400);
  });

  it("returns 400 when soilMoisture is missing", async () => {
    const res = await post(app, { deviceId: "hochbeet-001" }, "test-key");

    expect(res.status).toBe(400);
  });

  it("returns 400 when soilMoisture is not an integer", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", soilMoisture: 42.5 }, "test-key");

    expect(res.status).toBe(400);
  });

  it("accepts negative soilMoisture as a sensor anomaly signal", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", soilMoisture: -1 }, "test-key");

    expect(res.status).toBe(201);
  });

  it("returns 400 when extra keys are present", async () => {
    const res = await post(
      app,
      { deviceId: "hochbeet-001", soilMoisture: 42, extra: "field" },
      "test-key",
    );

    expect(res.status).toBe(400);
  });

  it("accepts soilMoisture above 100 as a sensor anomaly signal", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", soilMoisture: 150 }, "test-key");

    expect(res.status).toBe(201);
  });
});
