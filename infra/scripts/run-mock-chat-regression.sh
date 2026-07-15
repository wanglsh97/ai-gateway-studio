#!/usr/bin/env sh
set -eu

if [ -z "${TEST_DATABASE_URL:-}" ]; then
  echo "TEST_DATABASE_URL 未设置，无法运行 Mock Chat 数据库回归。" >&2
  exit 1
fi

case "$TEST_DATABASE_URL" in
  *_test*|*test_*) ;;
  *)
    echo "TEST_DATABASE_URL 必须包含 _test 或 test_，拒绝使用非测试数据库。" >&2
    exit 1
    ;;
esac

unset QWEN_API_KEY GLM_API_KEY DEEPSEEK_API_KEY WANXIANG_API_KEY COGVIEW_API_KEY
export NODE_ENV=test
export MOCK_PROVIDER_ENABLED=true
export QWEN_ENABLED=false
export GLM_ENABLED=false
export DEEPSEEK_ENABLED=false
export WANXIANG_ENABLED=false
export COGVIEW_ENABLED=false
export DATABASE_URL="$TEST_DATABASE_URL"

corepack pnpm db:migrate:deploy
corepack pnpm --filter @aigateway/sdk test
corepack pnpm --filter @aigateway/api test
corepack pnpm test:e2e
