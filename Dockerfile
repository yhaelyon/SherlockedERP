FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY turbo.json ./
COPY packages ./packages
COPY apps ./apps

RUN npm ci
RUN npx turbo build --filter=web

FROM node:20-alpine
WORKDIR /app

# standalone preserves monorepo dir structure: server.js is at apps/web/server.js
COPY --from=builder /app/apps/web/.next/standalone ./
# static assets must sit next to server.js inside the monorepo path
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["node", "apps/web/server.js"]
