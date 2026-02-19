# Deployment Guide

This guide explains how to deploy and update the Calendar QA application.

## 🚀 Deployment Options

1. [Local Deployment (Docker Compose)](#-local-deployment-docker-compose)
2. [GCP VM Deployment (GCP Free Tier)](#-gcp-vm-deployment-gcp-free-tier)
3. [Update Process (Local Build & Push)](#-update-process-local-build--push)

---

## 🏠 Local Deployment (Docker Compose)

Standard setup for development or local testing.

### Quick Start
```bash
# Start the application
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
4. Recommended: Create a **2GB Swap File** to prevent crashes.

### Remote Configuration (`docker-compose.gcp.yml`)
On the GCP VM, use the dedicated GCP configuration file which points to pre-built images. To run it, use:
`docker compose -f docker-compose.gcp.yml up -d`

---

## 🔄 Update Process (Local Build & Push)

Since building on a Free Tier VM is slow, use this **Local Build -> Hub -> Remote Pull** workflow.

### 1. Locally on your Mac
Build and push images to Docker Hub.

```bash
# Ensure Docker Desktop is running
# Login to Docker Hub
docker login

# Set the correct API URL for the environment (GCP External IP)
echo "VITE_API_BASE_URL=http://34.56.225.220:3000" > frontend/.env

# Build images locally (Fast)
docker build -t calendar-backend ./backend
docker build -t calendar-frontend ./frontend

# Tag for Docker Hub
docker tag calendar-backend chtisanuphongcha/calendar-backend:latest
docker tag calendar-frontend chtisanuphongcha/calendar-frontend:latest

# Push to Hub
docker push chtisanuphongcha/calendar-backend:latest
docker push chtisanuphongcha/calendar-frontend:latest
```

### 2. Remotely on GCP VM
Pull the new images and restart using the GCP config file.

```bash
# Connect to your VM
ssh your_name_ssh (eg. paracal)

# Navigate to project folder
cd ~/your_project_folder (eg. paracal)

# Update images and restart using the GCP-specific file
docker compose -f docker-compose.gcp.yml pull
docker compose -f docker-compose.gcp.yml up -d
```

---

## ⚙️ Environment Variables

| Variable | Description | Location |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | The URL of the Backend API | `frontend/.env` |
| `DATABASE_URL` | SQLite path (e.g., `file:/app/data/calendar.db`) | `docker-compose.yml` |

---

## 🛠️ Troubleshooting

### Common Issues
1. **"Failed to fetch" on Frontend:**
   - Verify `VITE_API_BASE_URL` points to the correct External IP and port (3000).
   - Re-build the frontend image locally after changing this value.

2. **GCP VM Memory Errors:**
   - Ensure Swap file is active: `sudo swapon --show`.
   - Use the Local Build workflow instead of building on the VM.

3. **Database Reset:**
   - Ensure the volume `calendar-data` is correctly mapped in `docker-compose.yml` to persist `calendar.db`.

### Port Information
- **Frontend External**: 8080
- **Backend External**: 3000 (Internal: 3001)