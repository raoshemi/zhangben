#!/usr/bin/env bash
# 生产部署（GHCR 镜像模式）：拉镜像 → 跑迁移 → 重启。不需要 git clone / 本地构建。
# 用法：./deploy-prod.sh    （可放进 TrueNAS Cron Jobs 定时执行）
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "[deploy-prod] $(date '+%F %T') 拉取最新镜像并重启（后端启动时会自动跑数据库迁移）"
$COMPOSE pull
$COMPOSE up -d --remove-orphans

echo "[deploy-prod] 清理旧镜像"
docker image prune -f >/dev/null 2>&1 || true

echo "[deploy-prod] $(date '+%F %T') 完成，服务状态："
$COMPOSE ps
