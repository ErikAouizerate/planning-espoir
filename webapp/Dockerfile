FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY webapp/package.json webapp/
RUN yarn install --frozen-lockfile
COPY shared shared
COPY webapp webapp
RUN yarn workspace @planning-espoir/shared build && yarn workspace @planning-espoir/webapp build

FROM nginx:alpine AS runtime
COPY webapp/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/webapp/dist /usr/share/nginx/html
EXPOSE 80
