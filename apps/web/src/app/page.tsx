import Link from 'next/link'

import { IntegrationGuide } from '../components/integration-guide'

const capabilities = [
  {
    name: 'Chat',
    label: '实时对话',
    description: '流式回答、模型切换与多路对比，在一次对话里看清差异。',
    href: '/chat',
    color: 'blue',
    icon: '⌁',
  },
  {
    name: 'Image',
    label: '文生图',
    description: '写下画面，选择模型，持续追踪从生成到下载的完整过程。',
    href: '/image',
    color: 'orange',
    icon: '◇',
  },
  {
    name: 'Prompt',
    label: '提示词优化',
    description: '扩写、精简或结构化，让一个模糊念头变成可执行指令。',
    href: '/prompt',
    color: 'cyan',
    icon: '✦',
  },
]

const providers = ['Qwen', 'GLM', 'DeepSeek']

function RouteMap() {
  return (
    <div className="route-console" aria-label="请求经过统一网关分发至多个模型的示意图">
      <div className="route-console-head">
        <div className="route-console-status">
          <span className="status-pulse" />
          Gateway online
        </div>
        <span>CN / EAST-1</span>
      </div>

      <div className="route-stage">
        <div className="route-source">
          <span className="route-node-label">YOUR REQUEST</span>
          <strong>说出你的想法</strong>
          <span className="route-source-caret" aria-hidden="true" />
        </div>

        <svg
          className="route-lines"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path className="route-path" d="M 41 20 H 50 V 32" />
          <path className="route-path" d="M 50 50 V 74 H 60" />
          <path className="route-path" d="M 60 62 V 86" />
          <path className="route-path" d="M 60 62 H 64" />
          <path className="route-path" d="M 60 74 H 64" />
          <path className="route-path" d="M 60 86 H 64" />
          <circle className="route-junction route-junction-violet" cx="41" cy="20" r="0.75" />
          <circle className="route-junction route-junction-mint" cx="64" cy="62" r="0.75" />
          <circle className="route-junction route-junction-coral" cx="64" cy="74" r="0.75" />
          <circle className="route-junction route-junction-violet" cx="64" cy="86" r="0.75" />
        </svg>

        <div className="route-gateway">
          <span className="gateway-mark">
            <b>AG</b>
          </span>
          <span>统一网关</span>
        </div>

        <div className="route-providers">
          {providers.map((provider, index) => (
            <div className="provider-chip" key={provider}>
              <span className={`provider-dot provider-dot-${index + 1}`} />
              <span>{provider}</span>
              <small>{index === 0 ? '12ms' : index === 1 ? '18ms' : '24ms'}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="route-console-foot">
        <span>统一协议</span>
        <span>流式响应</span>
        <span>费用可见</span>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-kicker">
            <span>AI 能力入口</span>
            <span className="home-kicker-line" />
            <span>稳定运行中</span>
          </p>
          <h1>
            一个入口，
            <br />
            <span>调动每一种</span> AI。
          </h1>
          <p className="home-intro">
            对话、图像与 Prompt
            优化都从这里开始。你只需要描述目标，底层模型、流式传输和费用记录交给网关处理。
          </p>

          <div className="home-actions">
            <Link href="/chat" className="home-primary-action">
              <span>开始对话</span>
              <span className="action-arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
            <a href="#integration" className="home-text-action">
              查看接入方式
              <span aria-hidden="true">↓</span>
            </a>
          </div>

          <div className="home-proof" aria-label="平台特点">
            <span>3 个文本模型</span>
            <span>2 个图像模型</span>
            <span>人民币费用估算</span>
          </div>
        </div>

        <div className="home-hero-visual">
          <RouteMap />
          <p className="route-caption">一次请求，从统一入口抵达合适的模型。</p>
        </div>
      </section>

      <IntegrationGuide />

      <section id="capabilities" className="capability-section">
        <div className="capability-heading">
          <p className="section-kicker">选择你的起点</p>
          <h2>把想法交给合适的能力。</h2>
          <p>三个入口共享同一套模型网关，每一个都为具体任务保留最顺手的交互。</p>
        </div>

        <div className="capability-grid">
          {capabilities.map((capability) => (
            <Link
              key={capability.name}
              href={capability.href}
              className={`home-capability home-capability-${capability.color}`}
            >
              <div className="capability-card-top">
                <span className="capability-icon" aria-hidden="true">
                  {capability.icon}
                </span>
                <span className="capability-link-arrow" aria-hidden="true">
                  ↗
                </span>
              </div>
              <div>
                <p className="capability-name">{capability.name}</p>
                <h3>{capability.label}</h3>
                <p className="capability-description">{capability.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-manifesto">
        <p>不必理解每一家模型。</p>
        <p>只需选择你想完成的事。</p>
        <Link href="/chat">
          现在开始 <span aria-hidden="true">→</span>
        </Link>
      </section>

      <aside className="open-source-notice" aria-labelledby="open-source-title">
        <div className="open-source-label">
          <span className="open-source-mark" aria-hidden="true">
            OS
          </span>
          <p>Open source notice</p>
        </div>
        <div className="open-source-copy">
          <h2 id="open-source-title">开源项目说明</h2>
          <p>
            本项目以开源形式提供，主要用于学习、演示与二次开发。项目不承诺持续维护、长期可用或服务稳定性；用于生产环境前，请自行完成安全、合规、容量与可用性评估，并承担相关风险。
          </p>
        </div>
      </aside>

      <footer className="home-footer">
        <span>AI Gateway Studio</span>
        <span>One interface. Many intelligences.</span>
      </footer>
    </main>
  )
}
