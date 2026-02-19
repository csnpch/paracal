# Backend Dockerfile (uses pre-built dist from local machine)
FROM oven/bun:1-alpine

# Replicate original project structure so relative imports work
# Original: project-root/backend/src/services -> ../../../shared = project-root/shared
WORKDIR /app/backend

# Copy backend files
COPY backend/dist ./dist
COPY backend/src ./src
COPY backend/package*.json ./
COPY backend/index.ts ./

# Copy shared modules at the correct relative path
COPY shared /app/shared

# Install production dependencies only
RUN bun install --ignore-scripts --no-save

# Create logs and data directories
RUN mkdir -p logs data && chmod 755 logs data

EXPOSE 3001
CMD ["bun", "start"]