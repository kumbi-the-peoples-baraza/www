FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o seed   ./cmd/seed

FROM alpine:3.24
RUN apk add --no-cache ca-certificates tzdata curl
WORKDIR /app
COPY --from=builder --chown=65534:65534 /app/server .
COPY --from=builder --chown=65534:65534 /app/seed   .

# Download GeoLite2 Country database for IP geolocation
RUN mkdir -p /app/GeoIP && \
    curl -fsSL -o /app/GeoIP/GeoLite2-Country.mmdb \
    "https://git.io/GeoLite2-Country.mmdb" || \
    echo '{"Binary format MaxMind database required. Download from https://dev.maxmind.com/geoip/geolite2-free-geolocation-data'} > /app/GeoIP/README.md
RUN chown -R 65534:65534 /app/GeoIP

RUN mkdir -p /app/storage && chown 65534:65534 /app/storage
EXPOSE 8080
USER 65534
CMD ["./server"]
