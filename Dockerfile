# Multi-stage build for production
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/

# Install dependencies
RUN cd backend && npm ci --only=production

# Production stage
FROM node:22-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/backend/node_modules ./backend/node_modules

# Copy application code
COPY backend ./backend
COPY frontend ./frontend

# Create data directory with proper permissions
RUN mkdir -p /app/backend/data && \
    chown -R nodejs:nodejs /app/backend/data

# Switch to non-root user
USER nodejs

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Expose port
EXPOSE 8080

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "backend/src/server.js"]
