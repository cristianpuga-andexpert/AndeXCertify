# ── Stage 1: Build ────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Build-time args for Vite (baked into the frontend bundle)
ARG VITE_DEV_MODE=false
ARG VITE_DEV_USER_ID=

ENV VITE_DEV_MODE=$VITE_DEV_MODE
ENV VITE_DEV_USER_ID=$VITE_DEV_USER_ID

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────
FROM node:22-bookworm-slim AS runner

# LibreOffice for DOCX → PDF conversion
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libreoffice \
      libreoffice-writer \
      fonts-liberation \
      fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Production node_modules + compiled artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Drizzle config, schema and versioned migration files for `drizzle-kit migrate`
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/db/schema.ts ./src/db/schema.ts
COPY --from=builder /app/drizzle ./drizzle

COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
