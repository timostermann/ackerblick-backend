import { ApiProperty } from "@nestjs/swagger";

import { CommandDto } from "./command.dto";

/**
 * Minimal structured response. The device ignores the body today, but the
 * `commands` array reserves the only channel back to a deep-sleeping device
 * (the HTTP response to its POST) for future irrigation commands.
 */
export class ReadingResponseDto {
  @ApiProperty({ description: "Ingest result.", example: "ok", enum: ["ok"] })
  status!: "ok";

  @ApiProperty({
    description: "Commands for the device to execute (reserved; always empty today).",
    example: [],
    type: [CommandDto],
  })
  commands!: CommandDto[];
}
