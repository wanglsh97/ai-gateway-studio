#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL 未设置，拒绝清理数据。" >&2
  exit 1
fi

expected_confirmation='delete-anonymous-request-data'
if [ "${CONFIRM_DELETE_ANONYMOUS_DATA:-}" != "$expected_confirmation" ]; then
  echo "该操作会永久删除现有 RequestLog、BillingRecord 和 ImageGenerationTask。" >&2
  echo "确认数据无需保留后，设置 CONFIRM_DELETE_ANONYMOUS_DATA=$expected_confirmation。" >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
TRUNCATE TABLE "ImageGenerationTask", "BillingRecord", "RequestLog";
COMMIT;
SQL

echo "匿名请求和图片任务已清理，可以执行 prisma migrate deploy。"
