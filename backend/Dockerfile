# Backend Dockerfile (uses pre-built dist from local machine)
FROM oven/bun:1-alpine
WORKDIR /app

# Copy pre-built files from local machine
COPY dist ./dist
COPY src ./src
COPY package*.json bun.lock* ./
COPY index.ts ./
COPY prisma ./prisma

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Install production dependencies only
RUN bun install --no-save

# Create logs and data directories
RUN mkdir -p logs data && chmod 755 logs data

EXPOSE 3001
CMD ["bun", "start"]