FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all deps (including devDeps for build)
RUN npm install

# Copy source
COPY . .

# Build the React frontend
RUN npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "api-server.js"]
