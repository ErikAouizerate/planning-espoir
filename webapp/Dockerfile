FROM node:22-alpine AS base
WORKDIR /app
RUN npm install --global pnpm@11.18.0

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY webapp/package.json webapp/
RUN pnpm install --frozen-lockfile

# Hot-reload stage used by docker-compose.override.yml (sources are bind-mounted).
# Runs as `node` (UID 1000, matches the host user) so files written into the
# bind-mounted tree are not root-owned.
FROM deps AS dev
COPY shared shared
RUN pnpm --filter @planning-espoir/shared run build \
    && chown -R node:node /app
USER node
CMD ["pnpm", "--filter", "@planning-espoir/webapp", "run", "dev"]

FROM deps AS build

ARG VITE_AUTH_ENABLED
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_GATEWAY_URL
ARG VITE_APP_GROUP

ENV VITE_AUTH_ENABLED=$VITE_AUTH_ENABLED \
    VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID \
    VITE_GATEWAY_URL=$VITE_GATEWAY_URL \
    VITE_APP_GROUP=$VITE_APP_GROUP

COPY shared shared
COPY webapp webapp
RUN pnpm --filter @planning-espoir/shared run build && pnpm --filter @planning-espoir/webapp run build

FROM nginxinc/nginx-unprivileged:alpine AS runtime
COPY webapp/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/webapp/dist /usr/share/nginx/html
EXPOSE 8080
USER nginx
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
