# 周会计记账系统（ZhangBen）

符合国内会计制度的 Web 记账系统（功能对标金蝶/用友的账务处理，**不含进销存**）。支持**企业会计准则**与**小企业会计准则**两套准则，覆盖记账、查询与财务报表输出，本地 Docker 一键部署，开源可自托管。

## 功能

- **多账套**：每个账套绑定一套会计准则（企业会计准则 / 小企业会计准则），自动导入对应会计科目表
- **会计科目**：级次编码、余额方向、辅助核算（客户/供应商/部门/职员/项目）、期初余额
- **记账凭证**：录入/编辑/审核/记账/作废，借贷平衡硬校验，凭证字+号连续，**不可逆记账**（已记账仅红字冲销）
- **账簿**：总账、明细账、现金/银行日记账、科目余额表、试算平衡
- **期末处理**：损益结转、月结/年结、期间锁定
- **财务报表**：资产负债表、利润表、现金流量表（含勾稽校验，两套准则格式）
- **固定资产**：卡片管理 + 直线法自动折旧
- **权限与审计**：制单/审核/记账职责分离（RBAC），全量审计日志

## 技术栈

| 层 | 选型 |
|---|---|
| 后端 | NestJS + Prisma + PostgreSQL 16（金额 `NUMERIC(18,2)`，禁浮点） |
| 前端 | React 19 + TypeScript + Vite + Ant Design 5 |
| 部署 | Docker Compose（db + backend + frontend） |

## 快速开始（Docker）

```bash
# 1. 克隆并进入项目
git clone <repo-url> && cd zhangben

# 2. 配置环境变量（可选，默认已可用）
cp backend/.env.example backend/.env

# 3. 一键启动
docker compose up -d

# 4. 访问 http://localhost:3000
#    默认账号：admin / admin123
```

> 端口映射：前端 `3000`、后端 API `8081`、数据库 `5433`（宿主侧，避免与常见端口冲突）。可在 `docker-compose.yml` 中修改。

## 本地开发

```bash
# 后端（需先启动数据库：docker compose up -d db）
cd backend
npm install
npx prisma migrate dev
npm run seed          # 建管理员 + 默认账套 + 科目表
npm run start:dev     # http://localhost:8080/api

# 前端
cd frontend
npm install
npm run dev           # http://localhost:5173
```

## 项目结构

```
backend/    NestJS + Prisma 后端
  prisma/   schema.prisma、迁移、种子数据
  src/
    auth/        JWT 认证 + RBAC 守卫
    accounts/    账套 / 科目 / 辅助核算
    vouchers/    凭证引擎
    ledgers/     账簿查询
    closing/     期末结转 / 结账
    reports/     财务报表
    assets/      固定资产
    cashflow/    现金流量项目
frontend/   React + Ant Design 前端
docs/       调研报告、财务核算规范、数据模型设计
```

## 会计合规要点

- 依据《会计软件基本功能和服务规范》（财会〔2024〕12号）：**不可逆记账**、凭证连续编号、中文界面、操作日志、容灾备份
- 财务报表格式：现行财会〔2019〕6号，预留财会〔2026〕11号新格式（模板化切换）
- 复式记账借贷平衡在服务层事务内强制；金额一律定点数（`NUMERIC(18,2)`）

## 测试

```bash
cd backend && npm test        # 单元测试（凭证/账簿/期末/报表/资产）
cd frontend && npm run build  # 前端构建
```

## License

MIT
