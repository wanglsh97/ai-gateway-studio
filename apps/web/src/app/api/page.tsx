'use client'

import { useState } from 'react'

type ExampleKind = 'sdk' | 'curl'

const examples: Record<ExampleKind, { label: string; meta: string; code: string }> = {
  sdk: {
    label: 'TypeScript SDK',
    meta: '@aigateway/sdk',
    code: `import { createAIGatewayClient } from '@aigateway/sdk'

const gateway = createAIGatewayClient()

for await (const event of gateway.chat.stream({
  model: 'qwen',
  messages: [
    { role: 'user', content: '解释什么是统一模型网关' },
  ],
  stream: true,
  maxTokens: 512,
})) {
  if (event.type === 'delta') process.stdout.write(event.content)
  if (event.type === 'usage') console.log(event.usage)
}`,
  },
  curl: {
    label: 'cURL',
    meta: 'POST · SSE',
    code: `curl -N '/api/v1/chat/completions' \\
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
  }'`,
  },
}

const endpoints = [
  { method: 'POST', path: '/api/v1/chat/completions', name: '流式对话', detail: 'SSE · 以 data: [DONE] 结束' },
  { method: 'POST', path: '/api/v1/images/generations', name: '创建图片任务', detail: 'JSON · 返回平台 taskId' },
  { method: 'GET', path: '/api/v1/images/generations/:taskId', name: '查询图片任务', detail: 'JSON · 支持轮询终态' },
  { method: 'POST', path: '/api/v1/prompts/optimize', name: '优化 Prompt', detail: 'JSON · expand / simplify / structure' },
  { method: 'GET', path: '/api/v1/models', name: '模型列表', detail: 'JSON · 别名、能力与健康状态' },
]

export default function ApiPage() {
  const [kind, setKind] = useState<ExampleKind>('sdk')
  const [copied, setCopied] = useState(false)
  const example = examples[kind]

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(example.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="api-page">
      <header className="api-heading">
        <p className="api-eyebrow">GATEWAY INTERFACE</p>
        <h1>接入网关，<br />只选一种方式。</h1>
        <p>使用仓库内的类型安全 SDK，或直接通过 HTTP 调用同一套网关能力。</p>
      </header>

      <section className="api-workbench" aria-label="调用示例">
        <div className="api-workbench-intro">
          <span className="api-step">01</span>
          <h2>发送第一条请求</h2>
          <p>Chat 强制使用流式响应。SDK 负责解析 SSE 和终止标记；cURL 使用 <code>-N</code> 关闭输出缓冲。</p>
          <div className="api-auth-note"><strong>认证</strong><span>付费能力需要 GitHub 用户 Session。浏览器会自动携带 HttpOnly Cookie。</span></div>
        </div>

        <div className="api-example">
          <div className="api-tabs" role="tablist" aria-label="接入方式">
            {(Object.keys(examples) as ExampleKind[]).map((value) => (
              <button key={value} type="button" role="tab" aria-selected={kind === value} onClick={() => { setKind(value); setCopied(false) }}>
                <span>{examples[value].label}</span><small>{examples[value].meta}</small>
              </button>
            ))}
          </div>
          <div className="api-code-panel">
            <div className="api-code-head"><span>{example.meta}</span><button type="button" onClick={() => void copyExample()}>{copied ? '已复制' : '复制代码'}</button></div>
            <pre><code>{example.code}</code></pre>
          </div>
        </div>
      </section>

      <section className="api-reference" aria-labelledby="api-reference-title">
        <div className="api-reference-title"><span className="api-step">02</span><div><h2 id="api-reference-title">能力端点</h2><p>所有浏览器请求始终使用同源 <code>/api</code>。</p></div></div>
        <div className="api-endpoints">
          {endpoints.map((endpoint) => (
            <article key={`${endpoint.method}-${endpoint.path}`}>
              <span className={`api-method api-method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
              <code>{endpoint.path}</code>
              <div><strong>{endpoint.name}</strong><small>{endpoint.detail}</small></div>
            </article>
          ))}
        </div>
        <a className="api-docs-link" href="/api/docs">打开 Swagger API 文档 <span aria-hidden="true">↗</span></a>
      </section>
    </main>
  )
}
