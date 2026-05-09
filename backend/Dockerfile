FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o seed   ./cmd/seed

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder --chown=65534:65534 /app/server .
COPY --from=builder --chown=65534:65534 /app/seed   .
RUN mkdir -p /app/storage && chown 65534:65534 /app/storage
EXPOSE 8080
USER 65534
CMD ["./server"]
