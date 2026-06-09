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

## Deployment

Production stack: **Hetzner cx22** (Ubuntu 24.04) · **Docker Compose** · **Caddy** (TLS) · **Cloudflare DNS** · managed via **Terraform** · automated via **GitHub Actions**.

### 1. Provision infrastructure (Terraform)

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # fill in tokens + SSH key
terraform init
terraform plan
terraform apply
```

Terraform creates:

- A Hetzner cx22 server (2 vCPU / 4 GB, Nuremberg)
- A firewall allowing only 22/80/443 inbound
- A Cloudflare DNS A record: `api.ackerblick.com → <server-ip>` (proxied: false — Caddy handles TLS)

> **Terraform state** is local (`terraform.tfstate`) for now. Migrate to remote state (Terraform Cloud or S3) before team use.

### 2. Bootstrap the server (one-time)

```bash
ssh root@<server-ip> 'bash -s' < infra/bootstrap.sh
```

This installs Docker, clones the repo to `/opt/ackerblick-backend`, and creates `.env` from the template. After it completes, fill in secrets:

```bash
# On the server:
nano /opt/ackerblick-backend/.env
```

Key values to set:

| Variable                                | Example                                                           |
| --------------------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`                          | `postgresql://ackerblick:<pass>@db:5432/ackerblick?schema=public` |
| `DB_PASSWORD`                           | must match the password in `DATABASE_URL`                         |
| `API_KEY`                               | firmware ingest key                                               |
| `DASHBOARD_USER` / `DASHBOARD_PASSWORD` | dashboard basic auth                                              |

Then start all services:

```bash
docker compose -f /opt/ackerblick-backend/docker-compose.prod.yml up -d
```

On first start, the `app` container runs `prisma migrate deploy` which applies all migrations (including TimescaleDB hypertable creation) before the NestJS server starts.

### 3. GitHub Actions

**CI** (`.github/workflows/ci.yml`) — runs on every push/PR:

- `lint`, `typecheck`, `format:check`, `audit`, `prisma-validate` in parallel
- `test` with a live `timescale/timescaledb-ha:pg16` service container

**CD** (`.github/workflows/deploy.yml`) — runs on push to `main`, only after CI passes:

- Calls CI as a reusable workflow (gate)
- SSH deploys via `appleboy/ssh-action`: `git pull → docker compose build app → docker compose up -d`

Add these secrets to your GitHub repository (**Settings → Secrets → Actions**):

| Secret           | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| `DEPLOY_HOST`    | server IP or hostname                                     |
| `DEPLOY_USER`    | SSH user (e.g. `root`)                                    |
| `DEPLOY_SSH_KEY` | private key matching the public key in `terraform.tfvars` |

### 4. Rolling updates

Every push to `main` triggers an automatic deploy. The app container runs `prisma migrate deploy` before starting, so schema migrations are applied on each deploy.

For a manual redeploy on the server:

```bash
cd /opt/ackerblick-backend
git pull origin main
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d
```

## Out of scope (prototype)

Auth beyond the static key, multiple device types/parcels, BME280 ingest (schema-ready only),
a separate frontend project, LoRa, camera, irrigation control, and deployment infra
(Hetzner/Terraform/Cloudflare).
