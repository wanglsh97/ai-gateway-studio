#!/bin/sh
set -eu

nginx_bin="${NGINX_BIN:-nginx}"
listen_port="${NGINX_SMOKE_PORT:-18080}"
api_port="${API_PORT:-3101}"
web_port="${WEB_PORT:-3000}"
temp_dir="$(mktemp -d)"
routes="$temp_dir/routes.conf"
main_config="$temp_dir/nginx.conf"
nginx_pid=''

cleanup() {
  if [ -n "$nginx_pid" ]; then kill "$nginx_pid" 2>/dev/null || true; fi
  rm -rf "$temp_dir"
}
trap cleanup EXIT INT TERM

sed \
  -e "s/server web:3000;/server 127.0.0.1:$web_port;/" \
  -e "s/server api:3001;/server 127.0.0.1:$api_port;/" \
  -e "s/listen 80 default_server;/listen $listen_port;/" \
  -e '/listen \[::\]:80 default_server;/d' \
  -e 's/server_name ${DOMAIN} ${PUBLIC_IP} _;/server_name localhost;/' \
  infra/nginx/default.conf.template >"$routes"

escaped_pid_path="$(printf '%s' "$temp_dir/nginx.pid" | sed 's/[&|]/\\&/g')"
escaped_routes_path="$(printf '%s' "$routes" | sed 's/[&|]/\\&/g')"
sed \
  -e "s|\${PID_PATH}|$escaped_pid_path|" \
  -e "s|\${ROUTES_PATH}|$escaped_routes_path|" \
  infra/nginx/nginx.local-test.conf.template >"$main_config"

"$nginx_bin" -t -c "$main_config"
"$nginx_bin" -c "$main_config" -g 'daemon off;' &
nginx_pid=$!

attempt=0
until curl --noproxy '*' --fail --silent --max-time 1 "http://127.0.0.1:$listen_port/health/live" >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 20 ]; then
    echo '本地 Nginx 未能连接 Mock API。' >&2
    exit 1
  fi
  sleep 0.25
done

SMOKE_MODEL_ALIAS=qwen sh infra/scripts/smoke-production.sh "http://127.0.0.1:$listen_port"
