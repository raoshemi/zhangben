FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npx prisma generate && npm run build

# ---- 运行时镜像（精简，不含 devDependencies） ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 8080
CMD ["node", "dist/main.js"]

# ---- 迁移镜像（只含 prisma CLI + schema/migrations，供部署时一次性执行） ----
FROM node:24-alpine AS migrate
WORKDIR /app
COPY prisma ./prisma
RUN npm install prisma@6 --no-audit --no-fund
CMD ["npx", "prisma", "migrate", "deploy"]
