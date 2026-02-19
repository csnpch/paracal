# Backend Dockerfile (uses pre-built dist from local machine)
FROM oven/bun:1-alpine
WORKDIR /app

# Copy pre-built files from local machine
COPY backend/dist ./dist
COPY backend/src ./src
COPY backend/package*.json ./
COPY backend/index.ts ./

# Copy shared modules (used by backend services)
COPY shared ./shared

# Install production dependencies only (skip devDependencies like better-sqlite3)
RUN bun install --ignore-scripts --no-save

# Create logs and data directories
RUN mkdir -p logs data && chmod 755 logs data

EXPOSE 3001
CMD ["bun", "start"]