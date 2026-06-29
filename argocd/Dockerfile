# ── Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Allow build time without a DB (Next.js SSR collects page data eagerly)
ENV DATABASE_URL="postgresql://localhost:5432/c1pay"

# Install dependencies first (leverages Docker layer caching)
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* .npmrc .npmrc.local ./
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  elif [ -f yarn.lock ]; then corepack enable && yarn install --frozen-lockfile; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
  else echo "No lockfile found." && exit 1; fi

COPY . .
RUN npx next build

# ── Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only what's needed at runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next      ./.next
COPY --from=builder /app/public      ./public

# .next/static — CSS bundles and static assets needed at runtime
COPY --from=builder /app/.next/static ./.next/static
# .next/package.json — contains the Next.js build ID
COPY --from=builder /app/.next/package.json ./.next/package.json

EXPOSE 3000

# Next.js 15+ ESM output requires --experimental-vm-modules for node runtime
CMD ["node", "--experimental-vm-modules", ".next/server/server.mjs"]
