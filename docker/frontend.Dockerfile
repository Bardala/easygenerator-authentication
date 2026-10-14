FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --workspace @easygenerator/frontend --include-workspace-root
COPY apps/frontend apps/frontend
RUN npm run build --workspace @easygenerator/frontend

FROM nginx:stable-alpine AS runtime
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/http.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/app.routes.conf /etc/nginx/app.routes.conf
COPY --from=build --chown=nginx:nginx /app/apps/frontend/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=12 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
