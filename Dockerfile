FROM node:22-alpine

WORKDIR /app

# Copy package files and patches
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches/

# Install pnpm and all dependencies
RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Build the project
RUN pnpm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
