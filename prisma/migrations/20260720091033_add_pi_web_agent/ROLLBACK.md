# 回滚说明：20260720091033_add_pi_web_agent

Prisma 迁移为前向（forward-only）。本迁移新增 Agent 相关表、枚举以及 `RequestLog.agentRunId`。

## 推荐回滚方式（不破坏数据）

按 `design.md` 的回滚策略，生产回滚时优先关闭 `/agent` feature flag/导航并停止创建新 run，**保留**新增表与历史记录；现有 `/chat`、`/image`、`/prompt` 不依赖 Agent 模块，可直接恢复应用版本，无需回退数据结构。

## 破坏性回滚（仅在确认无需保留 Agent 数据时手动执行）

以下 SQL 会永久删除全部 Agent 会话、运行、事件、工具调用记录，并解除 `RequestLog` 与 `AgentRun` 的关联。执行前必须先备份 PostgreSQL。`RequestCapability` 枚举已新增的 `AGENT` 值无法在存在引用时安全移除，除非同时清理相关 `RequestLog`，故默认保留该枚举值。

```sql
BEGIN;

ALTER TABLE "RequestLog" DROP CONSTRAINT IF EXISTS "RequestLog_agentRunId_fkey";
DROP INDEX IF EXISTS "RequestLog_agentRunId_idx";
ALTER TABLE "RequestLog" DROP COLUMN IF EXISTS "agentRunId";

DROP TABLE IF EXISTS "AgentToolCall";
DROP TABLE IF EXISTS "AgentEvent";
DROP TABLE IF EXISTS "AgentMessage";
DROP TABLE IF EXISTS "AgentRun";
DROP TABLE IF EXISTS "AgentThread";

DROP TYPE IF EXISTS "AgentToolCallStatus";
DROP TYPE IF EXISTS "AgentMessageRole";
DROP TYPE IF EXISTS "AgentRunLimitReason";
DROP TYPE IF EXISTS "AgentRunStatus";

-- 注意：不移除 RequestCapability 的 'AGENT' 值（PostgreSQL 不支持安全删除枚举值）。

COMMIT;
```

回滚后需将 `prisma/migrations` 目录同步回退到上一个迁移，并重新执行 `pnpm db:generate`。
