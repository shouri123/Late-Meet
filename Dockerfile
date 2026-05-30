# Stage 1: Build dependencies and assets
FROM node:18-alpine@sha256:c8511739c9f2858b97d25e0be951f28b7e6de59012353e6b7d2bf64a2754d924 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build --if-present

# Stage 2: Production release container
FROM node:18-alpine@sha256:c8511739c9f2858b97d25e0be951f28b7e6de59012353e6b7d2bf64a2754d924 AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
