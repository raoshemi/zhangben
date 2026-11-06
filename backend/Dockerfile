FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npx prisma generate && npm run build

# ---- 迁移镜像（可选，手动跑迁移 / 单独发布时用）----
FROM node:24-alpine AS migrate
WORKDIR /app
COPY prisma ./prisma
RUN npm install prisma@6 --no-audit --no-fund
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- 运行时镜像（必须是最后一个阶段，docker 默认构建它）----
# 启动时自动跑迁移，再启动服务
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# prisma 平时是 devDependency，这里显式装一份到运行时，供启动时 migrate deploy 使用
RUN npm install --omit=dev --no-audit --no-fund \
    && npm install prisma@6 --no-audit --no-fund
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
