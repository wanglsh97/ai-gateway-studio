# AI Gateway Studio

AI Gateway Studio 是一个公开访问的 AI 能力演示站及管理员中后台。当前工程按 OpenSpec change `build-aigateway-v1` 实施，优先使用 Mock Adapter 串通完整链路。

## 环境要求

- Node.js 24 LTS
- pnpm 10（仓库通过 `packageManager` 固定版本）
- Docker Engine 与 Docker Compose（启动 PostgreSQL、Redis 时需要）

## 初始化

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm infra:up
pnpm db:migrate:deploy
pnpm dev
```

默认地址：

- Web：http://localhost:3000
- API：http://localhost:3001/api/v1
- Liveness：http://localhost:3001/health/live
- Readiness：http://localhost:3001/health/ready

## 常用命令

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
pnpm db:validate
pnpm db:generate
pnpm db:migrate:dev
pnpm db:migrate:deploy
```

重置测试数据库前必须显式提供数据库名包含 `_test` 或 `test_` 的 `DATABASE_URL`：

```bash
DATABASE_URL=postgresql://aigateway:password@localhost:5432/aigateway_test pnpm db:test:reset
```

禁止把真实 API Key、生产数据库密码或 Cookie secret 提交到仓库。
