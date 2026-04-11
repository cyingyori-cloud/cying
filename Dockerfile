# PowerQuote API Dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制服务器代码
COPY server/ ./server/
COPY server/db/ ./server/db/

# 环境变量（在 docker-compose.yml 中配置）
ENV PORT=3001
ENV AUTH_DISABLED=false

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# 启动命令
CMD ["node", "server/index.cjs"]
