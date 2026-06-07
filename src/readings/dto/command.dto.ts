import { ApiProperty } from "@nestjs/swagger";

/**
 * A single actionable command sent back to the device in the POST response.
 * The `commands` array is always empty today; the typed shape is established now
 * so the wire format is stable when irrigation control arrives.
 */
export class CommandDto {
  @ApiProperty({
    description: "Action for the device to execute.",
    example: "irrigate",
  })
  action!: string;

  @ApiProperty({
    description: "Duration in seconds for which to run the action.",
    example: 30,
  })
  durationSeconds!: number;
}
