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
CMD ["pnpm", "--filter", "@planning-espoir/api", "run", "start:dev"]

FROM deps AS build
COPY shared shared
COPY api api
RUN pnpm --filter @planning-espoir/shared run build && pnpm --filter @planning-espoir/api run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/api ./api
RUN mkdir -p /data && chown node:node /data
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (res) => process.exit(res.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "api/dist/main.js"]
