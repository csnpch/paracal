# Paracal (Calendar Reminder) System

A full-stack calendar application for managing employees, events, holidays, and automated notifications.

## 🚀 Quick Start with Docker

```bash
# Clone the repository
git clone <repository-url>
cd paracal

# Build frontend (required for Docker)
cd frontend && npm run build && cd ..

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:80
# Backend API: http://localhost:3000
# API Documentation: http://localhost:3000/swagger
```

## 📋 Services

### Frontend
- **Framework**: React + TypeScript + Vite
- **UI**: shadcn/ui components with Tailwind CSS
- **Port**: 80 (Nginx)

### Backend
- **Runtime**: Bun + Elysia.js
- **Database**: SQLite
- **Port**: 3000 (maps to container port 3001)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │
│   (React/Nginx) │────│  (Bun/Elysia)   │
│   Port: 80      │    │   Port: 3000    │
└─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────────┐
                       │   SQLite DB     │
                       │  (calendar.db)  │
                       └─────────────────┘
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- Bun runtime
- Docker & Docker Compose

### Backend Development
```bash
cd backend
bun install
bun dev
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

## 📁 Project Structure

```
paracal/
├── shared/                  # Shared types & constants
│   ├── types.ts            # TypeScript interfaces
│   └── constants.ts        # Leave type labels, colors
├── backend/                 # Bun + Elysia.js API
│   ├── src/
│   │   ├── config/         # Centralized configuration
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── database/       # DB connection & schema
│   │   └── utils/          # Utilities & logging
│   ├── tests/              # bun:test tests
│   └── Dockerfile          # Backend container
├── frontend/               # React + TypeScript
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API clients
│   │   └── hooks/          # Custom hooks
│   └── Dockerfile          # Frontend container
├── docker-compose.yml      # Container orchestration
└── README.md              # This file
```

## 🔧 Environment Variables

### Backend
- `NODE_ENV=production` (set in docker-compose)

### Frontend
- Built with Vite, environment variables prefixed with `VITE_`

## 📊 Features

- **Employee Management**: CRUD operations for employees
- **Event Scheduling**: Create and manage calendar events
- **Holiday Management**: Track company holidays
- **Automated Notifications**: Scheduled notifications via cron jobs
- **Real-time Updates**: Live calendar updates
- **Responsive UI**: Mobile-friendly interface

## 🐳 Docker Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild containers
docker-compose up --build -d

# Check status
docker-compose ps
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
bun test
```

### Run Tests in Watch Mode
```bash
cd backend
bun run test:watch
```

## 📝 API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:3000/swagger
- **Health Check**: http://localhost:3000/health

## 🔒 Security Notes

- Database files are excluded from git tracking
- Environment variables should be configured for production
- CORS is configured for development (update for production domains)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## 📄 License

[Add your license information here]