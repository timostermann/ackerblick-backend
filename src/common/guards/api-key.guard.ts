import { createHash, timingSafeEqual } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export const API_KEY_HEADER = "x-api-key";

/**
 * Coarse gate for firmware ingest: validates the shared static `X-API-Key`
 * header against the configured `API_KEY`. Low-trust by design (plaintext in
 * firmware flash). Per-device keys can replace this later.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header(API_KEY_HEADER);
    const expected = this.config.get<string>("API_KEY");

    if (expected === undefined || expected === "") {
      throw new UnauthorizedException("API key authentication is not configured");
    }

    if (provided === undefined || !safeEqual(provided, expected)) {
      throw new UnauthorizedException("Invalid or missing API key");
    }

    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const digest = (s: string): Buffer => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}
