
FROM node:20-alpine AS builder

WORKDIR /app

# Install root dependencies
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit --no-fund --force

# Install client dependencies
COPY client/package*.json ./client/
RUN cd client && npm ci --prefer-offline --no-audit --no-fund --force

# Copy source code (minimal context)
COPY server/ ./server/
COPY client/src ./client/src/
COPY client/public ./client/public/
COPY client/index.html ./client/
COPY client/vite.config.js ./client/

# Build React client
RUN cd client && npm run build

# Production stage - minimal final image
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit --no-fund --force && \
    npm cache clean --force && \
    rm -rf /root/.npm

# Copy built assets and server code
COPY --from=builder /app/client/dist ./client/dist
COPY server/ ./server/

# Create data directories
RUN mkdir -p /app/data /app/journal && \
    chown -R node:node /app/data /app/journal

# Security & runtime settings
EXPOSE 8000
ENV NODE_ENV=production
# SECURITY: Set ADMIN_PASSWORD and JWT_SECRET at runtime via docker-compose.yml or docker run -e
# DO NOT hardcode secrets in the image

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api || exit 1

# Run as non-root
USER node
CMD ["npm", "start"]