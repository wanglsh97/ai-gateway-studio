#!/usr/bin/env sh
set -eu

if [ ! -r /etc/os-release ]; then
  echo '无法识别操作系统，仅支持 Ubuntu ECS。' >&2
  exit 1
fi

. /etc/os-release
if [ "${ID:-}" != 'ubuntu' ]; then
  echo "当前系统不是 Ubuntu：${ID:-unknown}" >&2
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  SUDO=''
elif command -v sudo >/dev/null 2>&1; then
  SUDO='sudo'
else
  echo '需要 root 或 sudo 权限安装 ECS 依赖。' >&2
  exit 1
fi

$SUDO apt-get update
$SUDO apt-get install -y --no-install-recommends ca-certificates curl git

if ! command -v docker >/dev/null 2>&1; then
  $SUDO install -m 0755 -d /etc/apt/keyrings
  $SUDO curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    -o /etc/apt/keyrings/docker.asc
  $SUDO chmod a+r /etc/apt/keyrings/docker.asc

  architecture="$(dpkg --print-architecture)"
  codename="${UBUNTU_CODENAME:-$VERSION_CODENAME}"
  printf '%s\n' \
    'Types: deb' \
    'URIs: https://download.docker.com/linux/ubuntu' \
    "Suites: $codename" \
    'Components: stable' \
    "Architectures: $architecture" \
    'Signed-By: /etc/apt/keyrings/docker.asc' \
    | $SUDO tee /etc/apt/sources.list.d/docker.sources >/dev/null

  $SUDO apt-get update
  $SUDO apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
fi

$SUDO systemctl enable --now docker

$SUDO docker version >/dev/null
$SUDO docker compose version >/dev/null

docker_group_user="${SUDO_USER:-}"
if [ -n "$docker_group_user" ] && [ "$docker_group_user" != 'root' ]; then
  $SUDO usermod -aG docker "$docker_group_user"
  echo "已将 $docker_group_user 加入 docker 组；请退出 SSH 并重新登录后再部署。"
fi

echo 'ecs_bootstrap=ok'
echo '请在阿里云安全组仅公开 80/443，并将 22 限制为可信管理 IP。'
