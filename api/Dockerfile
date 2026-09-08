FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY webapp/package.json webapp/
RUN yarn install --frozen-lockfile
COPY shared shared
COPY api api
RUN yarn workspace @planning-espoir/shared build && yarn workspace @planning-espoir/api build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/api ./api
EXPOSE 3000
CMD ["node", "api/dist/main.js"]
