# ====================================
# Finanzguru Frontend - Multi-Stage Build
# ====================================

# --- Base ---
FROM node:20-alpine AS base
WORKDIR /app

# --- Development ---
FROM base AS development
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --frozen-lockfile || pnpm install
COPY . .
EXPOSE 5173
CMD ["pnpm", "run", "dev"]

# --- Builder ---
FROM base AS builder
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --frozen-lockfile || pnpm install
COPY . .
RUN pnpm run build

# --- Production (serve via nginx) ---
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
