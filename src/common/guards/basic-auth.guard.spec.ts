import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BasicAuthGuard } from "./basic-auth.guard";

import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";

function encode(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

function buildContext(authHeader?: string): {
  context: ExecutionContext;
  setHeader: ReturnType<typeof vi.fn>;
} {
  const setHeader = vi.fn();
  const request = {
    header: (name: string): string | undefined =>
      name.toLowerCase() === "authorization" ? authHeader : undefined,
  };
  const response = { setHeader };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  return { context, setHeader };
}

function buildGuard(): BasicAuthGuard {
  const config = {
    get: (key: string) => (key === "DASHBOARD_USER" ? "admin" : "s3cret"),
  } as unknown as ConfigService;
  return new BasicAuthGuard(config);
}

describe("BasicAuthGuard", () => {
  it("allows a request with correct credentials", () => {
    const { context } = buildContext(encode("admin", "s3cret"));

    expect(buildGuard().canActivate(context)).toBe(true);
  });

  it("rejects a request with wrong credentials", () => {
    const { context } = buildContext(encode("admin", "nope"));

    expect(() => buildGuard().canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when credentials are missing", () => {
    const { context } = buildContext(undefined);

    expect(() => buildGuard().canActivate(context)).toThrow(UnauthorizedException);
  });

  it("sets WWW-Authenticate header when credentials are missing", () => {
    const { context, setHeader } = buildContext(undefined);

    try {
      buildGuard().canActivate(context);
    } catch {
      // expected throw — we only care about the side-effect below
    }

    expect(setHeader).toHaveBeenCalledWith("WWW-Authenticate", expect.stringContaining("Basic"));
  });

  it("throws when DASHBOARD_USER is not configured", () => {
    const config = {
      get: (key: string): string | undefined =>
        key === "DASHBOARD_PASSWORD" ? "s3cret" : undefined,
    } as unknown as ConfigService;
    const { context } = buildContext(encode("admin", "s3cret"));

    expect(() => new BasicAuthGuard(config).canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws when DASHBOARD_PASSWORD is not configured", () => {
    const config = {
      get: (key: string): string | undefined => (key === "DASHBOARD_USER" ? "admin" : undefined),
    } as unknown as ConfigService;
    const { context } = buildContext(encode("admin", "s3cret"));

    expect(() => new BasicAuthGuard(config).canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects a non-Basic authorization scheme", () => {
    const { context } = buildContext("Bearer some-token");

    expect(() => buildGuard().canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects a Basic header with no encoded token", () => {
    const { context } = buildContext("Basic");

    expect(() => buildGuard().canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects base64 credentials with no colon separator", () => {
    const { context } = buildContext(`Basic ${Buffer.from("nocolon").toString("base64")}`);

    expect(() => buildGuard().canActivate(context)).toThrow(UnauthorizedException);
  });
});
