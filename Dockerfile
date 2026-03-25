FROM node:20-alpine AS builder
WORKDIR /app

ARG CACHEBUST=4
RUN echo "bust=$CACHEBUST"

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

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

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
