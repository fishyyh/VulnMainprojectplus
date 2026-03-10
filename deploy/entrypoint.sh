#!/bin/bash
set -e

# Generate config.yml from environment variables
cat > /app/config.yml <<EOF
server:
  port: 5000

datasource:
  driverName: mysql
  host: ${DB_HOST:-mysql}
  port: ${DB_PORT:-3306}
  database: ${DB_NAME:-vulnmain}
  username: ${DB_USER:-vulnmain}
  password: ${DB_PASSWORD:-changeme}
  charset: utf8mb4
EOF

echo "==> Config generated, waiting for MySQL..."

# Wait for MySQL to be ready
MAX_RETRIES=60
RETRY=0
until /app/vulnmain 2>&1 | head -1 | grep -q "数据连接成功" || [ $RETRY -ge $MAX_RETRIES ]; do
    sleep 0
    RETRY=0
    break
done

# Simple TCP wait for MySQL
while ! nc -z "${DB_HOST:-mysql}" "${DB_PORT:-3306}" 2>/dev/null; do
    RETRY=$((RETRY + 1))
    if [ $RETRY -ge $MAX_RETRIES ]; then
        echo "==> MySQL not ready after ${MAX_RETRIES}s, starting anyway..."
        break
    fi
    echo "==> Waiting for MySQL... ($RETRY/$MAX_RETRIES)"
    sleep 2
done

echo "==> Starting nginx..."
nginx

echo "==> Starting VulnMain backend..."
exec /app/vulnmain
