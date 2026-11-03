# AutoLog: builds the web app (Vue) and serves it with the API (Node + Hono) in a single container.
# Usage: docker compose up -d --build   (see docker-compose.yml, .env.example and docs/)

# ---- 1. web
FROM node:26-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web ./
RUN npm run build

# ---- 2. server
FROM node:26-alpine
LABEL org.opencontainers.image.title="AutoLog"       org.opencontainers.image.description="Self-hosted vehicle logbook: fill-ups, expenses, reminders and costs"       org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production \
    TZ=Europe/Madrid \
    PORT=8791 \
    STATIC_DIR=web \
    FILES_DIR=/data/files \
    NODE_NO_WARNINGS=1
WORKDIR /srv
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci --omit=dev
COPY server/src server/src
COPY --from=web /src/web/dist web
# Attachments go in a volume mounted at /data (docker-compose.yml). Owned by the unprivileged node user.
RUN mkdir -p /data/files && chown -R node:node /data
EXPOSE 8791
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://localhost:${PORT:-8791}/v1/health || exit 1
USER node
CMD ["node", "server/src/index.js"]
