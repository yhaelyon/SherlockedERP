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

# Copy standalone server and its dependencies
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static assets (required — not included in standalone)
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# Copy public folder
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["node", "apps/web/server.js"]
