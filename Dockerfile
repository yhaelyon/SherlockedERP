FROM node:20-alpine AS builder
WORKDIR /app

# Cache bust: change this value to force a full rebuild
ARG CACHEBUST=2
RUN echo "Cache bust: $CACHEBUST"

COPY package*.json ./
COPY turbo.json ./
COPY packages ./packages
COPY apps ./apps

RUN npm ci
RUN npx turbo build --filter=web

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Debug: show standalone structure so we know exact server.js location
RUN echo "=== standalone root ===" && ls -la /app && echo "=== apps/web ===" && ls -la /app/apps/web 2>/dev/null || echo "no apps/web dir"

EXPOSE 3000
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["node", "apps/web/server.js"]
