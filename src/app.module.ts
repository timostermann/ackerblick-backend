import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { DashboardModule } from "./dashboard/dashboard.module";
import { DatabaseModule } from "./database/database.module";
import { ReadingsModule } from "./readings/readings.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ReadingsModule,
    DashboardModule,
  ],
})
export class AppModule {}
