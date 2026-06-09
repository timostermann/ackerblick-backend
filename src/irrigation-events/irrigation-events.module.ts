import { Module } from "@nestjs/common";

import { IrrigationEventsController } from "./irrigation-events.controller";
import { IrrigationEventsService } from "./irrigation-events.service";

@Module({
  controllers: [IrrigationEventsController],
  providers: [IrrigationEventsService],
  exports: [IrrigationEventsService],
})
export class IrrigationEventsModule {}
