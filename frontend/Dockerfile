# syntax=docker/dockerfile:1.6
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    --mount=type=cache,target=/app/node_modules \
    bun install --frozen-lockfile 2>/dev/null || bun install
COPY . .
ARG VITE_API_BASE_URL=http://localhost:8080
RUN --mount=type=cache,target=/root/.bun/install/cache \
    --mount=type=cache,target=/app/node_modules \
    --mount=type=cache,target=/root/.cache \
    bun run build

FROM nginx:1.30-alpine
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache ca-certificates
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
