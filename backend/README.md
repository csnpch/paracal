# Paracal Backend

A high-performance REST API built with Bun and Elysia.js for calendar and employee management.

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Run development server with auto-reload
bun dev

# Run production server
bun start

# Run tests
bun test
```

## 📊 Tech Stack

- **Runtime**: [Bun](https://bun.sh) - Fast JavaScript runtime
- **Framework**: [Elysia.js](https://elysiajs.com) - Fast & lightweight web framework
- **Database**: SQLite with better-sqlite3
- **Testing**: Jest
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

The SQLite database includes tables for:
- **employees** - Employee records with roles and details
- **events** - Calendar events with scheduling info
- **holidays** - Company holidays
- **cronjobs** - Scheduled notification jobs

## 🔧 Configuration

### Environment Variables
- `NODE_ENV` - Environment (development/production)
- Default port: **3001**

### Database
- File: `calendar.db` (excluded from git)
- Auto-initialized on startup with schema

## 🧪 Testing

```bash
# Run all tests
bun test

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
- **SQLite**: Zero-config, embedded database
- **Better-sqlite3**: Synchronous, faster SQLite driver

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