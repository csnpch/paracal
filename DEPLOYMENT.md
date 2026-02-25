# Deployment Guide

This guide explains how to deploy and update the Paracal application.

## 🚀 Deployment Options

1. [Local Deployment (Docker Compose)](#-local-deployment-docker-compose)
2. [GCP VM Deployment (GCP Free Tier)](#-gcp-vm-deployment-gcp-free-tier)
3. [Railway Deployment (GitHub Repo)](#-railway-deployment-github-repo)
4. [Update Process (Local Build & Push)](#-update-process-local-build--push)
5. [Monitoring & Logs](#-monitoring--logs)

---

## 🏠 Local Deployment (Docker Compose)

Standard setup for development or local testing.

### Quick Start
```bash
docker-compose up -d

# Access points:
# Frontend: http://localhost:8080
# Backend API: http://localhost:3000
# API Docs: http://localhost:3000/swagger
```

---

## ☁️ GCP VM Deployment (GCP Free Tier)

Optimized for **e2-micro** instances (1GB RAM) where building images directly on the VM is too slow.

### Initial VM Setup
1. Create a VM in `us-central1`, `us-west1`, or `us-east1` (Free Tier regions).
2. Select **e2-micro** machine type.
3. Enable **HTTP/HTTPS traffic** in Firewall settings.
4. Recommended: Create a **2GB Swap File** to prevent OOM crashes.

### GCP Firewall Rules
The default "HTTP traffic" rule only opens port **80** and **443**. You must create a custom rule for the backend API port.

1. Go to [GCP Console → Firewall Rules](https://console.cloud.google.com/networking/firewalls/add)
2. Create a new rule with:

| Field | Value |
| :--- | :--- |
| Name | `allow-paracal-api` |
| Direction | Ingress |
| Action on match | Allow |
| Targets | All instances in the network |
| Source IPv4 ranges | `0.0.0.0/0` |
| Protocols and ports | TCP: `3000` |

### Remote Configuration
On the GCP VM, use `docker-compose.gcp.yml` which uses pre-built images from Docker Hub:
```bash
docker compose -f docker-compose.gcp.yml up -d
```

### Access Points (GCP)
- **Frontend:** `http://<EXTERNAL_IP>` (port 80, no port number needed)
- **Backend API:** `http://<EXTERNAL_IP>:3000`
- **API Docs:** `http://<EXTERNAL_IP>:3000/swagger`

---

## 🚂 Railway Deployment (GitHub Repo)

Deploy directly from your GitHub repository. Railway automatically rebuilds on every `git push`.

### Architecture on Railway
Create **2 separate services** in the same Railway project, both connected to the same GitHub repo:

| Service | Dockerfile | Root Directory | Port |
| :--- | :--- | :--- | :--- |
| Backend | `backend/Dockerfile` (context: `.`) | `/` (root) | 3001 |
| Frontend | `frontend/Dockerfile` (context: `.`) | `/` (root) | 80 |

### Step-by-step Setup

#### 1. Create Backend Service
1. In Railway, click **"New Service"** → **"GitHub Repo"** → select this repo
2. Go to **Settings**:
   - **Builder**: `Dockerfile`
   - **Dockerfile Path**: `backend/Dockerfile`
   - Set **Port** to `3001`
3. Go to **Variables** and add:
   ```
   NODE_ENV=production
   DATABASE_URL=<your_postgres_connection_string>
   ADMIN_PASSWORD=<your_admin_password>
   CALENDARIFIC_API_KEY=<your_api_key>
   APP_URL=<your_frontend_public_url>
   ```
4. Deploy and note the **public domain** (e.g. `paracal-backend-production.up.railway.app`)

#### 2. Create Frontend Service
1. In Railway, click **"New Service"** → **"GitHub Repo"** → select the same repo
2. Go to **Settings**:
   - **Builder**: `Dockerfile`
   - **Dockerfile Path**: `frontend/Dockerfile`
   - Set **Port** to `80`
3. Go to **Variables** and add:
   ```
   VITE_API_BASE_URL=https://<backend-public-domain>
   ```
   > ⚠️ `VITE_API_BASE_URL` must be the **full public URL** of the backend service (from step 1.4)
   > Since Vite bakes this value at **build time**, Railway needs it as a build-time variable.
4. Deploy and set up a **custom domain** if needed

#### 3. Database (PostgreSQL)
Railway has a **built-in PostgreSQL** addon:
1. Click **"New Service"** → **"Database"** → **"PostgreSQL"**
2. Copy the `DATABASE_URL` from the database service and paste it into the backend's Variables

### Build Speed Optimization
The Dockerfiles use these techniques to minimize build time on Railway:
- **Layer caching**: dependency install is separated from code copy, so `npm ci` / `bun install` is cached when only source code changes
- **`.dockerignore`**: excludes `node_modules`, `dist`, `.git`, tests — reduces upload context
- **Backend skips compilation**: Bun runs TypeScript directly, no `bun build` step needed
- **Multi-stage builds**: final images are minimal (nginx:alpine ~40MB, bun:alpine ~150MB)

---

## 🔄 Update Process (Local Build & Push)

Since building on a Free Tier VM is slow (and Apple Silicon Macs have emulation issues), use this **Native Build → Docker Package → Hub → Remote Pull** workflow.

### 1. One-command release (on Mac)
```bash
# Builds code natively on Mac, packages into Docker images, and pushes to Hub
npm run gcp:release
```

This runs the following steps automatically:
1. `gcp:build-code` — Builds backend (Bun) and frontend (Vite) **natively on Mac**
2. `gcp:build-image` — Packages pre-built files into Docker images for `linux/amd64`
3. `gcp:tag` — Tags images for Docker Hub
4. `gcp:push` — Pushes to Docker Hub

### 2. Deploy on GCP VM (SSH)
```bash
ssh your_name_ssh (eg. paracal)
cd ~/your_project_folder (eg. paracal)

git pull
docker compose -f docker-compose.gcp.yml pull
docker compose -f docker-compose.gcp.yml up -d
```

---

## 📺 Monitoring & Logs

### View container status
```bash
docker compose -f docker-compose.gcp.yml ps
```

### View logs (all services)
```bash
# Show recent logs
docker compose -f docker-compose.gcp.yml logs --tail=50

# Stream logs in real-time (Ctrl+C to exit)
docker compose -f docker-compose.gcp.yml logs -f
```

### View logs (single service)
```bash
# Backend only
docker compose -f docker-compose.gcp.yml logs -f backend

# Frontend only
docker compose -f docker-compose.gcp.yml logs -f frontend
```

### Check if services are responding
```bash
# Backend health check
curl http://localhost:3000/employees

# Frontend health check
curl -s http://localhost:80 | head -5
```

### Restart services
```bash
# Restart all
docker compose -f docker-compose.gcp.yml restart

# Restart single service
docker compose -f docker-compose.gcp.yml restart backend
```

### Stop everything
```bash
docker compose -f docker-compose.gcp.yml down
```

---

## ⚙️ Environment Variables

| Variable | Description | Location |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Backend API URL (baked at build time) | `frontend/.env` |
| `DATABASE_URL` | SQLite path (e.g., `file:/app/data/calendar.db`) | `docker-compose.gcp.yml` |
| `ADMIN_PASSWORD` | Admin password for bulk operations | `docker-compose.yml` |
| `CALENDARIFIC_API_KEY` | API key for Thai holiday fetching | `docker-compose.yml` |
| `APP_URL` | Application URL for notification links | `docker-compose.yml` |

---

## 🛠️ Troubleshooting

### Common Issues
1. **"Failed to fetch" on Frontend:**
   - Verify `VITE_API_BASE_URL` in `frontend/.env` points to the correct External IP and port (3000).
   - Re-build and push the frontend image after changing this value: `npm run gcp:release`.

2. **ERR_CONNECTION_TIMED_OUT from browser:**
   - GCP Firewall is blocking the port. Check that custom firewall rules exist for port `3000`.
   - The default "HTTP traffic" checkbox only opens port 80/443.

3. **GCP VM Memory Errors / Crashes:**
   - Ensure Swap file is active: `sudo swapon --show`.
   - Never build Docker images directly on the VM. Always use `npm run gcp:release` from Mac.

4. **Docker image platform mismatch (`no matching manifest for linux/amd64`):**
   - The `gcp:build-image` script already includes `--platform linux/amd64`.
   - Ensure Docker Desktop has **"Use Rosetta for x86_64/amd64 emulation"** enabled (Settings → General).

5. **Database Reset:**
   - Data persists in Docker volume `paracal-data`.
   - To reset: `docker volume rm paracal_paracal-data` then restart.

### Port Mapping
| Service | External Port | Internal Port |
| :--- | :--- | :--- |
| Frontend (GCP) | 80 | 80 (nginx) |
| Frontend (Local) | 8080 | 80 (nginx) |
| Backend | 3000 | 3001 (Elysia) |