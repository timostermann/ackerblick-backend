import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { API_KEY_HEADER, ApiKeyGuard } from "../common/guards/api-key.guard";

import { CreateReadingDto } from "./dto/create-reading.dto";
import { ReadingResponseDto } from "./dto/reading-response.dto";
import { ReadingsService } from "./readings.service";

@ApiTags("readings")
@ApiSecurity(API_KEY_HEADER)
@Controller("readings")
export class ReadingsController {
  constructor(private readonly readingsService: ReadingsService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Ingest a single sensor reading from a device.",
    description:
      "Validates and persists one reading. The server stamps the receive time " +
      "(firmware has no clock) and auto-registers the device on first contact. " +
      "Returns a minimal command envelope (reserved for future irrigation commands).",
  })
  @ApiUnauthorizedResponse({ description: "Invalid or missing API key." })
  @ApiCreatedResponse({ type: ReadingResponseDto })
  async create(@Body() dto: CreateReadingDto): Promise<ReadingResponseDto> {
    await this.readingsService.ingest(dto);
    return { status: "ok", commands: [] };
  }
}
