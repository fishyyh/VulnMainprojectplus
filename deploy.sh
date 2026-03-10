#!/bin/bash
set -e

# VulnMain 一键部署脚本
# 自动生成随机密码并启动 Docker 容器

ENV_FILE=".env"

echo "============================================"
echo "  VulnMain 漏洞管理平台 - 一键部署"
echo "============================================"

# Generate random password (20 chars, alphanumeric)
gen_password() {
    LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 20
}

# Check if .env already exists
if [ -f "$ENV_FILE" ]; then
    echo ""
    echo "[!] 检测到已有 .env 配置文件"
    read -p "    是否重新生成所有密码？(y/N): " REGEN
    if [ "$REGEN" != "y" ] && [ "$REGEN" != "Y" ]; then
        echo "[*] 使用已有配置启动..."
        docker compose up -d --build
        echo ""
        echo "============================================"
        echo "  部署完成！"
        echo "  访问地址: http://localhost:$(grep APP_PORT $ENV_FILE | cut -d= -f2 || echo 80)"
        echo "============================================"
        exit 0
    fi
fi

# Generate passwords
MYSQL_ROOT_PWD=$(gen_password)
DB_PWD=$(gen_password)
ADMIN_PWD=$(gen_password)

# Write .env file
cat > "$ENV_FILE" <<EOF
# VulnMain Docker 部署配置
# 自动生成于 $(date '+%Y-%m-%d %H:%M:%S')
# 请妥善保管此文件中的密码信息

# MySQL 配置（端口不对外暴露，仅 Docker 内部通信）
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PWD}

# 数据库配置
DB_NAME=vulnmain
DB_USER=vulnmain
DB_PASSWORD=${DB_PWD}

# 应用端口
APP_PORT=80

# 管理员账号配置
ADMIN_EMAIL=
ADMIN_PASSWORD=${ADMIN_PWD}

# Google OAuth 登录（填写后登录页 Google 按钮即可使用）
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URL=
# 限制允许登录的邮箱后缀（多个用逗号分隔，留空则不限制）
# 例如: @company.com,@corp.com
GOOGLE_ALLOWED_EMAIL_SUFFIX=
EOF

echo ""
echo "[+] 已生成随机密码并写入 .env 文件"
echo ""
echo "--------------------------------------------"
echo "  配置信息（请妥善保管）:"
echo "--------------------------------------------"
echo "  MySQL Root 密码:   ${MYSQL_ROOT_PWD}"
echo "  数据库名称:        vulnmain"
echo "  数据库用户:        vulnmain"
echo "  数据库密码:        ${DB_PWD}"
echo "  管理员密码:        ${ADMIN_PWD}"
echo "  应用访问端口:      80"
echo "--------------------------------------------"
echo ""
echo "[*] 开始构建并启动容器..."
echo ""

docker compose up -d --build

echo ""
echo "============================================"
echo "  部署完成！"
echo "============================================"
echo "  访问地址:    http://localhost"
echo "  管理员账号:  admin"
echo "  管理员密码:  ${ADMIN_PWD}"
echo ""
echo "  MySQL 端口不对外暴露，仅 Docker 内部通信"
echo ""
echo "  密码信息已保存至 .env 文件"
echo "  所有密码已保存至 .env 文件，请妥善保管！"
echo "============================================"
