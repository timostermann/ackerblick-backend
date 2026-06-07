import { Controller, Get, Header, UseGuards } from "@nestjs/common";
import {
  ApiBasicAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { BasicAuthGuard } from "../common/guards/basic-auth.guard";

import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@ApiBasicAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @UseGuards(BasicAuthGuard)
  @Header("Content-Type", "text/html; charset=utf-8")
  @ApiOperation({
    summary: "Temporary server-rendered dashboard (HTML).",
    description:
      "Returns an HTML page (table + Chart.js soil-moisture line chart) of the most " +
      "recent readings. Protected by HTTP Basic auth. Not a JSON endpoint.",
  })
  @ApiUnauthorizedResponse({ description: "Invalid or missing credentials." })
  @ApiOkResponse({ description: "HTML page.", content: { "text/html": {} } })
  render(): Promise<string> {
    return this.dashboardService.renderHtml();
  }
}
