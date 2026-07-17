# 阿里云 ECS 单机部署与回滚

本文适用于华东 1（杭州）的 Ubuntu 4 核 8G ECS。V1 在一台服务器上运行 Nginx、Web、API、PostgreSQL 和 Redis；只有 Nginx 暴露宿主机端口。

## 1. 上线边界

- Nginx 是唯一公网入口；不要在安全组开放 `3000`、`3001`、`5432`、`6379`。
- 安全组可向公网开放 `80`；`22` 只允许可信管理 IP。配置 HTTPS 后再开放 `443`。
- 当前 Compose 默认提供 HTTP，供公网 IP 和域名部署联调。域名正式公开前必须完成 ICP 备案并配置 HTTPS，避免 Prompt 和 Cookie 以明文传输。
- V1 尚未实现全站成本硬顶和独立内容审核。首次部署必须使用 Mock-only；真实 Key 只在基础链路验收后逐个启用。
- 固定管理员账号只允许开发联调；管理员认证升级前不得把管理入口视为可安全公开的生产能力。
- 生产配置必须保持 `ADMIN_FIXED_CREDENTIALS_ENABLED=false`。API 会拒绝以固定凭证启动生产配置；正式开放管理员入口前，必须在后续 change 中接入密码哈希账号体系或外部身份认证并替换此硬门槛。

## 2. ECS 初始化

在阿里云控制台确认域名 A 记录指向 ECS 公网 IP，并按上述边界配置安全组。登录服务器后安装 Git、Docker Engine 和 Compose plugin：

```bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/wanglsh97/ai-gateway-studio.git
cd ai-gateway-studio
sudo sh infra/scripts/ecs-bootstrap.sh
```

脚本会把发起 `sudo` 的账号加入 `docker` 组。Docker 组具备等同 root 的主机控制能力，只能授予可信部署账号；不要通过开放 Docker TCP socket 解决权限问题。退出 SSH 并重新登录后确认：

```bash
docker version
docker compose version
```

## 3. 选择发布版本

V1 使用人工发布，不自动跟随 `main`。每次发布都必须选择明确 commit：

```bash
git fetch origin
git checkout <待发布的完整 commit SHA>
git status --short
```

`git status --short` 必须为空。部署脚本会再次检查工作区，并校验 `.env.production` 中的 `APP_VERSION` 是当前 commit SHA 或不少于 7 位的唯一前缀。

## 4. 注入生产环境变量

首次部署从模板复制，文件只保存在 ECS：

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

至少修改：

- `APP_VERSION`：当前 `git rev-parse HEAD` 的结果。
- `DOMAIN`、`PUBLIC_IP`、`WEB_ORIGIN`。
- `POSTGRES_PASSWORD`：长随机密码。
- `DATABASE_URL`：使用 Compose 服务名 `postgres`；其中密码必须进行 URL 编码。
- `SMOKE_MODEL_ALIAS`：首次保持 `qwen`，同时保持 Qwen 禁用，使该 alias 回退到 Mock Adapter。

首次部署保持：

```dotenv
MOCK_PROVIDER_ENABLED=true
QWEN_ENABLED=false
GLM_ENABLED=false
DEEPSEEK_ENABLED=false
KIMI_ENABLED=false
WANXIANG_ENABLED=false
COGVIEW_ENABLED=false
ADMIN_FIXED_CREDENTIALS_ENABLED=false
```

不要把 `.env.production`、API Key、数据库密码、Cookie secret、证书私钥或数据库备份提交到 Git。

## 5. 首次发布

```bash
ENV_FILE="$PWD/.env.production" ./infra/scripts/deploy-production.sh
```

脚本依次执行：

1. 校验 Docker、环境文件、commit SHA 和干净工作区。
2. 解析并验证生产 Compose。
3. 构建 Web、API 和 migration 镜像。
4. 已有 PostgreSQL 正在运行时，先创建并验证 custom-format 备份；首次部署跳过。
5. 启动 PostgreSQL、Redis，执行 Prisma migration，再按依赖启动 API、Web、Nginx。
6. 最多等待 180 秒通过 readiness。
7. 通过 Nginx 运行首页、health、Mock Chat SSE 分段到达和 usage/`[DONE]` 冒烟。

任何一步失败都会返回非零状态。脚本不会自动删除卷、恢复数据库或切换 Git 版本。

## 6. 发布验收

定义 Compose 命令：

```bash
export ENV_FILE="$PWD/.env.production"
export COMPOSE_FILE="$PWD/infra/compose/compose.prod.yml"
```

