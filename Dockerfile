# ---- Build stage ----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Built as a same-origin app: nginx (this same container, see nginx.conf)
# serves the static bundle AND reverse-proxies /api to the backend service,
# so the frontend never needs a full absolute API URL baked in.
ENV VITE_API_URL=/api
RUN npm run build

# ---- Serve stage ------------------------------------------------------------
FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1
