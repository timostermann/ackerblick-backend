# Ackerblick Data Model

The conceptual model for Ackerblick — a rent-a-garden service where customers
rent a **parcel** on a **field**, choose crops, and get it monitored (and
optionally managed) by Ackerblick. This document describes the domain in OML
(Ontological Modeling Language) for the long-term vision, with the concrete
Prisma schema for the prototype at the end.

The prototype only exercises the time-series side (one device streaming
readings). Everything else is modelled now so foreign keys can be wired up
later without a redesign.

---

## Domain in a nutshell

- A **Customer** rents one or more **Parcels**.
- A **Field** is subdivided into **Parcels**; a parcel is either _productive_
  (grows crops) or a _biodiversity_ area (tracked, not rented).
- Each parcel has a **ServiceTier** (basic rental → smart garden → garden-as-a-
  service → full service with delivery → regenerative).
- A **Device** (ESP32) sits on a parcel and emits time-series:
  **SensorReadings** (periodic environmental snapshots), **IrrigationEvents**
  (discrete watering actions), and **CameraImages**.
- Agronomy is logged per parcel: **ParcelPlanting** (crop per season),
  **ParcelEvent** (planting/care/harvest/pest), **SoilAnalysis** (lab results).

---

## OML vocabulary

```oml
vocabulary <http://ackerblick.com/vocabulary/ackerblick#> as ackerblick {

  // ---- Tenancy ----------------------------------------------------------

  concept Customer
  concept Field
  concept Parcel
  concept BiodiversityArea < Parcel   // tracked separately from productive plots

  relation entity Rents [
    from Customer
    to Parcel
    forward rents
    reverse rentedBy
  ]

  relation entity Subdivides [
    from Field
    to Parcel
    forward contains
    reverse partOf
  ]

  // ---- Hardware & telemetry --------------------------------------------

  concept Device
  concept SensorReading
  concept IrrigationEvent
  concept CameraImage

  relation entity InstalledOn [
    from Device
    to Parcel
    forward installedOn
    reverse hosts
  ]

  relation entity Emits [
    from Device
    to SensorReading
    forward emits
    reverse emittedBy
  ]

  relation entity Performs [
    from Device
    to IrrigationEvent
    forward performs
    reverse performedBy
  ]

  relation entity Captures [
    from Device
    to CameraImage
    forward captures
    reverse capturedBy
  ]

  // ---- Agronomy & sustainability ---------------------------------------

  concept CropVariety
  concept ParcelPlanting
  concept ParcelEvent
  concept SoilAnalysis

  relation entity Grows [
    from Parcel
    to ParcelPlanting
    forward grows
    reverse grownOn
  ]

  relation entity OfVariety [
    from ParcelPlanting
    to CropVariety
    forward ofVariety
    reverse plantedAs
  ]

  relation entity LoggedOn [
    from ParcelEvent
    to Parcel
    forward loggedOn
    reverse hasEvent
  ]

  relation entity SampledFrom [
    from SoilAnalysis
    to Parcel
    forward sampledFrom
    reverse hasAnalysis
  ]

  // ---- Enumerations -----------------------------------------------------

  scalar ServiceTier [
    oneOf "BASIC_RENTAL", "SMART_GARDEN", "GARDEN_AS_A_SERVICE",
          "FULL_SERVICE_DELIVERY", "REGENERATIVE"
  ]
  scalar DeviceStatus [
    oneOf "ACTIVE", "INACTIVE", "MAINTENANCE", "DECOMMISSIONED"
  ]
  scalar ParcelEventType [
    oneOf "PLANTING", "CARE", "HARVEST", "PEST_MANAGEMENT"
  ]

  // ---- Key attributes ---------------------------------------------------

  concept Device [
    key id                          // hardware id, e.g. "hochbeet-001"
    restricts some status to DeviceStatus
  ]
  concept SensorReading [
    // all measurements optional → payload can grow without migration
    restricts some soilMoisturePercent to xsd:float
    restricts some airTemperatureCelsius to xsd:float
    restricts some relativeHumidityPercent to xsd:float
    restricts some airPressureHpa to xsd:float
    restricts some batteryVoltage to xsd:float
    restricts some recordedAt to xsd:dateTimeStamp   // measurement time
  ]
  concept IrrigationEvent [
    restricts some durationSeconds to xsd:integer
    restricts some moistureBeforePercent to xsd:float
    restricts some moistureAfterPercent to xsd:float
    restricts some occurredAt to xsd:dateTimeStamp
  ]
  concept Parcel [
    restricts some serviceTier to ServiceTier
  ]
}
```

