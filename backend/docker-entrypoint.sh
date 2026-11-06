#!/bin/sh
# 后端容器入口：先跑数据库迁移（幂等），再启动服务。
# 这样无论 Portainer 还是 docker compose 部署，都会自动把结构升级到最新。
set -e

echo "[entrypoint] 应用数据库迁移 prisma migrate deploy ..."
npx prisma migrate deploy

echo "[entrypoint] 启动后端 ..."
exec node dist/main.js
