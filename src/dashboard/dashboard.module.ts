import { Module } from "@nestjs/common";

import { IrrigationEventsModule } from "../irrigation-events/irrigation-events.module";
import { ReadingsModule } from "../readings/readings.module";

import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [ReadingsModule, IrrigationEventsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
