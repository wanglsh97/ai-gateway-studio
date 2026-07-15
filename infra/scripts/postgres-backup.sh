#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
COMPOSE_FILE="$ROOT_DIR/infra/compose/compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"

if [ ! -f "$ENV_FILE" ]; then
  echo "生产环境文件不存在：$ENV_FILE" >&2
  exit 1
fi

umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="$BACKUP_DIR/aigateway-$timestamp.dump"
temporary_path="$backup_path.partial"

cleanup() {
  rm -f "$temporary_path"
}
trap cleanup EXIT INT TERM

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

if ! compose exec -T postgres sh -ec '
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --format=custom \
    --compress=6 \
    --no-owner \
    --no-privileges
' >"$temporary_path"; then
  echo 'PostgreSQL 备份失败。' >&2
  exit 1
fi

if [ ! -s "$temporary_path" ]; then
  echo 'PostgreSQL 备份为空，拒绝保留。' >&2
  exit 1
fi

if ! compose exec -T postgres pg_restore --list <"$temporary_path" >/dev/null; then
  echo 'PostgreSQL 备份归档校验失败。' >&2
  exit 1
fi

mv "$temporary_path" "$backup_path"
chmod 600 "$backup_path"
trap - EXIT INT TERM

printf 'postgres_backup=%s\n' "$backup_path"
echo 'Redis 仅保存可重建状态，不执行备份。'
