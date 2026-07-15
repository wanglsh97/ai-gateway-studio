#!/usr/bin/env sh
set -eu

BASE_URL="${1:-${BASE_URL:-http://127.0.0.1}}"
BASE_URL="${BASE_URL%/}"

temp_dir="$(mktemp -d)"
fifo="$temp_dir/chat-stream"
transcript="$temp_dir/chat-transcript.log"
curl_pid=''

cleanup() {
  if [ -n "$curl_pid" ]; then
    kill "$curl_pid" 2>/dev/null || true
  fi
  rm -rf "$temp_dir"
}
trap cleanup EXIT INT TERM

curl --fail --silent --show-error --max-time 10 "$BASE_URL/health/live" >/dev/null
curl --fail --silent --show-error --max-time 10 "$BASE_URL/health/ready" >/dev/null
curl --fail --silent --show-error --max-time 10 "$BASE_URL/" >/dev/null

mkfifo "$fifo"

curl --fail --no-buffer --silent --show-error --max-time 30 \
  --request POST "$BASE_URL/api/v1/chat/completions" \
  --header 'Content-Type: application/json' \
  --data '{"model":"qwen","messages":[{"role":"user","content":"生产部署流式冒烟"}],"stream":true,"maxTokens":64}' \
  >"$fifo" &
curl_pid=$!

delta_count=0
first_delta_ms=''
last_delta_ms=''
usage_seen=0
done_seen=0

while IFS= read -r line; do
  printf '%s\n' "$line" >>"$transcript"
  case "$line" in
    data:*'"content":'*)
      now_ms="$(date +%s%3N)"
      delta_count=$((delta_count + 1))
      if [ -z "$first_delta_ms" ]; then first_delta_ms="$now_ms"; fi
      last_delta_ms="$now_ms"
      ;;
    data:*'"object":"chat.completion.usage"'*) usage_seen=1 ;;
    'data: [DONE]') done_seen=1 ;;
  esac
done <"$fifo"

wait "$curl_pid"
curl_pid=''

if [ "$delta_count" -lt 3 ]; then
  echo "Chat SSE delta 数不足：$delta_count" >&2
  exit 1
fi
if [ "$usage_seen" -ne 1 ] || [ "$done_seen" -ne 1 ]; then
  echo 'Chat SSE 缺少 usage 或 [DONE]' >&2
  exit 1
fi

spread_ms=$((last_delta_ms - first_delta_ms))
if [ "$spread_ms" -lt 20 ]; then
  echo "Chat SSE 可能被代理缓冲：delta 时间跨度仅 ${spread_ms}ms" >&2
  exit 1
fi

printf 'production_smoke=ok deltas=%s spread_ms=%s\n' "$delta_count" "$spread_ms"
