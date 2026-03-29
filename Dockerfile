# ============ Stage 1: Build Frontend ============
FROM node:18-alpine AS frontend-builder

# Alpine 换国内镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm install --registry=https://registry.npmmirror.com --legacy-peer-deps
COPY web/ ./
# Set API URL to use relative path via nginx proxy
ENV NEXT_PUBLIC_API_URL=/api
RUN npm run build

# ============ Stage 2: Build Backend ============
FROM golang:1.22-alpine AS backend-builder

# Alpine 换国内镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

RUN apk add --no-cache gcc musl-dev

WORKDIR /app
COPY go.mod go.sum ./
ENV GOPROXY=https://goproxy.cn,direct
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o vulnmain main.go

# ============ Stage 3: Production Image ============
FROM alpine:3.19

# Alpine 换国内镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

RUN apk add --no-cache nginx tzdata bash netcat-openbsd \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && mkdir -p /app/uploads /app/fonts /run/nginx

WORKDIR /app

# Copy backend binary
COPY --from=backend-builder /app/vulnmain .
# Copy fonts
COPY --from=backend-builder /app/fonts ./fonts/
# Copy frontend static files
COPY --from=frontend-builder /app/web/out /usr/share/nginx/html

# Copy nginx config
COPY deploy/nginx.conf /etc/nginx/http.d/default.conf

# Copy entrypoint script
COPY deploy/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/app/entrypoint.sh"]
