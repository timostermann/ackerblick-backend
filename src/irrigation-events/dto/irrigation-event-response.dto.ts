import { ApiProperty } from "@nestjs/swagger";

/**
 * Minimal acknowledgement response. The firmware ignores the body; any 2xx is
 * treated as success (fire-and-forget).
 */
export class IrrigationEventResponseDto {
  @ApiProperty({ description: "Ingest result.", example: "ok", enum: ["ok"] })
  status!: "ok";
}
