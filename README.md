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

## 阿里云 ECS 生产部署

项目提供 Web/API 多阶段镜像、单机生产 Compose、Nginx SSE 代理、日志轮转、PostgreSQL 备份恢复和人工发布脚本。部署前请完整阅读 [ECS 单机部署与回滚手册](docs/deployment/ecs.md)。

首次 ECS 上线必须使用 Mock-only 配置完成公网 IP、域名、health、SSE 和持久化验收，再逐个注入真实模型 Key。生产环境变量只保存在服务器的 `.env.production`，不要复制本机 `.env` 或提交真实密钥。

## 常用命令

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm check
pnpm db:validate
pnpm db:generate
pnpm db:migrate:dev
pnpm db:migrate:deploy
```

Mock Chat 主链路可在不配置任何真实厂商 API Key 的情况下执行完整回归。命令会校验测试数据库名，部署已有 migration，并运行 SDK、API、本地 PostgreSQL E2E、Web 状态测试与 Web 生产构建：

```bash
TEST_DATABASE_URL=postgresql://aigateway:password@localhost:5432/aigateway_test pnpm test:mock-chat
```

Qwen Adapter 的默认单元测试只读取去敏 fixture，不访问外部网络。购买并配置北京地域百炼 API Key 后，可显式执行一次低额度真实冒烟；若控制台提供了带 Workspace ID 的专属地址，应同时覆盖 `QWEN_BASE_URL`：

```bash
pnpm test:smoke:qwen
```

GLM 同样使用显式的低额度冒烟命令，默认端点为智谱官方兼容地址：

```bash
pnpm test:smoke:glm
```

DeepSeek 当前使用 V4 模型 ID，真实冒烟命令如下：

```bash
pnpm test:smoke:deepseek
```

上述冒烟命令与 Kimi 一样读取根目录中不会提交的 `.env`，不会打印 API Key，也不会被 `pnpm test` 或 CI 自动执行。运行前必须填写对应 `*_API_KEY` 和 `*_MODEL_ID`；正式启动 API 时还需要将对应 `*_ENABLED` 改为 `true`。

Kimi 使用中国区 Moonshot 兼容端点。先在 Moonshot 控制台创建新 Key，并只写入不会提交的本地 `.env`：

```bash
KIMI_ENABLED=true
KIMI_API_KEY=<新创建的 Key>
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL_ID=kimi-k2.6
```

然后显式执行最多输出 16 Token 的真实冒烟：

```bash
pnpm test:smoke:kimi
```

浏览器手工验收时运行 `pnpm dev`，访问同源 `/chat` 发起请求；页面展示的 request ID 应能在 `RequestLog` 中查到唯一的 `SUCCEEDED` 记录及其一对一 `BillingRecord`。API 的注入点使用显式 token，使 `tsx watch` 开发态与 TypeScript 生产构建保持一致。

重置测试数据库前必须显式提供数据库名包含 `_test` 或 `test_` 的 `DATABASE_URL`：

```bash
DATABASE_URL=postgresql://aigateway:password@localhost:5432/aigateway_test pnpm db:test:reset
```

禁止把真实 API Key、生产数据库密码或 Cookie secret 提交到仓库。
