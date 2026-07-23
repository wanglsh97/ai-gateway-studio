'use client'

import { createAIGatewayClient } from '@aigateway/sdk'
import type { AgentSkillMarketItem } from '@aigateway/sdk'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { ProtectedUserPage } from '../../components/protected-user-page'
import { useAuthenticationFailure } from '../../components/use-authentication-failure'
import { cn } from '../../lib/cn'

const client = createAIGatewayClient()

const presentation: Record<string, { mark: string; tone: string }> = {
  'deep-research': { mark: 'DR', tone: 'bg-brand-muted text-[#5a43c5]' },
  'code-explainer': { mark: '</>', tone: 'bg-[#dfeaf9] text-[#315f9e]' },
  'content-polish': { mark: 'Aa', tone: 'bg-[#fbe5df] text-[#b84d38]' },
}

export default function SkillsPage() {
  return (
    <ProtectedUserPage>
      <SkillMarket />
    </ProtectedUserPage>
  )
}

function SkillMarket() {
  const handleAuthenticationFailure = useAuthenticationFailure()
  const [skills, setSkills] = useState<AgentSkillMarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setSkills(await client.agent.skills.list())
    } catch (cause) {
      if (!handleAuthenticationFailure(cause)) {
        setError(cause instanceof Error ? cause.message : 'Skill 市场加载失败')
      }
    } finally {
      setLoading(false)
    }
  }, [handleAuthenticationFailure])

  useEffect(() => {
    void load()
  }, [load])

  async function mutate(skillId: string, action: () => Promise<AgentSkillMarketItem | void>) {
    if (pending.has(skillId)) return
    setPending((current) => new Set(current).add(skillId))
    setError('')
    try {
      const updated = await action()
      if (updated) {
        setSkills((current) => current.map((skill) => (skill.id === updated.id ? updated : skill)))
      } else {
        setSkills((current) =>
          current.map((skill) =>
            skill.id === skillId ? { ...skill, installed: false, enabled: false } : skill,
          ),
        )
      }
    } catch (cause) {
      if (!handleAuthenticationFailure(cause)) {
        setError(cause instanceof Error ? cause.message : 'Skill 状态更新失败')
      }
    } finally {
      setPending((current) => {
        const next = new Set(current)
        next.delete(skillId)
        return next
      })
    }
  }

  const installedCount = skills.filter((skill) => skill.installed).length

  return (
    <main className="mx-auto max-w-[72rem] px-5 py-12 md:px-14 md:py-24">
      <header className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[0.65rem] font-extrabold tracking-[0.16em] text-brand">
            AGENT SKILL MARKET
          </p>
          <h1 className="mt-3 text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-extrabold tracking-tight">
            技能市场
          </h1>
          <p className="mt-5 max-w-[42rem] text-[0.95rem] leading-relaxed text-ink-muted">
            安装平台审核的工作方法。已启用的技能会从下一次 Agent
            模型调用开始加载，但不会增加工具权限。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <span className="border-b border-line pb-2.5 text-xs text-ink-faint md:pl-10">
            <strong className="mr-1 text-2xl text-ink dark:text-white">{installedCount}</strong> /{' '}
            {skills.length} 已安装
          </span>
          <Link
            href="/skills/upload"
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover focus-visible:outline-3 focus-visible:outline-brand-focus focus-visible:outline-offset-3"
          >
            上传 Skill
          </Link>
        </div>
      </header>

      {error ? (
        <section
          role="alert"
          className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="font-semibold underline underline-offset-4"
          >
            重试
          </button>
        </section>
      ) : null}

      {loading ? (
        <section aria-busy="true" className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-80 animate-pulse rounded-[1.25rem] border border-line bg-surface-card/55"
            />
          ))}
        </section>
      ) : skills.length === 0 ? (
        <section className="mt-12 rounded-3xl border border-dashed border-line p-12 text-center text-sm text-ink-muted">
          当前没有已发布的 Skill。
        </section>
      ) : (
        <section
          className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Skill 市场列表"
        >
          {skills.map((skill) => {
            const style = presentation[skill.id] ?? {
              mark: 'AI',
              tone: 'bg-brand-muted text-[#5a43c5]',
            }
            const busy = pending.has(skill.id)
            return (
              <article
                key={skill.id}
                className="flex min-h-80 flex-col rounded-[1.25rem] border border-line bg-surface-card/72 p-5 shadow-[0_12px_30px_rgb(32_24_50/0.04)] dark:bg-white/[0.035] dark:shadow-none"
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    className={cn(
                      'grid size-[3.2rem] place-items-center rounded-2xl font-mono text-[0.72rem] font-black',
                      style.tone,
                    )}
                  >
                    {style.mark}
                  </div>
                  <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[0.58rem] text-ink-faint">
                    v{skill.version}
                  </span>
                </div>
                <div className="mt-8 flex-1">
                  <span className="font-mono text-[0.6rem] tracking-widest text-ink-subtle">
                    {skill.category}
                  </span>
                  <h2 className="mt-2 text-xl tracking-tight">{skill.name}</h2>
                  <p className="mt-3 text-[0.82rem] leading-relaxed text-ink-muted">
                    {skill.description}
                  </p>
                  {skill.allowedTools.length > 0 ? (
                    <p className="mt-4 text-[0.68rem] text-ink-faint">
                      可配合：{skill.allowedTools.join('、')}
                    </p>
                  ) : null}
                </div>

                <div className="mt-7 border-t border-line pt-4">
                  {!skill.installed ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void mutate(skill.id, () => client.agent.skills.install(skill.id))
                      }
                      className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50"
                    >
                      {busy ? '安装中…' : '安装 Skill'}
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={skill.enabled}
                        disabled={busy}
                        onClick={() =>
                          void mutate(skill.id, () =>
                            client.agent.skills.update(skill.id, { enabled: !skill.enabled }),
                          )
                        }
                        className={cn(
                          'rounded-full px-3 py-2 text-xs font-semibold disabled:cursor-wait disabled:opacity-50',
                          skill.enabled
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200'
                            : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
                        )}
                      >
                        {skill.enabled ? '已启用' : '已停用'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void mutate(skill.id, () => client.agent.skills.uninstall(skill.id))
                        }
                        className="px-2 py-2 text-xs font-semibold text-ink-faint hover:text-rose-600 disabled:cursor-wait disabled:opacity-50"
                      >
                        卸载
                      </button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
