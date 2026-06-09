import { ConfigService } from "@nestjs/config";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestingApp } from "../../test-utils";
import { ApiKeyGuard } from "../common/guards/api-key.guard";

import { IrrigationEventsController } from "./irrigation-events.controller";
import { IrrigationEventsService } from "./irrigation-events.service";

import type { INestApplication } from "@nestjs/common";

const mockIrrigationEventsService = { ingest: vi.fn().mockResolvedValue(undefined) };
const mockConfigService = {
  get: (key: string) => (key === "API_KEY" ? "test-key" : undefined),
};

async function post(
  app: INestApplication,
  body: object,
  apiKey?: string,
): Promise<request.Response> {
  const req = request(app.getHttpServer()).post("/v1/irrigation-events").send(body);
  if (apiKey !== undefined) {
    req.set("x-api-key", apiKey);
  }
  return req;
}

describe("POST /v1/irrigation-events (HTTP integration)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestingApp({
      controllers: [IrrigationEventsController],
      providers: [
        { provide: IrrigationEventsService, useValue: mockIrrigationEventsService },
        { provide: ConfigService, useValue: mockConfigService },
        ApiKeyGuard,
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 for a valid full payload", async () => {
    const res = await post(
      app,
      {
        deviceId: "hochbeet-001",
        durationSeconds: 10,
        moistureBeforePercent: 18,
      },
      "test-key",
    );

    expect(res.status).toBe(201);
  });

  it("returns { status: 'ok' } body for a valid payload", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", durationSeconds: 10 }, "test-key");

    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns 401 when the API key header is missing", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", durationSeconds: 10 });

    expect(res.status).toBe(401);
  });

  it("returns 401 when the API key is wrong", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", durationSeconds: 10 }, "wrong-key");

    expect(res.status).toBe(401);
  });

  it("returns 400 when deviceId is missing", async () => {
    const res = await post(app, { durationSeconds: 10 }, "test-key");

    expect(res.status).toBe(400);
  });

  it("returns 400 when deviceId is an empty string", async () => {
    const res = await post(app, { deviceId: "", durationSeconds: 10 }, "test-key");

    expect(res.status).toBe(400);
  });

  it("returns 400 when deviceId exceeds 128 characters", async () => {
    const res = await post(app, { deviceId: "a".repeat(129), durationSeconds: 10 }, "test-key");

    expect(res.status).toBe(400);
  });

  it("returns 400 when durationSeconds is missing", async () => {
    const res = await post(app, { deviceId: "hochbeet-001" }, "test-key");

    expect(res.status).toBe(400);
  });

  it("returns 400 when durationSeconds is not an integer", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", durationSeconds: 10.5 }, "test-key");

    expect(res.status).toBe(400);
  });

  it("returns 201 when durationSeconds is 0 (anomaly signal accepted)", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", durationSeconds: 0 }, "test-key");

    expect(res.status).toBe(201);
  });

  it("returns 400 when extra keys are present", async () => {
    const res = await post(
      app,
      { deviceId: "hochbeet-001", durationSeconds: 10, extra: "field" },
      "test-key",
    );

    expect(res.status).toBe(400);
  });

  it("returns 201 when optional moisture fields are absent", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", durationSeconds: 10 }, "test-key");

    expect(res.status).toBe(201);
  });

  it("returns 201 when durationSeconds is negative (anomaly signal accepted)", async () => {
    const res = await post(app, { deviceId: "hochbeet-001", durationSeconds: -1 }, "test-key");

    expect(res.status).toBe(201);
  });

  it("returns 201 when moistureBeforePercent is above 100 (anomaly signal accepted)", async () => {
    const res = await post(
      app,
      { deviceId: "hochbeet-001", durationSeconds: 10, moistureBeforePercent: 200 },
      "test-key",
    );

    expect(res.status).toBe(201);
  });
});
