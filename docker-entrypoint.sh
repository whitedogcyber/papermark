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

# Swap the build placeholders for this environment's URL and host.
URL_PLACEHOLDER="https://wd-runtime-base-url.invalid"
HOST_PLACEHOLDER="wd-runtime-base-host.invalid"
APP_URL="${NEXT_PUBLIC_BASE_URL:-$NEXTAUTH_URL}"
APP_URL="${APP_URL%/}"
if [ -z "$APP_URL" ]; then
    echo "ERROR: set NEXT_PUBLIC_BASE_URL (or NEXTAUTH_URL) to this environment's URL"
    exit 1
fi
APP_HOST="${NEXT_PUBLIC_APP_BASE_HOST:-${APP_URL#*://}}"
APP_HOST="${APP_HOST%%/*}"
escape() { printf '%s' "$1" | sed -e 's/[|&\\]/\\&/g'; }
files=$(grep -rlF -e "$URL_PLACEHOLDER" -e "$HOST_PLACEHOLDER" /app/server.js /app/.next 2>/dev/null || true)
if [ -n "$files" ]; then
    echo "Setting app URL to $APP_URL ($APP_HOST)"
    printf '%s\n' "$files" | xargs sed -i \
        -e "s|$URL_PLACEHOLDER|$(escape "$APP_URL")|g" \
        -e "s|$HOST_PLACEHOLDER|$(escape "$APP_HOST")|g"
fi
if grep -rqlF -e "$URL_PLACEHOLDER" -e "$HOST_PLACEHOLDER" /app/server.js /app/.next 2>/dev/null; then
    echo "ERROR: could not replace the URL placeholders (read-only filesystem?)"
    exit 1
fi
echo "✅ App URL: $APP_URL"

echo "======================================"
echo "Starting WhiteDog Share..."
echo "======================================"

exec node server.js