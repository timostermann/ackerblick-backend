import { ConfigService } from "@nestjs/config";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestingApp } from "../../test-utils";
import { BasicAuthGuard } from "../common/guards/basic-auth.guard";
import { ReadingsService } from "../readings/readings.service";

import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

import type { INestApplication } from "@nestjs/common";

const VALID_USER = "admin";
const VALID_PASSWORD = "s3cret";

function basicAuth(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

const mockReadingsService = { findRecent: vi.fn().mockResolvedValue([]) };
const mockConfigService = {
  get: (key: string): string | undefined => {
    if (key === "DASHBOARD_USER") return VALID_USER;
    if (key === "DASHBOARD_PASSWORD") return VALID_PASSWORD;
    return undefined;
  },
};

describe("GET /dashboard (HTTP integration)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestingApp({
      controllers: [DashboardController],
      providers: [
        DashboardService,
        { provide: ReadingsService, useValue: mockReadingsService },
        { provide: ConfigService, useValue: mockConfigService },
        BasicAuthGuard,
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 for valid credentials", async () => {
    const res = await request(app.getHttpServer())
      .get("/dashboard")
      .set("Authorization", basicAuth(VALID_USER, VALID_PASSWORD));

    expect(res.status).toBe(200);
  });

  it("returns Content-Type text/html for valid credentials", async () => {
    const res = await request(app.getHttpServer())
      .get("/dashboard")
      .set("Authorization", basicAuth(VALID_USER, VALID_PASSWORD));

    expect(res.headers["content-type"]).toMatch(/text\/html/);
  });

  it("returns 401 when no credentials are provided", async () => {
    const res = await request(app.getHttpServer()).get("/dashboard");

    expect(res.status).toBe(401);
  });

  it("returns 401 for wrong credentials", async () => {
    const res = await request(app.getHttpServer())
      .get("/dashboard")
      .set("Authorization", basicAuth(VALID_USER, "wrong"));

    expect(res.status).toBe(401);
  });

  it("returns 404 for GET /v1/dashboard (prefix excluded from versioning)", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/dashboard")
      .set("Authorization", basicAuth(VALID_USER, VALID_PASSWORD));

    expect(res.status).toBe(404);
  });
});
