# Reproducible build container for Late-Meet Chrome Extension
# Produces a production-ready extension bundle in /app/dist/
#
# Usage:
#   docker build -t late-meet-build .
#   docker run --rm -v $(pwd)/dist:/app/dist late-meet-build
#
# This container is for CI/CD and reproducible builds only.
# Late-Meet is a Chrome Extension — it does not run as a server.

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Output stage — minimal image containing only the built extension
FROM node:20-alpine AS output
WORKDIR /app
COPY --from=builder /app/dist ./dist

# Run as non-root user for security best practices
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Default command outputs build info for CI verification
CMD ["ls", "-la", "/app/dist"]
