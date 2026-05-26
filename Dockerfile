# ============================================================
# MULTI-STAGE PRODUCTION DOCKERFILE FOR WACRM
# ============================================================

# Stage 1: Install dependencies only when needed
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# Stage 2: Rebuild the source code only when needed
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for compilation
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Compile Next.js production build (standalone output)
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-privileged system user for container security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Expose port and bind host
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone build output and public folders
COPY --from=builder /app/public ./public

# Set correct permissions for Next.js prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone files (automatically created during next build when output: 'standalone' is set)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Run the container as the non-privileged user
USER nextjs

# Start the Next.js standalone server
CMD ["node", "server.js"]
