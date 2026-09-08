FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY webapp/package.json webapp/
RUN yarn install --frozen-lockfile

FROM deps AS dev
COPY shared shared
RUN yarn workspace @planning-espoir/shared build
CMD ["yarn", "workspace", "@planning-espoir/webapp", "dev"]

FROM deps AS build
ARG VITE_AUTH_ENABLED
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_GATEWAY_URL
ARG VITE_APP_GROUP
ARG VITE_API_BASE

ENV VITE_AUTH_ENABLED=$VITE_AUTH_ENABLED \
    VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID \
    VITE_GATEWAY_URL=$VITE_GATEWAY_URL \
    VITE_APP_GROUP=$VITE_APP_GROUP \
    VITE_API_BASE=$VITE_API_BASE

COPY shared shared
COPY webapp webapp
RUN yarn workspace @planning-espoir/shared build && yarn workspace @planning-espoir/webapp build

FROM nginx:alpine AS runtime
COPY webapp/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/webapp/dist /usr/share/nginx/html
EXPOSE 80
