# OpenCodex 本机配置

本文记录 AI Gateway Studio 开发机使用
[OpenCodex](https://github.com/lidge-jun/opencodex) 的配置。OpenCodex 是 Codex 前的本机代理，
不属于本项目的运行时依赖，也不会随 Web、API 或 Docker Compose 部署。

## 采用的配置

- OpenCodex `2.7.30`，Node.js 要求为 `>=18`；本机使用 Node.js `24.16.0`。
- 仅监听 `127.0.0.1:10100`，不向局域网或公网开放。
- 使用 `openai` 的 `openai-responses` forward 模式，复用现有 `codex login` 凭据。
- 使用 `direct` 账号模式，始终沿用当前 Codex 调用方/主登录，不启用账号池切换。
- 不在配置文件保存 API Key。
- 关闭 Web Search 和 Vision sidecar，避免代理额外发起模型调用。
- 保持 HTTP/SSE，不启用 WebSocket。
- 不启用历史记录重映射；loopback 注入仍保持原生 `openai` provider 标识。
- 使用按需启动 shim：启动 `codex` 时执行 `ocx ensure`，不安装常驻 launchd 服务。

实际的用户级配置位于 `~/.opencodex/config.json`：

```json
{
  "port": 10100,
  "hostname": "127.0.0.1",
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "adapter": "openai-responses",
      "baseUrl": "https://chatgpt.com/backend-api/codex",
      "authMode": "forward",
      "codexAccountMode": "direct"
    }
  },
  "codexAutoStart": true,
  "syncResumeHistory": false,
  "multiAgentMode": "default",
  "websockets": false,
  "webSearchSidecar": {
    "enabled": false
  },
  "visionSidecar": {
    "enabled": false
  }
}
```

## 安装与启用

```bash
npm install -g --allow-scripts=bun @bitkyc08/opencodex
ocx codex-shim install
ocx start
```

OpenCodex 启动后会以可逆方式更新 `~/.codex/config.toml` 和模型目录。loopback 模式下，
核心注入是将 Codex 的 `openai_base_url` 指向 `http://127.0.0.1:10100/v1`。

## 验证

```bash
ocx --version
ocx status
ocx health --json
ocx codex-shim status
curl --fail --silent http://127.0.0.1:10100/healthz
```

需要验证真实路由时，可执行一个最小请求；该请求会使用当前 Codex 账号额度：

```bash
codex exec -m gpt-5.6-sol "只回复 OK"
```

## 日常操作与恢复

```bash
ocx gui                 # 打开本机管理界面
ocx models              # 查看代理发布的模型
ocx sync                # 重新同步模型及 Codex 配置
ocx stop                # 停止代理并恢复原生 Codex
ocx restore             # 代理继续运行，但恢复原生 Codex 配置
ocx restore back        # 重新把 Codex 指向运行中的代理
```

彻底卸载前必须先清理注入和用户级状态：

```bash
ocx uninstall
npm uninstall -g @bitkyc08/opencodex
```

## 安全边界

- 不要把 `~/.opencodex`、OAuth 凭据或真实 API Key 提交到本仓库。
- 不要把 `hostname` 改为 `0.0.0.0`；确需远程访问时，必须先配置
  `OPENCODEX_API_AUTH_TOKEN`、防火墙及可信网络边界。
- 新增第三方 provider 时使用 `${ENV_VAR}` 引用密钥，不要把密钥直接写入 JSON。
- OpenCodex 只影响开发机上的 Codex 请求路由，不改变 AI Gateway Studio 的正式技术架构和服务流量。
