# Multi-stage build for optimized production image
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and patches
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches/

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the project
RUN pnpm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install pnpm in production image
RUN npm install -g pnpm

# Copy package files from builder
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/shared ./shared

# Expose port (Railway will use PORT env variable)
EXPOSE ${PORT:-3000}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "const http=require('http');const port=process.env.PORT||3000;http.get('http://localhost:'+port+'/', (r) => {if (r.statusCode >= 500) process.exit(1)})"

# Start the application
CMD ["node", "dist/index.js"]
