import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { API_KEY_HEADER, ApiKeyGuard } from "../common/guards/api-key.guard";

import { CreateIrrigationEventDto } from "./dto/create-irrigation-event.dto";
import { IrrigationEventResponseDto } from "./dto/irrigation-event-response.dto";
import { IrrigationEventsService } from "./irrigation-events.service";

@ApiTags("irrigation-events")
@ApiSecurity(API_KEY_HEADER)
@Controller("irrigation-events")
export class IrrigationEventsController {
  constructor(private readonly irrigationEventsService: IrrigationEventsService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Ingest a single irrigation event from a device.",
    description:
      "Validates and persists one irrigation cycle. The server stamps the receive time " +
      "(firmware has no clock) and auto-registers the device on first contact. " +
      "Fire-and-forget: firmware treats any 2xx as success.",
  })
  @ApiUnauthorizedResponse({ description: "Invalid or missing API key." })
  @ApiBadRequestResponse({
    description: "Validation failed (invalid or missing fields, extra keys).",
  })
  @ApiCreatedResponse({ type: IrrigationEventResponseDto })
  async create(@Body() dto: CreateIrrigationEventDto): Promise<IrrigationEventResponseDto> {
    await this.irrigationEventsService.ingest(dto);
    return { status: "ok" };
  }
}
