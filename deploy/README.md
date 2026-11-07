# TrueNAS SCALE 部署指南（周会计记账系统）

> 适用：TrueNAS SCALE 24.10+（Docker / Electric Eel 及之后版本）

## 一、整体结构

```
浏览器 ──> frpc/反向代理 ──> frontend:80 (Nginx)
                                 └─ /api ──> backend:8080 ──> db:5432 (Postgres)
```

- **frontend**：Nginx，托管 React 静态文件，并把 `/api` 反代给后端
- **backend**：NestJS，启动时自动跑数据库迁移
- **db**：PostgreSQL 16，数据必须落在持久化数据集

## 二、首次部署

### 1. 建目录

在 TrueNAS → Datasets 建应用目录（下面以 `/mnt/tank/apps/zhangben` 为例）：

```bash
/mnt/tank/apps/zhangben/pgdata    # 数据库数据
/mnt/tank/apps/zhangben/certs     # 可选，SSL 证书
```

### 2. 创建自定义应用

TrueNAS → **Apps → Discover Apps → Custom App**，把仓库里的
[`deploy/truenas-app.yaml`](./truenas-app.yaml) 全部内容粘进去。

需要修改的 4 处：

| 配置项 | 说明 |
|---|---|
| `POSTGRES_PASSWORD` | 数据库密码，自己定 |
| `DATABASE_URL` 里的密码 | **必须和上面一致** |
| `JWT_SECRET` | `openssl rand -base64 48` 生成，**必须 ≥32 字符**，否则后端拒绝启动 |
| `ADMIN_PASSWORD` | 管理员初始密码；留空则自动生成，只在容器日志显示一次 |

### 3. 首次启动

后端启动时会自动：

1. 执行 `prisma migrate deploy` 建表
2. 空库时创建管理员（用户名 `ADMIN_USERNAME`）

看日志确认：

```bash
docker logs -f $(docker ps -qf name=zhangben-backend)
# 应看到 [entrypoint] 应用数据库迁移 ... No pending migrations
#       [entrypoint] 启动后端
```

### 4. 访问

局域网访问 `http://<NAS_IP>:3000`，用管理员登录后：

1. 到「系统设置 → 账套管理」确认账套
2. 到「系统设置 → 期初余额」做期初建账
3. 开始录凭证

## 三、frpc 与 SSL 两种常见模式

### 模式 A：SSL 由公网 frps / 反向代理终结（推荐，最简单）

Compose 保持默认（frontend 暴露 3000），frpc 隧道指到本机 3000：

```ini
# frpc.ini 片段
[zhangben]
type = http
local_ip = 127.0.0.1
local_port = 3000
custom_domains = kuaiji.example.com
```

frps / 公网 Nginx 负责 HTTPS 和证书。**证书不用进 NAS**。

### 模式 B：SSL 在本机终结（NAS 自己提供 https）

1. 把证书放 `/mnt/tank/apps/zhangben/certs/`：`fullchain.pem` + `privkey.pem`
2. 取消 compose 里 `gateway` 服务的注释（Caddy，暴露 8443）
3. frpc 隧道改指 `local_port = 8443`，类型可改成 `https`

> 若你的 frps 已经做了 TLS，就别再套一层，否则会二次加密出错。

## 四、版本升级（GitHub 维护版本）

镜像由 GitHub Actions 发布到 GHCR，镜像名：

```
ghcr.io/raoshemi/zhangben/backend:<版本>
ghcr.io/raoshemi/zhangben/frontend:<版本>
```

升级流程：

1. 仓库里打 tag：`git tag v1.1.0 && git push origin v1.1.0`
2. Actions 的 **Publish images** 自动构建并推送 `:1.1.0`（同时更新 `:latest`）
3. 把 `deploy/truenas-app.yaml` 里 backend/frontend 的版本号改成 `1.1.0`
4. TrueNAS → 应用 → **重新部署**（数据库卷不受影响，后端会自动跑迁移）

**回滚**：把版本号改回旧版本再重新部署即可；注意数据库迁移是单向的，跨大版本回滚前先备份 `pgdata`。

## 五、备份

```bash
# 数据库逻辑备份（推荐，可跨版本恢复）
docker exec -t $(docker ps -qf name=zhangben-db) \
  pg_dump -U zhangben zhangben | gzip > /mnt/tank/backup/zhangben-$(date +%F).sql.gz
```

或直接用 TrueNAS 的「定期快照」对 `pgdata` 所在数据集做快照。

## 六、常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 后端反复重启 | `JWT_SECRET` 缺失或 <32 字符 | 补齐后重新部署（日志会明确报错）|
| 页面能开但接口 401 | 换过 `JWT_SECRET` | 重新登录（旧 token 自动失效并跳登录页）|
| 登录密码不知道 | 用了自动生成密码 | 看首次启动日志；或清空库重建 |
| 数据库连不上 | `DATABASE_URL` 密码与 `POSTGRES_PASSWORD` 不一致 | 改成一致 |
