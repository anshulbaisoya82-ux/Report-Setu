# Stage 1: generate the Prisma client and build TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json prisma7.config.ts ./
COPY prisma/ ./prisma/
COPY src/ ./src/
# The Prisma client is generated into src/generated/prisma (git-ignored), then compiled with the app.
# A placeholder URL is enough for "generate"; the real one is supplied at run time.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate --config prisma7.config.ts \
  && npm run build

# Stage 2: runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Dependencies (including the Prisma CLI, needed to apply migrations on start)
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Compiled app, Prisma schema + migrations, and the medicine-name catalogue
COPY --from=builder /app/dist ./dist
COPY prisma7.config.ts ./
COPY prisma/ ./prisma/
COPY data/ ./data/

# Run as unprivileged node user for container security
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

# Apply any pending database migrations, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy --config prisma7.config.ts && node dist/index.js"]
