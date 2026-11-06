#!/usr/bin/env bash
# TrueNAS / 任意 Linux 上的部署脚本：拉代码 → 跑迁移 → 重建重启
# 用法：在部署目录执行 ./deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"
BRANCH="${DEPLOY_BRANCH:-master}"

echo "[deploy] $(date '+%F %T') 开始部署 $APP_DIR (分支 $BRANCH)"

echo "[deploy] 1/3 拉取最新代码"
git fetch --all --prune
git reset --hard "origin/$BRANCH"

echo "[deploy] 2/3 构建并重启（后端启动时会自动跑数据库迁移）"
docker compose build
docker compose up -d --remove-orphans

echo "[deploy] 清理旧镜像"
docker image prune -f >/dev/null 2>&1 || true

echo "[deploy] $(date '+%F %T') 完成，服务状态："
docker compose ps
