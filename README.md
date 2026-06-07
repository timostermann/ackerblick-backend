# Ackerblick Backend

Backend for **Ackerblick** — a rent-a-garden service where customers get their own plot with
sensors and optional automated irrigation. An ESP32 device POSTs sensor readings every ~15 min;
this service ingests, stores (time-series in TimescaleDB), and exposes a temporary dashboard.

**Stack:** NestJS · TypeScript · Prisma · PostgreSQL (TimescaleDB) · Swagger/OpenAPI · Vitest. Package manager: **pnpm**.

## Quick start

```bash
cp .env.example .env          # fill in secrets
pnpm install
docker compose up -d          # TimescaleDB on :5432
pnpm db:migrate               # apply schema + create hypertables
pnpm db:generate              # generate Prisma client
pnpm dev                      # http://localhost:3000
```

- API docs (Swagger UI): `http://localhost:3000/api`
- Dashboard (HTTP Basic auth): `http://localhost:3000/dashboard`

## Endpoints

| Method | Path         | Auth               | Purpose                                                   |
| ------ | ------------ | ------------------ | --------------------------------------------------------- |
| `POST` | `/readings`  | `X-API-Key` header | Firmware ingest of a single sensor reading                |
| `GET`  | `/dashboard` | HTTP Basic         | Server-rendered HTML table + Chart.js soil-moisture chart |
| `GET`  | `/api`       | none               | Swagger UI                                                |

### `POST /readings` contract

```
POST /readings
X-API-Key: <API_KEY>
Content-Type: application/json

{ "deviceId": "hochbeet-001", "soilMoisture": 42 }
```

`soilMoisture` is an integer `0–100`. The server stamps `recordedAt` on receipt (the firmware has
no clock). The device is auto-upserted into the `Device` table on first contact. Response is a
minimal structured envelope (reserved for future irrigation commands):

```json
{ "status": "ok", "commands": [] }
```

See [`docs/firmware-contract.md`](docs/firmware-contract.md) for the full device contract.

## Repository layout

```
src/
├── main.ts               # bootstrap + global pipes + Swagger
├── app.module.ts
├── common/               # ApiKeyGuard, BasicAuthGuard
├── database/             # PrismaModule, PrismaService
├── readings/             # POST /readings ingest
└── dashboard/            # GET /dashboard (server-rendered HTML)
prisma/
├── schema.prisma         # full domain model; time-series tables are hypertables
├── seed.ts
└── migrations/           # initial migration hand-augmented with hypertable SQL
test-utils/               # createFixture, withEnvVars, createTestingApp
```

## Data model & TimescaleDB

`SensorReading`, `IrrigationEvent`, and `CameraImage` are append-only time-series tables converted
to **TimescaleDB hypertables**. Because hypertables cannot have a unique index/PK without the
partition column, these tables use composite primary keys with the time column first
(e.g. `@@id([recordedAt, id])`). The `CREATE EXTENSION` + `create_hypertable(...)` statements are
appended by hand to the initial Prisma migration. **The database image must be a TimescaleDB image**
(`timescale/timescaledb-ha:pg16` locally; the same in production). See [`docs/data-model.md`](docs/data-model.md).

All measurement columns are nullable, so new payload fields (BME280 `temperature`/`humidity`/
`pressure`, later `batteryVoltage`) are purely additive — no backfill.

## Scripts

| Script       | Command             | Purpose                     |
| ------------ | ------------------- | --------------------------- |
| Dev          | `pnpm dev`          | Start NestJS in watch mode  |
| Build        | `pnpm build`        | Compile TypeScript          |
| Start        | `pnpm start`        | Run compiled server         |
| Lint         | `pnpm lint`         | ESLint (`--max-warnings 0`) |
| Typecheck    | `pnpm typecheck`    | `tsc --noEmit`              |
| Test         | `pnpm test`         | Vitest (all tests)          |
| Test watch   | `pnpm test:watch`   | Vitest watch mode           |
| Format       | `pnpm format`       | Prettier write              |
| Format check | `pnpm format:check` | Prettier check              |
| DB generate  | `pnpm db:generate`  | Regenerate Prisma client    |
| DB migrate   | `pnpm db:migrate`   | Apply migrations (dev)      |
| DB seed      | `pnpm db:seed`      | Seed database               |

## Environment variables

| Variable                  | Required            | Description                                          |
| ------------------------- | ------------------- | ---------------------------------------------------- |
| `PORT`                    | no (default `3000`) | HTTP port                                            |
| `DATABASE_URL`            | yes                 | TimescaleDB connection string                        |
| `API_KEY`                 | yes                 | Shared static key for `POST /readings` (`X-API-Key`) |
| `DASHBOARD_USER`          | yes                 | HTTP Basic username for `/dashboard`                 |
| `DASHBOARD_PASSWORD`      | yes                 | HTTP Basic password for `/dashboard`                 |
| `DASHBOARD_READING_LIMIT` | no (default `200`)  | Rows rendered on the dashboard                       |

## Coding standards

See [`AGENTS.md`](AGENTS.md) for the full agent + contributor standards (NestJS, Prisma,
TimescaleDB, Swagger, commits, testing).

## Out of scope (prototype)

Auth beyond the static key, multiple device types/parcels, BME280 ingest (schema-ready only),
a separate frontend project, LoRa, camera, irrigation control, and deployment infra
(Hetzner/Terraform/Cloudflare).
