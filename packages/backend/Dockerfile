# ====================================
# Orynthia Backend - Multi-Stage Build
# ====================================

# --- Base ---
FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# --- Development ---
FROM base AS development
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --frozen-lockfile || pnpm install
COPY prisma ./prisma
RUN npx prisma@5 generate
COPY . .
EXPOSE 3000
CMD ["sh", "-c", "npx prisma@5 migrate deploy && pnpm run dev"]

# --- Builder ---
FROM base AS builder
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --frozen-lockfile || pnpm install
COPY prisma ./prisma
RUN npx prisma@5 generate
COPY . .
RUN pnpm run build

# --- Production ---
FROM base AS production
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
RUN npx prisma@5 generate
EXPOSE 3000
CMD ["sh", "-c", "npx prisma@5 migrate deploy && node dist/main.js"]
