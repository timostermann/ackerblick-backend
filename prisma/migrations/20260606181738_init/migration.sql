-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "ParcelKind" AS ENUM ('PRODUCTIVE', 'BIODIVERSITY');

-- CreateEnum
CREATE TYPE "ServiceTier" AS ENUM ('BASIC_RENTAL', 'SMART_GARDEN', 'GARDEN_AS_A_SERVICE', 'FULL_SERVICE_DELIVERY', 'REGENERATIVE');

-- CreateEnum
CREATE TYPE "ParcelEventType" AS ENUM ('PLANTING', 'CARE', 'HARVEST', 'PEST_MANAGEMENT');

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "soilMoisturePercent" DOUBLE PRECISION,
    "airTemperatureCelsius" DOUBLE PRECISION,
    "relativeHumidityPercent" DOUBLE PRECISION,
    "airPressureHpa" DOUBLE PRECISION,
    "batteryVoltage" DOUBLE PRECISION,
    "recordedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("recordedAt","id")
);

-- CreateTable
CREATE TABLE "IrrigationEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "moistureBeforePercent" DOUBLE PRECISION,
    "moistureAfterPercent" DOUBLE PRECISION,
    "waterVolumeLiters" DOUBLE PRECISION,
    "occurredAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IrrigationEvent_pkey" PRIMARY KEY ("occurredAt","id")
);

-- CreateTable
CREATE TABLE "CameraImage" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "storageUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CameraImage_pkey" PRIMARY KEY ("capturedAt","id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "hardware" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "installedAt" TIMESTAMPTZ,
    "lastSeenAt" TIMESTAMPTZ,
    "parcelId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Field" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "ParcelKind" NOT NULL DEFAULT 'PRODUCTIVE',
    "serviceTier" "ServiceTier" NOT NULL DEFAULT 'BASIC_RENTAL',
    "fieldId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropVariety" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropVariety_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelPlanting" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "cropVarietyId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "plantedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelPlanting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelEvent" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "type" "ParcelEventType" NOT NULL,
    "notes" TEXT,
    "occurredAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoilAnalysis" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "humusPercent" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "nitrogenMgPerKg" DOUBLE PRECISION,
    "phosphorusMgPerKg" DOUBLE PRECISION,
    "potassiumMgPerKg" DOUBLE PRECISION,
    "sampledAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoilAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SensorReading_deviceId_recordedAt_idx" ON "SensorReading"("deviceId", "recordedAt");

-- CreateIndex
CREATE INDEX "SensorReading_recordedAt_idx" ON "SensorReading"("recordedAt");

-- CreateIndex
CREATE INDEX "IrrigationEvent_deviceId_occurredAt_idx" ON "IrrigationEvent"("deviceId", "occurredAt");

-- CreateIndex
CREATE INDEX "IrrigationEvent_occurredAt_idx" ON "IrrigationEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "CameraImage_deviceId_capturedAt_idx" ON "CameraImage"("deviceId", "capturedAt");

-- CreateIndex
CREATE INDEX "CameraImage_capturedAt_idx" ON "CameraImage"("capturedAt");

-- CreateIndex
CREATE INDEX "Device_parcelId_idx" ON "Device"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Parcel_customerId_idx" ON "Parcel"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_fieldId_code_key" ON "Parcel"("fieldId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CropVariety_name_key" ON "CropVariety"("name");

-- CreateIndex
CREATE INDEX "ParcelPlanting_parcelId_season_idx" ON "ParcelPlanting"("parcelId", "season");

-- CreateIndex
CREATE INDEX "ParcelEvent_parcelId_occurredAt_idx" ON "ParcelEvent"("parcelId", "occurredAt");

-- CreateIndex
CREATE INDEX "SoilAnalysis_parcelId_sampledAt_idx" ON "SoilAnalysis"("parcelId", "sampledAt");

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationEvent" ADD CONSTRAINT "IrrigationEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraImage" ADD CONSTRAINT "CameraImage_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelPlanting" ADD CONSTRAINT "ParcelPlanting_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelPlanting" ADD CONSTRAINT "ParcelPlanting_cropVarietyId_fkey" FOREIGN KEY ("cropVarietyId") REFERENCES "CropVariety"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelEvent" ADD CONSTRAINT "ParcelEvent_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilAnalysis" ADD CONSTRAINT "SoilAnalysis_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =========================================================================
-- TimescaleDB (appended by hand — documented exception to "don't edit
-- generated migrations", see AGENTS.md / docs/data-model.md).
--
-- Convert the append-only time-series tables into hypertables. The composite
-- primary keys above already put the partition column first, satisfying the
-- TimescaleDB requirement that a unique index includes the partition column.
-- The explicit single-column time indexes above match TimescaleDB's default
-- index, so no drift is introduced. Tables are empty here, so no data
-- migration is needed.
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS timescaledb;

SELECT create_hypertable('"SensorReading"', 'recordedAt', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);
SELECT create_hypertable('"IrrigationEvent"', 'occurredAt', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);
SELECT create_hypertable('"CameraImage"', 'capturedAt', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);
