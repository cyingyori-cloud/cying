# 多阶段构建：先构建前端，再部署后端
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# 复制前端依赖文件
COPY package*.json ./
RUN npm install

# 复制前端源码
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./

# 构建前端
RUN npm run build

# ─────────────────────────────────────
# 生产阶段：API + 前端静态文件
FROM node:20-alpine

WORKDIR /app

# 复制 API 依赖
COPY api/package*.json ./
RUN npm install

# 复制 API 代码
COPY api/ ./

# 从前端构建阶段复制 dist 到 api/public
COPY --from=frontend-builder /build/dist ./public

EXPOSE 8080

CMD ["node", "index.cjs"]
