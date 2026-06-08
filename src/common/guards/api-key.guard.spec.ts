import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { API_KEY_HEADER, ApiKeyGuard } from "./api-key.guard";

import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";

function buildContext(headerValue?: string): ExecutionContext {
  const request = {
    header: (name: string): string | undefined =>
      name === API_KEY_HEADER ? headerValue : undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildGuard(expectedKey: string | undefined): ApiKeyGuard {
  const config = { get: () => expectedKey } as unknown as ConfigService;
  return new ApiKeyGuard(config);
}

describe("ApiKeyGuard", () => {
  it("allows a request with the correct API key", () => {
    const guard = buildGuard("secret-key");

    expect(guard.canActivate(buildContext("secret-key"))).toBe(true);
  });

  it("rejects a request with a wrong API key", () => {
    const guard = buildGuard("secret-key");

    expect(() => guard.canActivate(buildContext("wrong-key"))).toThrow(UnauthorizedException);
  });

  it("rejects a request with no API key header", () => {
    const guard = buildGuard("secret-key");

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(UnauthorizedException);
  });

  it("rejects when no API key is configured", () => {
    const guard = buildGuard(undefined);

    expect(() => guard.canActivate(buildContext("anything"))).toThrow(UnauthorizedException);
  });

  it("rejects when an empty string API key is configured", () => {
    const guard = buildGuard("");

    expect(() => guard.canActivate(buildContext("anything"))).toThrow(UnauthorizedException);
  });
});
