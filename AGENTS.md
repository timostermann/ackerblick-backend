# Project standards

Coding standards, quality guards, and agent context for the Ackerblick backend.

**Stack:** TypeScript, NestJS, Vitest, PostgreSQL (TimescaleDB), Prisma, Swagger/OpenAPI. Package manager: **pnpm**.

---

## Agent rules (read before coding)

### NestJS

- One feature = one NestJS module (`*.module.ts`, `*.controller.ts`, `*.service.ts`, DTOs).
- Respect module boundaries: do not import a service from another feature module unless it is exported from that module's `exports` array or provided via a shared module.
- Use NestJS dependency injection — do not instantiate services with `new` outside tests.
- Controllers handle HTTP only; business logic belongs in services.
- Use DTOs with `class-validator` decorators for request validation.

### Prisma (v7)

- Schema lives in `prisma/schema.prisma`; CLI/migrate config lives in `prisma.config.ts`.
- **Prisma 7 setup:** the `prisma-client` generator emits the client into `src/generated/prisma` (CommonJS, gitignored — regenerate with `pnpm db:generate`). The schema has **no `url`**; the runtime connection uses the `@prisma/adapter-pg` driver adapter (`new PrismaPg({ connectionString })` in `PrismaService`), and the migrate datasource URL comes from `prisma.config.ts`.
- Import the client/types from `src/generated/prisma/client`, **not** `@prisma/client`.
- After schema changes: run `pnpm db:generate` and create/apply migrations with `pnpm db:migrate`.
- Do not hand-edit generated migration SQL **unless there is a documented reason** — see the TimescaleDB note below, which is one such reason.
- Use `PrismaService` from the shared `DatabaseModule` — do not create multiple Prisma client instances.
- In tests, use fixture factories for entities; do not hardcode IDs that assume database state from other tests.

### TimescaleDB

- `SensorReading`, `IrrigationEvent`, `CameraImage` are append-only time-series tables backed by TimescaleDB **hypertables**.
- Hypertables cannot have a unique index/PK without the partition column, so these tables use **composite primary keys** with the time column first (e.g. `@@id([recordedAt, id])`).
- The `CREATE EXTENSION` + `create_hypertable(...)` statements are appended **by hand** to the initial Prisma migration. This is the documented exception to "don't hand-edit migrations".
- The database image must be a TimescaleDB image (`timescale/timescaledb-ha:pg16` locally). A plain `postgres` image cannot create hypertables.

### Swagger / OpenAPI

- Request and response DTOs must use `@ApiProperty` (and related decorators) so the OpenAPI spec stays accurate.
- Add `@ApiOperation`, `@ApiResponse` to endpoints. Verify at the Swagger UI path `/api`.
- Regenerate or verify Swagger after API changes.

### Commits

All commits follow **Conventional Commits** with a required scope:

```
feat(readings): add ingest endpoint
fix(dashboard): handle empty reading list
chore(deps): update prisma to v6.x
docs(api): document readings payload
test(readings): add service unit tests
```

- **Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `ci`, `perf`
- **Scope:** feature or area name (`readings`, `dashboard`, `prisma`, `api`, `common`, etc.)
- Header max length: 200 characters

### Testing

- `vi.mock()` calls are hoisted by Vitest — order relative to imports does not matter.
- One assertion / behavior per test — each `it()` verifies exactly one thing.
- Use shared test utilities (`createFixture`, `withEnvVars`) instead of duplicating setup.
- After writing tests, run `pnpm lint` and `pnpm typecheck` on changed files.

---

## Repository layout

```
src/
├── main.ts
├── app.module.ts
├── common/           # shared guards, filters, pipes, decorators
├── database/         # PrismaModule, PrismaService
├── readings/         # POST /readings ingest
└── dashboard/        # GET /dashboard (server-rendered HTML)
prisma/
├── schema.prisma
├── seed.ts
└── migrations/
test-utils/           # createFixture, withEnvVars, createTestingApp
```

