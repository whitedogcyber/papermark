#!/bin/bash
set -e

echo "======================================"
echo "Papermark Self-Hosted Startup"
echo "======================================"

# Wait for database to be ready
if [ -n "$DATABASE_URL" ]; then
    echo "Waiting for database to be ready..."
    max_attempts=30
    attempt=0
    until node node_modules/prisma/build/index.js db push --skip-generate --schema prisma/schema || [ $attempt -eq $max_attempts ]; do
        attempt=$((attempt + 1))
        echo "Database not ready, attempt $attempt/$max_attempts..."
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        echo "ERROR: Could not connect to database after $max_attempts attempts"
        exit 1
    fi
    
    echo "✅ Database connection established"
    
    echo "✅ Database schema in sync"
fi

echo "======================================"
echo "Starting Papermark..."
echo "======================================"

exec node server.js