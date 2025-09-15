# ========= Build stage =========
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --prefer-offline --no-audit --no-fund
COPY . .
RUN npm run build

# ========= Run stage =========
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 拷贝 Next 独立产物
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 模板与配置（可被运行时 -v 覆盖）
COPY templates ./templates
COPY templates.config.json ./templates.config.json
RUN mkdir -p ./seals

EXPOSE 3000
CMD ["node", "server.js"]
