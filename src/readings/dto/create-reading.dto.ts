import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Length } from "class-validator";

/**
 * Firmware ingest payload. Field names are semantic, not hardware-specific.
 * A single reading per request (no batching). Extra keys are rejected by the
 * global validation pipe (`forbidNonWhitelisted`).
 */
export class CreateReadingDto {
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
      "Calibrated soil moisture in %. Firmware clamps to 0–100; values outside that range " +
      "(including negatives) are accepted as sensor anomaly signals rather than rejected.",
    example: 42,
  })
  @IsInt()
  soilMoisture!: number;
}
