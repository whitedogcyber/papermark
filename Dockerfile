# syntax=docker/dockerfile:1

# ============================================================================
# Papermark Self-Hosted Dockerfile
# ============================================================================
# This Dockerfile builds Papermark, the open-source DocSend alternative
# Based on Next.js with PostgreSQL, S3-compatible storage, and Resend for email
# ============================================================================

ARG NODE_VERSION=24

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS deps

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
COPY prisma ./prisma

# Install dependencies based on the preferred package manager
RUN \
  if [ -f yarn.lock ]; then \
    yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then \
    npm ci || npm install; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm i --frozen-lockfile; \
  else \
    echo "Lockfile not found." && exit 1; \
  fi



# ============================================================================
# Stage 2: Build
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma Client
RUN npx prisma generate

# Enable Next.js standalone output (produces .next/standalone/server.js)
RUN node -e "const f='next.config.mjs';let s=require('fs').readFileSync(f,'utf8');if(!s.includes(\"output:\")){s=s.replace('const nextConfig = {','const nextConfig = {\\n  output: \"standalone\",');require('fs').writeFileSync(f,s);}" && \
    grep -q 'output: "standalone"' next.config.mjs

# Build the application
# Note: Some env vars need to be present at build time for Next.js
# Set dummy values for build - real values come from environment at runtime
ARG BASE_HOST="localhost"
ARG BASE_URL="http://localhost:3000"
ARG HANKO_TENANT_ID="dummy"
ENV NEXT_PUBLIC_BASE_URL=$BASE_URL
ENV NEXTAUTH_URL=$BASE_URL
ENV NEXT_PUBLIC_APP_BASE_HOST=$BASE_HOST
ENV NEXT_PUBLIC_WEBHOOK_BASE_HOST=$BASE_URL
ENV NEXT_PUBLIC_MARKETING_URL=$BASE_URL
ENV NEXT_PUBLIC_UPLOAD_TRANSPORT=s3
# Public branding for page titles and link previews (compiled in at build).
# Override with --build-arg. Leave BRAND_NAME empty for upstream defaults.
ARG BRAND_NAME="WhiteDog Share"
ARG BRAND_TITLE=""
ARG BRAND_DESCRIPTION="Secure document sharing and data rooms by WhiteDog Cyber."
ARG BRAND_IMAGE_URL="https://share.whitedog.cloud/_static/brand/og-image.png"
ARG BRAND_URL=""
ENV NEXT_PUBLIC_BRAND_NAME=$BRAND_NAME
ENV NEXT_PUBLIC_BRAND_TITLE=$BRAND_TITLE
ENV NEXT_PUBLIC_BRAND_DESCRIPTION=$BRAND_DESCRIPTION
ENV NEXT_PUBLIC_BRAND_IMAGE_URL=$BRAND_IMAGE_URL
ENV NEXT_PUBLIC_BRAND_URL=$BRAND_URL
# Slack integration: off unless set to "true"
ARG ENABLE_SLACK="false"
ENV NEXT_PUBLIC_ENABLE_SLACK=$ENABLE_SLACK
ARG ENABLE_SHAREPOINT="false"
ENV NEXT_PUBLIC_ENABLE_SHAREPOINT=$ENABLE_SHAREPOINT
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV OPENAI_API_KEY=sk-test12345
ENV HANKO_API_KEY=123dummy
ENV NEXT_PUBLIC_HANKO_TENANT_ID=$HANKO_TENANT_ID
ENV SLACK_CLIENT_ID=dummy
ENV SLACK_CLIENT_SECRET=dummy

RUN \
  if [ -f yarn.lock ]; then \
    yarn build; \
  elif [ -f package-lock.json ]; then \
    npm run build; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm build; \
  else \
    echo "Lockfile not found." && exit 1; \
  fi

# ============================================================================
# Stage 3: Production Runtime
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

# Create non-root user for running the app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install runtime dependencies
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    curl \
    bash

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Copy built application (standalone server + static assets)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma CLI for migrations at startup
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy Prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

# Copy startup script
COPY --chmod=755 docker-entrypoint.sh /app/docker-entrypoint.sh

# Set proper permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]