查看状态和健康：

```bash
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
curl --fail http://127.0.0.1/health/live
curl --fail http://127.0.0.1/health/ready
```

分别使用公网 IP 和域名执行生产冒烟：

```bash
./infra/scripts/smoke-production.sh "http://<公网IP>"
./infra/scripts/smoke-production.sh "http://<域名>"
```

确认 Web/API 不是 root，且宿主机没有暴露内部端口：

```bash
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T web id -u
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T api id -u
ss -lntp
```

两个 UID 均不能是 `0`。`ss` 不应显示 `3000`、`3001`、`5432`、`6379` 对公网监听。

验证请求已经持久化：

```bash
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres sh -ec '
  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --command="SELECT \"requestId\", provider, status, \"createdAt\" FROM \"RequestLog\" ORDER BY \"createdAt\" DESC LIMIT 5"
'
```

## 7. 启用 Kimi

Mock 完整验收后，在 `.env.production` 中配置：

```dotenv
MOCK_PROVIDER_ENABLED=true
KIMI_ENABLED=true
KIMI_API_KEY=<仅保存在 ECS 的新 Key>
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL_ID=kimi-k2.6
```

保持 `SMOKE_MODEL_ALIAS` 指向一个未启用的文本 alias，以便发布脚本继续验证确定性 Mock SSE。然后重新运行发布脚本，再通过 Nginx 执行一次受限真实请求：

```bash
curl --no-buffer --fail \
  --request POST "http://<域名或公网IP>/api/v1/chat/completions" \
  --header 'Content-Type: application/json' \
  --data '{"model":"kimi","messages":[{"role":"user","content":"只回复 OK"}],"stream":true,"maxTokens":16}'
```

输出必须包含正文、usage 和唯一 `data: [DONE]`。不要在命令行参数、日志或聊天中直接填写 Key。

## 8. 日志与诊断

```bash
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=200 nginx web api
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=200 migrate postgres redis
```

所有容器使用 `json-file` 日志驱动，单文件上限 `10m`、最多保留 5 个压缩分片。不要把 `docker compose logs` 的完整输出发布到公开 Issue，其中可能包含完整 Prompt。

## 9. 手工备份与保留

```bash
ENV_FILE="$ENV_FILE" ./infra/scripts/postgres-backup.sh
```

备份默认保存在仓库根目录 `backups/`，目录权限为 `0700`，归档权限为 `0600`。脚本使用 `pg_restore --list` 验证归档后才原子改名。Redis 仅保存可重建限流状态，不备份。

生产至少保留：

- ECS 本机最近 7 个成功备份。
- 另一故障域中的加密副本，例如开启服务端加密和访问控制的 OSS 私有 Bucket。
- 每月抽取一个备份在隔离环境完成实际恢复演练；只通过 `pg_restore --list` 不等于恢复演练。

## 10. 应用版本回滚

如果新版本冒烟失败且数据库迁移向后兼容：

1. 保存失败版本的 `docker compose ps` 和相关日志。
2. `git checkout <上一个已验收 commit SHA>`。
3. 将 `.env.production` 的 `APP_VERSION` 改为该 SHA。
4. 重新执行 `deploy-production.sh`。
5. 重新执行 IP、域名、health、SSE 和持久化验收。

不要使用 `git reset --hard` 清理服务器；部署脚本会拒绝脏工作区，应先人工确认变更来源。

## 11. 数据库恢复

仅在迁移不兼容或数据损坏时恢复数据库。先确认备份文件和目标应用版本匹配：

```bash
CONFIRM_RESTORE=YES \
ENV_FILE="$ENV_FILE" \
./infra/scripts/postgres-restore.sh backups/<backup>.dump
```

恢复脚本会先验证归档，再停止 Nginx/API，使用 `--clean --if-exists` 覆盖当前数据库并执行连通性检查。无论成功或失败，都不会自动重新开放公网入口。

恢复成功后：

1. checkout 与备份匹配的应用 commit。
2. 更新 `.env.production` 的 `APP_VERSION`。
3. 执行 `deploy-production.sh`。
4. 完成全部发布验收后才恢复对外服务。

## 12. 停止与重启

停止应用但保留 PostgreSQL 数据卷：

```bash
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down
```

不要执行 `down -v`，除非已经完成可恢复备份并明确需要删除全部生产数据。重启仍使用发布脚本，确保迁移、备份和冒烟门禁不被绕过。
