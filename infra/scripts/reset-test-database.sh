#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL 未设置，拒绝重置数据库。" >&2
  exit 1
fi

case "$DATABASE_URL" in
  *_test*|*test_*) ;;
  *)
    echo "DATABASE_URL 必须包含 _test 或 test_，拒绝重置非测试数据库。" >&2
    exit 1
    ;;
esac

corepack pnpm exec prisma migrate reset --force
