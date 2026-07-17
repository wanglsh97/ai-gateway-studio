#!/bin/sh
set -eu

config='infra/nginx/default.conf.template'
smoke='infra/scripts/smoke-production.sh'
route_block="$(sed -n '/location = \/api\/v1\/chat\/completions {/,/^    }/p' "$config")"

require_route_directive() {
  directive="$1"
  if ! printf '%s\n' "$route_block" | grep -Fq "$directive"; then
    echo "Chat SSE 路由缺少配置：$directive" >&2
    exit 1
  fi
}

require_smoke_probe() {
  probe="$1"
  if ! grep -Fq -- "$probe" "$smoke"; then
    echo "生产 SSE 冒烟缺少验证：$probe" >&2
    exit 1
  fi
}

if [ -z "$route_block" ]; then
  echo '未找到 Chat SSE 专用 Nginx location。' >&2
  exit 1
fi

require_route_directive 'proxy_http_version 1.1;'
require_route_directive 'proxy_request_buffering off;'
require_route_directive 'proxy_buffering off;'
require_route_directive 'proxy_cache off;'
require_route_directive 'proxy_read_timeout 300s;'
require_route_directive 'proxy_next_upstream off;'
require_route_directive 'proxy_ignore_client_abort off;'
require_route_directive 'gzip off;'
require_route_directive 'add_header X-Accel-Buffering no always;'
require_route_directive 'add_header Cache-Control no-cache always;'

require_smoke_probe '--no-buffer'
require_smoke_probe 'delta_count'
require_smoke_probe 'spread_ms'
require_smoke_probe 'data: [DONE]'

echo 'Nginx Chat SSE configuration and delayed-chunk smoke assertions are present.'
