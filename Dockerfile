FROM node:20-alpine

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install --production

# Copy application code
COPY . .

# Expose port
EXPOSE 3070

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=5 CMD wget -qO- http://localhost:3070/health || exit 1

# Start via the startup script
CMD [\"node\", \"scripts/startup.js\"]