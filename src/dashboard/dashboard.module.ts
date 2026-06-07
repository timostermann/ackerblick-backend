import { Module } from "@nestjs/common";

import { ReadingsModule } from "../readings/readings.module";

import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [ReadingsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
