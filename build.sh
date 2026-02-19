#!/bin/bash

# Build script for Paracal application
# Usage: ./build.sh [API_URL]
# Example: ./build.sh https://your-domain.com

set -e

API_URL=${1:-"http://localhost:3000"}

echo "Building Paracal with API URL: $API_URL"

# Build Docker containers (backend/.env is loaded via env_file in docker-compose)
VITE_API_BASE_URL=$API_URL docker-compose build --no-cache

echo "Build completed successfully!"
echo "You can now run: docker-compose up -d"
echo "Frontend will be available at: http://localhost:8080"
echo "Backend API will be available at: http://localhost:3000"
echo "API configured for: $API_URL"