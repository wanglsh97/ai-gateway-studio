#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
COMPOSE_FILE="$ROOT_DIR/infra/compose/compose.prod.yml"
BACKUP_PATH="${1:-}"

if [ -z "$BACKUP_PATH" ] || [ ! -f "$BACKUP_PATH" ]; then
  echo "用法：CONFIRM_RESTORE=YES $0 <backup.dump>" >&2
  exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "生产环境文件不存在：$ENV_FILE" >&2
  exit 1
fi
if [ "${CONFIRM_RESTORE:-}" != 'YES' ]; then
  echo '恢复会覆盖当前 PostgreSQL 数据；请设置 CONFIRM_RESTORE=YES 后重试。' >&2
  exit 1
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

if ! compose exec -T postgres pg_restore --list <"$BACKUP_PATH" >/dev/null; then
  echo '备份归档校验失败，尚未停止应用或修改数据库。' >&2
  exit 1
fi

echo '备份归档校验通过，正在停止公网入口和 API。'
compose stop nginx api

if ! compose exec -T postgres sh -ec '
  PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --exit-on-error
' <"$BACKUP_PATH"; then
  echo 'PostgreSQL 恢复失败；Nginx/API 保持停止，请先排查再人工启动。' >&2
  exit 1
fi

compose exec -T postgres sh -ec '
  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --tuples-only \
    --command="SELECT 1"
' >/dev/null

echo 'PostgreSQL 恢复并连通性校验成功。'
echo '请确认代码版本与迁移版本匹配后，执行生产启动命令；脚本不会自动开放公网入口。'
