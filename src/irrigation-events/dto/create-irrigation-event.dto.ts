import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Length } from "class-validator";

/**
 * Firmware ingest payload for a completed irrigation cycle.
 * A single event per request (no batching). Extra keys are rejected by the
 * global validation pipe (`forbidNonWhitelisted`).
 */
export class CreateIrrigationEventDto {
  @ApiProperty({
    description: "Stable hardware device identity (one device per rented plot).",
    example: "hochbeet-001",
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @Length(1, 128)
  deviceId!: string;

  @ApiProperty({
    description:
      "Duration of the irrigation cycle in seconds. Values of zero or below are accepted as " +
      "sensor anomaly signals rather than rejected.",
    example: 10,
  })
  @IsInt()
  durationSeconds!: number;

  @ApiPropertyOptional({
    description:
      "Calibrated soil moisture before irrigation in %. Firmware clamps to 0–100; values " +
      "outside that range are accepted as sensor anomaly signals rather than rejected.",
    example: 18,
  })
  @IsOptional()
  // @IsInt() is intentional: the schema column is Float? but firmware always sends clamped
  // integer percentages (0–100). Fractional values would be rejected with 400.
  @IsInt()
  moistureBeforePercent?: number;
}
