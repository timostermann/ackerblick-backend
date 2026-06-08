import { createHash, timingSafeEqual } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * HTTP Basic auth for the dashboard. Browser-friendly: emits a
 * `WWW-Authenticate` header on failure so the browser shows a login prompt.
 */
@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const expectedUser = this.config.get<string>("DASHBOARD_USER");
    const expectedPassword = this.config.get<string>("DASHBOARD_PASSWORD");

    if (!expectedUser || !expectedPassword) {
      throw new UnauthorizedException("Dashboard authentication is not configured");
    }

    const credentials = parseBasicAuth(request.header("authorization"));
    let authorized = false;
    if (credentials !== null) {
      const userOk = safeEqual(credentials.user, expectedUser);
      const passOk = safeEqual(credentials.password, expectedPassword);
      authorized = userOk && passOk;
    }

    if (!authorized) {
      response.setHeader("WWW-Authenticate", 'Basic realm="Ackerblick Dashboard", charset="UTF-8"');
      throw new UnauthorizedException("Dashboard credentials required");
    }

    return true;
  }
}

function parseBasicAuth(header: string | undefined): { user: string; password: string } | null {
  if (header === undefined) {
    return null;
  }
  const [scheme, encoded] = header.split(" ");
  if (scheme?.toLowerCase() !== "basic" || encoded === undefined) {
    return null;
  }
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return null;
  }
  return {
    user: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function safeEqual(a: string, b: string): boolean {
  const digest = (s: string): Buffer => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}
