# syntax=docker/dockerfile:1.6
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o seed   ./cmd/seed

FROM alpine:3.24
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache ca-certificates tzdata curl
WORKDIR /app
COPY --from=builder --chown=65534:65534 /app/server .
COPY --from=builder --chown=65534:65534 /app/seed   .

# Download GeoLite2 Country database for IP geolocation (cached)
RUN --mount=type=cache,target=/var/cache/apk \
    --mount=type=cache,target=/tmp/geoip-cache \
    mkdir -p /app/GeoIP /tmp/geoip-cache && \
    if [ -f /tmp/geoip-cache/GeoLite2-Country.mmdb ]; then cp /tmp/geoip-cache/GeoLite2-Country.mmdb /app/GeoIP/GeoLite2-Country.mmdb; \
    else curl -fsSL -o /app/GeoIP/GeoLite2-Country.mmdb "https://git.io/GeoLite2-Country.mmdb" && cp /app/GeoIP/GeoLite2-Country.mmdb /tmp/geoip-cache/ || echo '{"Binary format MaxMind database required. Download from https://dev.maxmind.com/geoip/geolite2-free-geolocation-data'} > /app/GeoIP/README.md; fi
RUN chown -R 65534:65534 /app/GeoIP

RUN mkdir -p /app/storage && chown 65534:65534 /app/storage
EXPOSE 8080
USER 65534
CMD ["./server"]
