# API 服务 Dockerfile
FROM node:20-alpine

WORKDIR /app

# 复制 package 文件
COPY api/package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制 API 代码
COPY api/ ./

# Railway 会设置 PORT 环境变量
EXPOSE 8080

CMD ["node", "index.cjs"]
