# Paracal Backend

A high-performance REST API built with Bun and Elysia.js for calendar and employee management.

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Configure DATABASE_URL in .env, then run pending migrations and the dev server
bun dev

# Run production server
bun start

# Apply migrations and build
bun run build

# Compile only (no database connection)
bun run build:compile

# Run tests
bun test
```

## 📊 Tech Stack

- **Runtime**: [Bun](https://bun.sh) - Fast JavaScript runtime
- **Framework**: [Elysia.js](https://elysiajs.com) - Fast & lightweight web framework
- **Database**: PostgreSQL with Prisma
- **Testing**: Bun
- **Logging**: Winston
- **Documentation**: Swagger/OpenAPI

## 🌐 API Endpoints

The API provides RESTful endpoints for:
- **Employees** - Staff management and details
- **Events** - Calendar event operations
- **Holidays** - Company holiday management  
- **Cronjobs** - Scheduled notification system
- **Health** - System status and monitoring

For detailed endpoint documentation, start the server and visit:
- **Swagger UI**: http://localhost:3001/swagger

## 🗄️ Database Schema

The PostgreSQL database includes tables for:
- **employees** - Employee records with roles and details
- **events** - Calendar events with scheduling info
- **holidays** - Company holidays
- **cronjobs** - Scheduled notification jobs

## 🔧 Configuration

### Environment Variables
- `NODE_ENV` - Environment (development/production)
- Default port: **3001**

### Database
- Set `DATABASE_URL` in `.env` or the runtime environment.
- `dev`, `build`, and `start` automatically apply committed migrations with `prisma migrate deploy`; migration errors stop the command.
- Docker image builds generate the client without connecting to the database. The container migrates before starting the server.
- Databases from before Prisma migration history need one-time `bun run db:adopt`. It validates the existing schema and registers its history without resetting records. Fresh databases need no adoption. See [database rollout](../docs/daily-meeting-rotation.md#database-rollout).

## 🧪 Testing

```bash
# Run all tests
bun test

# Lifecycle migrations against isolated PostgreSQL fixtures
bun run test:migrations

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage

# Run CI tests
bun run test:ci
```

### Test Structure
```
tests/
├── services/
│   ├── employeeService.test.ts
│   ├── eventService.test.ts
│   ├── holidayService.test.ts
│   └── cronjobService.test.ts
└── setup.ts
```

## 📁 Project Structure

- `src/` - Source code with routes, services, and database logic
- `tests/` - Jest test suites
- `logs/` - Application logs (excluded from git)
- `Dockerfile` - Container definition

## 🔄 Automated Tasks

The backend includes a cron scheduler that:
- Runs every minute
- Checks for scheduled notifications
- Executes pending notification jobs
- Logs all cron activities

## 📝 Logging

Logs are written to:
- `logs/all.log` - All log levels
- `logs/error.log` - Errors only
- Console output during development

## 🐳 Docker

```bash
# Build container
docker build -t calendar-backend .

# Run container
docker run -p 3000:3001 calendar-backend

# Using docker-compose (recommended)
docker-compose up backend
```

## 🔒 Security Features

- CORS configuration for cross-origin requests
- Request logging for monitoring
- Database file exclusion from version control
- Type-safe API with TypeScript

## 🚀 Performance

- **Bun runtime**: ~3x faster than Node.js
- **Elysia.js framework**: Lightweight & fast
- **PostgreSQL**: Persistent relational database with tracked schema migrations
- **Prisma**: Type-safe asynchronous queries through the PostgreSQL adapter

## 📚 API Documentation

Start the server and visit:
- **Swagger UI**: http://localhost:3001/swagger
- **OpenAPI spec**: Auto-generated from route definitions

## 🤝 Development

1. Make changes to source files
2. Tests auto-run on save (with `bun dev`)
3. Use TypeScript for type safety
4. Follow existing code patterns
5. Update tests for new features

---

This project was created using `bun init` with [Bun](https://bun.sh) runtime.
