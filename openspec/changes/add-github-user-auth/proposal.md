## Why

当前 Chat、文生图和 Prompt 优化允许匿名调用，`RequestLog` 和 `ImageGenerationTask` 只能记录请求或来源 IP，无法稳定区分具体用户。项目不希望建设独立账号、密码、注册和找回密码体系，因此采用 GitHub OAuth 作为唯一用户端登录方式，由 API 维护本地用户映射和服务端会话。

## What Changes

- 新增 GitHub OAuth 登录、callback、会话查询和退出接口，NestJS API 作为认证真源。
- 新增统一 `/login` 页面；未登录访问 `/chat`、`/image`、`/prompt` 时跳转登录，登录后安全返回原站内页面。
- 新增 `User` 和 `UserSession` 表。用户以不可变 GitHub 数字 ID 唯一识别；保存 username、昵称、头像和可选的已验证主邮箱。
- Chat、Image 创建/查询/下载和 Prompt 优化必须携带有效用户 Session；首页、模型列表和 health 保持公开。
- `RequestLog` 和 `ImageGenerationTask` 强制关联用户；图片任务查询和下载必须校验所有权；`BillingRecord` 通过 `RequestLog` 间接归属用户。
- 管理员请求日志列表展示用户并支持按 GitHub username 或 GitHub ID 筛选，详情展示完整用户身份信息。
- 开发和生产分别使用 GitHub OAuth App；生产登录只支持 HTTPS 域名。

## Capabilities

### New Capabilities

- `user-authentication`: GitHub OAuth、用户映射、数据库 Session、用户端路由/API 保护和资源所有权。

### Modified Capabilities

- `chat-gateway`: Chat 从匿名调用改为登录用户调用，并将请求日志绑定用户。
- `image-generation`: Image 创建、查询和下载改为登录用户访问，并校验任务所有权。
- `prompt-optimization`: Prompt 优化改为登录用户调用，并将请求日志绑定用户。
- `admin-console`: 请求日志增加用户展示和筛选，不改变管理员认证方式。
- `observability-billing`: 请求日志和图片任务增加必填用户关系，账单通过请求日志归属用户。

## Impact

- Prisma 新增 `User`、`UserSession`，并为 `RequestLog`、`ImageGenerationTask` 增加必填 `userId` 外键和索引。
- API 新增 GitHub OAuth client、用户认证模块、Session guard 和资源所有权校验。
- Web 新增登录页、会话恢复、受保护页面跳转、头像/username 展示和退出入口。
- 新增 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`GITHUB_CALLBACK_URL`、`USER_SESSION_SECRET` 等服务端配置；不得记录或返回 OAuth secret、临时 code、GitHub access token 或 Session token。
- 现有 IP 限流保持不变；本 change 不新增用户维度额度或限流。

## Non-goals

- 不实现邮箱密码注册、登录、密码找回或账号绑定。
- 不实现个人中心、个人历史、用户额度、用户封禁和后台用户管理。
- 不修改现有管理员账号密码认证及管理入口网络策略。
- 不支持公网 IP 作为生产 GitHub 登录入口。

## Acceptance and Rollback Boundary

验收要求开发环境和生产 HTTPS 域名分别完成 GitHub OAuth；未登录请求不能调用付费能力；登录用户的 Chat、Image、Prompt 记录能在管理员日志中按 GitHub 身份区分；用户不能查询或下载其他用户的图片任务。

回滚应用版本前必须先停止写入依赖用户外键的新记录。由于用户关系为必填且不兼容匿名调用，数据库回滚只允许在确认没有需要保留的新用户请求数据时执行；生产发布前必须备份 PostgreSQL。
