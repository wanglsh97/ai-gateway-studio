'use client'

import { useState } from 'react'

const curlExample = `curl -N 'http://localhost:3000/api/v1/chat/completions' \\
  -H 'Accept: text/event-stream' \\
  -H 'Content-Type: application/json' \\
  -H 'Cookie: aigateway_user_session=<SESSION_COOKIE>' \\
  --data-raw '{
    "model": "qwen",
    "messages": [
      { "role": "user", "content": "解释什么是统一模型网关" }
    ],
    "stream": true,
    "maxTokens": 512
  }'`

const sdkExample = `import { createAIGatewayClient } from '@aigateway/sdk'

const gateway = createAIGatewayClient()

const events = gateway.chat.stream({
  model: 'qwen',
  messages: [
    { role: 'user', content: '解释什么是统一模型网关' },
  ],
  stream: true,
  maxTokens: 512,
})

for await (const event of events) {
  if (event.type === 'delta') console.log(event.content)
  if (event.type === 'usage') console.log(event.usage)
}`

interface GuidePanelProps {
  code: string
  command: string
  description: string
  index: string
  language: string
  title: string
}

function GuidePanel({ code, command, description, index, language, title }: GuidePanelProps) {
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <article className="integration-panel">
      <div className="integration-panel-heading">
        <span className="integration-index">{index}</span>
        <div>
          <p>{language}</p>
          <h3>{title}</h3>
        </div>
      </div>
      <p className="integration-description">{description}</p>
      <div className="integration-code">
        <div className="integration-code-head">
          <span>{command}</span>
          <button type="button" onClick={() => void copyCode()}>
            {copied ? '已复制' : '复制代码'}
          </button>
        </div>
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    </article>
  )
}

export function IntegrationGuide() {
  return (
    <section className="integration-section" id="integration">
      <div className="integration-heading">
        <p className="section-kicker">从体验到接入</p>
        <h2>
          用你熟悉的方式，
          <br />
          发出第一条请求。
        </h2>
        <div className="integration-note">
          <span>AUTH</span>
          <p>Chat、文生图和 Prompt 优化均需要 GitHub 登录。下方示例使用同一个用户会话。</p>
        </div>
      </div>

      <div className="integration-grid">
        <GuidePanel
          index="HTTP"
          language="Terminal / cURL"
          title="直接调用流式接口"
          description="适合调试协议或从任意服务端接入。-N 会关闭 cURL 缓冲，让 SSE 内容逐段显示。"
          command="POST /api/v1/chat/completions"
          code={curlExample}
        />
        <GuidePanel
          index="SDK"
          language="TypeScript"
          title="通过统一 SDK 调用"
          description="适合仓库内的 Web 应用。SDK 负责解析 SSE、校验 [DONE]，并返回带类型的事件。"
          command="@aigateway/sdk · workspace"
          code={sdkExample}
        />
      </div>

      <div className="integration-footnote">
        <p>
          <span>01</span> 先完成 GitHub 登录，浏览器调用会自动携带 HttpOnly Session Cookie。
        </p>
        <p>
          <span>02</span> 服务端调用请安全传递会话 Cookie；不要把 Cookie、模型 Key 写入前端代码。
        </p>
        <a href="/api/docs">
          查看完整 API 文档 <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  )
}