---

## Key decisions

- **Device id is the hardware identifier** (`"hochbeet-001"`), not a generated
  key. So time-series rows already carry a valid future foreign key — no data
  migration when the `Device` table is populated.
- **Readings attach to the device, not the parcel.** A device is the thing that
  fails, gets swapped, or moves; parcel context is derived through the device's
  current assignment.
- **Irrigation is its own concept**, not a reading — it has a duration and a
  before/after delta, a different shape from a periodic snapshot.
- **All measurements are optional.** Monday's BME280 fields and the later
  battery field just start being populated; old rows stay `NULL`. Additive,
  never a backfill.
- **Two timestamps:** `recordedAt` (measurement time) is separate from
  `createdAt` (ingest time) to survive clock skew and backfilled batches. All
  timestamps are `timestamptz`.

---

## Prisma schema (prototype)

```prisma
// schema.prisma — Ackerblick
// PostgreSQL via Prisma. Timestamps are stored WITH timezone (@db.Timestamptz).
//
// NOTE ON TIME-SERIES: SensorReading and IrrigationEvent are the high-volume,
// append-only time-series tables. In production, convert them to TimescaleDB
// hypertables (SELECT create_hypertable('SensorReading', 'recordedAt')) via a
// raw migration. This does NOT change the Prisma schema.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------------------------------------------------------------------------
// TIME-SERIES  (the only tables exercised by the prototype)
// ---------------------------------------------------------------------------

// Periodic environmental snapshot, emitted ~every 15 min by a device.
// Today: { deviceId, soilMoisture }. Monday: + BME280 fields. Later: + battery.
// All measurement columns are NULLABLE so new payload fields are additive.
model SensorReading {
  id String @id @default(cuid())

  // Plain string today. NOT a hard FK in the prototype (Device table is empty),
  // but already wired as an OPTIONAL relation so we can enforce it later.
  // Device.id IS the hardware identifier ("hochbeet-001"), so adding Device
  // rows + the FK constraint later requires zero rewrite of this column.
  deviceId String
  device   Device? @relation(fields: [deviceId], references: [id], onDelete: SetNull)

  soilMoisturePercent     Float? // 0–100, capacitive sensor
  airTemperatureCelsius   Float? // BME280 — arriving Monday
  relativeHumidityPercent Float? // BME280 — arriving Monday
  airPressureHpa          Float? // BME280 — arriving Monday
  batteryVoltage          Float? // arriving later

  // Measurement time, distinct from ingest time (clock skew / backfills).
  recordedAt DateTime @db.Timestamptz
  createdAt  DateTime @default(now()) @db.Timestamptz

  @@index([deviceId, recordedAt])
  @@index([recordedAt])
}

// Discrete watering event — different shape from a periodic reading.
model IrrigationEvent {
  id String @id @default(cuid())

  deviceId String
  device   Device? @relation(fields: [deviceId], references: [id], onDelete: SetNull)

  durationSeconds       Int
  moistureBeforePercent Float?
  moistureAfterPercent  Float?
  waterVolumeLiters     Float? // future: metered water use (sustainability)

  occurredAt DateTime @db.Timestamptz
  createdAt  DateTime @default(now()) @db.Timestamptz

  @@index([deviceId, occurredAt])
}

// Camera images / time-lapses. Object-storage URL, never blobs in Postgres.
model CameraImage {
  id String @id @default(cuid())

  deviceId String
  device   Device? @relation(fields: [deviceId], references: [id], onDelete: SetNull)

  storageUrl String
  capturedAt DateTime @db.Timestamptz
  createdAt  DateTime @default(now()) @db.Timestamptz

  @@index([deviceId, capturedAt])
}

// ---------------------------------------------------------------------------
// HARDWARE
// ---------------------------------------------------------------------------

// Empty in the prototype. id = the hardware identifier sent in the payload.
model Device {
  id String @id // e.g. "hochbeet-001" — supplied by firmware, not generated

  label       String?
  hardware    String? // free-form: "ESP32 + BME280 + capacitive moisture"
  status      DeviceStatus @default(ACTIVE)
  installedAt DateTime?    @db.Timestamptz
  lastSeenAt  DateTime?    @db.Timestamptz

  parcelId String?
  parcel   Parcel? @relation(fields: [parcelId], references: [id], onDelete: SetNull)

  readings         SensorReading[]
  irrigationEvents IrrigationEvent[]
  cameraImages     CameraImage[]

  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  @@index([parcelId])
}

enum DeviceStatus {
  ACTIVE
  INACTIVE
  MAINTENANCE
  DECOMMISSIONED
}

// ---------------------------------------------------------------------------
// TENANCY  (Customer → Field → Parcel)  — empty in the prototype
// ---------------------------------------------------------------------------

model Customer {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  parcels   Parcel[]
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz
}

model Field {
  id        String   @id @default(cuid())
  name      String
  latitude  Float?
  longitude Float?
  parcels   Parcel[]
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz
}

enum ParcelKind {
  PRODUCTIVE   // a rentable, crop-growing plot
  BIODIVERSITY // tracked separately from productive plots
}

model Parcel {
  id   String @id @default(cuid())
  code String // human label within the field, e.g. "A-12"

  kind        ParcelKind  @default(PRODUCTIVE)
  serviceTier ServiceTier @default(BASIC_RENTAL)

  fieldId String
  field   Field  @relation(fields: [fieldId], references: [id])

  customerId String?
  customer   Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)

  devices   Device[]
  plantings ParcelPlanting[]
  events    ParcelEvent[]
  analyses  SoilAnalysis[]

  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  @@unique([fieldId, code])
  @@index([customerId])
}

enum ServiceTier {
  BASIC_RENTAL          // pre-seeded plot, camera access
  SMART_GARDEN          // automated irrigation, sensors, app
  GARDEN_AS_A_SERVICE   // Ackerblick handles planting/care/harvest
  FULL_SERVICE_DELIVERY // veggie box assembled and delivered
  REGENERATIVE          // greenhouse, rainwater, solar
}

// ---------------------------------------------------------------------------
// OPERATIONS & AGRONOMY  — stubs so FKs are wired, expanded later
// ---------------------------------------------------------------------------

model CropVariety {
  id        String           @id @default(cuid())
  name      String           @unique // "Cherry tomato 'Sungold'"
  species   String? // "Solanum lycopersicum"
  plantings ParcelPlanting[]
  createdAt DateTime @default(now()) @db.Timestamptz
}

// Crop selection per parcel per season.
model ParcelPlanting {
  id String @id @default(cuid())

  parcelId String
  parcel   Parcel @relation(fields: [parcelId], references: [id])

  cropVarietyId String
  cropVariety   CropVariety @relation(fields: [cropVarietyId], references: [id])

  season    String // "2026" or "2026-spring"
  plantedAt DateTime? @db.Timestamptz

  createdAt DateTime @default(now()) @db.Timestamptz

  @@index([parcelId, season])
}

enum ParcelEventType {
  PLANTING
  CARE
  HARVEST
  PEST_MANAGEMENT
}

// Manual operations log — staff-entered, low volume.
model ParcelEvent {
  id String @id @default(cuid())

  parcelId String
  parcel   Parcel @relation(fields: [parcelId], references: [id])

  type       ParcelEventType
  notes      String?
  occurredAt DateTime @db.Timestamptz
  createdAt  DateTime @default(now()) @db.Timestamptz

  @@index([parcelId, occurredAt])
}

// Periodic lab soil analysis — soil quality over time.
model SoilAnalysis {
  id String @id @default(cuid())

  parcelId String
  parcel   Parcel @relation(fields: [parcelId], references: [id])

  humusPercent      Float?
  ph                Float?
  nitrogenMgPerKg   Float?
  phosphorusMgPerKg Float?
  potassiumMgPerKg  Float?

  sampledAt DateTime @db.Timestamptz
  createdAt DateTime @default(now()) @db.Timestamptz

  @@index([parcelId, sampledAt])
}
```
