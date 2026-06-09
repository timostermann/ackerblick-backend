# ---- Stage 1: Builder ----
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

WORKDIR /app

# 1. Install dependencies (CI=true suppresses husky prepare)
COPY package.json pnpm-lock.yaml ./
RUN CI=true pnpm install --frozen-lockfile

# 2. Generate Prisma client *before* building TypeScript
#    (prisma.service.ts imports from src/generated/prisma which is compiled transitively)
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" pnpm db:generate

# 3. Compile TypeScript (includes src/generated/prisma transitively → dist/generated/prisma)
COPY src ./src
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
RUN pnpm build
# Prisma 7 CJS: TypeScript preserves .ts extensions in require() paths (it only
# rewrites extensions for ESM import statements, not CJS require calls).
# Replace require('./x.ts') → require('./x.js') in the compiled generated client.
RUN find /app/dist/generated -name "*.js" \
    | xargs -r sed -i \
        -e "s/require('\(\..*\)\.ts')/require('\1.js')/g" \
        -e 's/require("\(\..*\)\.ts")/require("\1.js")/g'

# ---- Stage 2: Production ----
FROM node:22-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs \
    && adduser -S nestjs -u 1001 -G nodejs

# Copy only what the runtime needs
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main.js"]
