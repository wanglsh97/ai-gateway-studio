const skills = [
  { name: '深度研究', description: '拆解复杂问题，整理信息并形成结构化研究结论。', category: '研究', mark: 'DR', tone: 'violet' },
  { name: '代码解释', description: '阅读代码上下文，用清晰语言说明逻辑、依赖与风险。', category: '开发', mark: '</>', tone: 'blue' },
  { name: '内容润色', description: '调整表达、语气与结构，同时保留原始信息和意图。', category: '写作', mark: 'Aa', tone: 'coral' },
]

export default function SkillsPage() {
  return (
    <main className="skills-page">
      <header className="skills-heading">
        <div>
          <p className="skills-eyebrow">INSTALLED CAPABILITIES</p>
          <h1>已安装技能</h1>
          <p>技能为 AI 增加专门的工作方法。当前页面展示界面预览，服务端接入将在后续开放。</p>
        </div>
        <span className="skills-count"><strong>{skills.length}</strong> 项可用</span>
      </header>

      <section className="skills-notice" aria-label="功能状态">
        <span className="skills-notice-dot" />
        <div><strong>展示模式</strong><p>技能暂时不会发起服务端请求，你可以先浏览已安装能力。</p></div>
      </section>

      <section className="skills-grid" aria-label="已安装技能列表">
        {skills.map((skill) => (
          <article key={skill.name} className="skill-card">
            <div className={`skill-mark skill-mark-${skill.tone}`}>{skill.mark}</div>
            <div className="skill-card-copy">
              <span>{skill.category}</span>
              <h2>{skill.name}</h2>
              <p>{skill.description}</p>
            </div>
            <div className="skill-card-status"><span /> 已安装</div>
          </article>
        ))}
      </section>
    </main>
  )
}
