# ============================================================
# Backend Dockerfile — Multi-stage for fast builds on Railway
# ============================================================

# --- Stage 1: Install dependencies (cached unless package files change) ---
FROM oven/bun:1-alpine AS deps

WORKDIR /app/backend

# Copy only dependency-related files first for optimal caching
COPY backend/package.json backend/bun.lock* ./
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./

# Install all dependencies (including devDependencies for prisma generate)
RUN bun install --frozen-lockfile

# Generate Prisma client
RUN bunx prisma generate


# --- Stage 2: Production image (slim) ---
FROM oven/bun:1-alpine AS production

WORKDIR /app/backend

# Copy installed node_modules + generated Prisma client from deps stage
COPY --from=deps /app/backend/node_modules ./node_modules
COPY --from=deps /app/backend/src/generated ./src/generated

# Copy backend source code
COPY backend/src ./src
COPY backend/index.ts ./
COPY backend/package.json ./
COPY backend/tsconfig.json ./
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./

# Copy shared modules at the correct relative path
COPY shared /app/shared

# Create runtime directories
RUN mkdir -p logs data && chmod 755 logs data

EXPOSE 3001
CMD ["bun", "index.ts"]