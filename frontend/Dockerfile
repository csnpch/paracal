# ============================================================
# Frontend Dockerfile — Multi-stage for fast builds on Railway
# ============================================================

# --- Stage 1: Install dependencies + Build ---
FROM node:20-alpine AS build

WORKDIR /app/frontend

# Copy only package.json (NOT package-lock.json)
# This forces npm to resolve platform-correct optional deps (e.g. @rollup/rollup-linux-arm64-musl)
# Lockfile from macOS lacks linux-musl native bindings — see https://github.com/npm/cli/issues/4828
COPY frontend/package.json ./

RUN npm install

# Copy shared modules at the correct relative path (frontend imports ../../../shared/*)
COPY shared /app/shared

# Copy frontend source code
COPY frontend/ ./

# Build with the API URL passed as build arg
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build


# --- Stage 2: Serve with Nginx (tiny image ~40MB) ---
FROM nginx:alpine AS production

# Copy built static files
COPY --from=build /app/frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]