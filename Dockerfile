# syntax=docker/dockerfile:1

# ---- Dependencies ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables (can be passed via --build-arg)
ARG SUPABASE_URL
ARG SUPABASE_KEY
ARG NEXT_PUBLIC_APP_URL

ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_KEY=$SUPABASE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install ffmpeg for on-demand video transcoding (AVI/MKV → MP4)
RUN apk add --no-cache ffmpeg

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create temp directory for transcoding
RUN mkdir -p /tmp/transcode && chown nextjs:nodejs /tmp/transcode

# Create public directory (may be empty)
RUN mkdir -p public

# Copy public assets if they exist
COPY --from=builder /app/public/ ./public/

# Create .next directory with correct permissions
RUN mkdir -p .next && chown nextjs:nodejs .next

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