---

## Scripts

| Script       | Command             | Purpose                     |
| ------------ | ------------------- | --------------------------- |
| Dev          | `pnpm dev`          | Start NestJS in watch mode  |
| Build        | `pnpm build`        | Compile TypeScript          |
| Lint         | `pnpm lint`         | ESLint (`--max-warnings 0`) |
| Typecheck    | `pnpm typecheck`    | `tsc --noEmit`              |
| Test         | `pnpm test`         | Vitest (all tests)          |
| Test watch   | `pnpm test:watch`   | Vitest watch mode           |
| Format       | `pnpm format`       | Prettier write              |
| Format check | `pnpm format:check` | Prettier check (CI)         |
| DB generate  | `pnpm db:generate`  | Regenerate Prisma client    |
| DB migrate   | `pnpm db:migrate`   | Apply migrations (dev)      |
| DB seed      | `pnpm db:seed`      | Seed database               |

Copy `.env.example` to `.env` and fill in required values before running the app or DB commands.

---

## TypeScript

Compiler options (minimum standard): `strict: true`, `noUncheckedIndexedAccess: true`, `isolatedModules: true`, `module`/`moduleResolution`: `NodeNext`, `target`: `ES2022`.

- Do not use `any`. Prefer `type` over `interface` for object shapes unless extending is required.
- Use type-only imports: `import type { User } from "@prisma/client";`.

---

## ESLint

Flat config with `typescript-eslint` **strictTypeChecked** + **stylisticTypeChecked**. Enforced: no `any`, no floating/misused promises, `consistent-type-imports`/`consistent-type-exports`, `prefer-const`, `no-var`, `eqeqeq`, `curly`, import ordering, `@vitest/eslint-plugin` in test files. Lint must pass with **zero warnings**.

## Prettier

`semi: true`, `singleQuote: false`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 100`, `endOfLine: "lf"`.

---

## Local git hooks

- **pre-commit** (`lint-staged`): ESLint `--fix`, Prettier `--write`, and `vitest related --run --passWithNoTests` on staged files.
- **commit-msg**: `commitlint` validates conventional commit format.

---

## CI pipeline (Tier 2 — documented, not yet scaffolded)

Recommended PR checks: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test` (+ coverage), `pnpm audit`, secret scan, `knip`, `prisma validate`. Renovate/Dependabot for dependency updates.

---

## Testing guidelines

### File naming

- `*.spec.ts` — unit tests (services, guards, pure functions). Place next to source.
- `*.test.ts` — integration tests (HTTP via Supertest, database).

### Unit tests (services / guards)

Use `@nestjs/testing` to build an isolated module; mock at boundaries (`PrismaService`, external HTTP). Reset mocks in `beforeEach(() => vi.clearAllMocks())`.

### Environment variables

Use `withEnvVars()` for env shared across a `describe` block (restored in `afterAll`). Pass `null` to remove a key. Use `vi.stubEnv()` for per-test overrides.

### Fixture factories

Use `createFixture<T>()` for DRY test data with partial overrides.

### Coverage

Provider: istanbul. Include `src/**/*.ts`. Exclude tests, `*.d.ts`, `main.ts`, `*.module.ts`, config files, `prisma/migrations/**`, generated client.

### Do / Don't

- **Do:** mock at module boundaries, descriptive behavior-named tests, test success and failure paths.
- **Don't:** duplicate setup boilerplate, hardcode test data when a fixture works, use `as any` (use `as unknown as Type` as last resort), write trivial negative tests, skip error paths.

---

## Test utilities (`test-utils/`)

| Utility              | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `createFixture<T>()` | Factory for test data with partial overrides        |
| `withEnvVars()`      | Set `process.env` for a `describe` block            |
| `createTestingApp()` | Wraps `Test.createTestingModule` + common providers |
