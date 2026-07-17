'use client'

import type { EChartsOption } from 'echarts'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { DashboardChart } from '../../../components/admin/dashboard-chart'
import { loadDashboard } from '../../../lib/admin-dashboard-data'
import type {
  DashboardData,
  DashboardLatencies,
  DashboardSection,
  DashboardTrends,
} from '../../../lib/admin-dashboard-data'

export default function AdminHomePage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    let active = true
    void loadDashboard().then((loaded) => {
      if (!active) return
      if (
        Object.values(loaded).some((section) => section.status === 'error' && section.unauthorized)
      ) {
        router.replace('/admin/login')
        return
      }
      setData(loaded)
    })
    return () => {
      active = false
    }
  }, [router])

  if (!data) return <DashboardLoading />

  const overview = data.overview.status === 'success' ? data.overview.data : null
  return (
    <main className="space-y-6">
      <header>
        <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
          DASHBOARD
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">运行概览</h1>
      </header>

      {data.overview.status === 'error' ? (
        <SectionError section={data.overview} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="今日请求" value={String(overview?.requestCount ?? 0)} />
          <Metric
            label="成功率"
            value={
              overview?.successRate === null
                ? '暂无数据'
                : `${((overview?.successRate ?? 0) * 100).toFixed(1)}%`
            }
          />
          <Metric label="预估费用" value={`¥${overview?.estimatedCostCny ?? '0.00000000'}`} />
          <Metric
            label="健康模型"
            value={`${overview?.health.filter(({ status }) => status === 'healthy').length ?? 0}/${overview?.health.length ?? 0}`}
          />
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="24 小时请求趋势">
          {data.trends.status === 'error' ? (
            <SectionError section={data.trends} />
          ) : data.trends.data.buckets.every(({ requests }) => requests === 0) ? (
            <Empty />
          ) : (
            <DashboardChart
              label="24 小时请求趋势图"
              option={trendOption(data.trends.data.buckets)}
            />
          )}
        </Panel>
        <Panel title="模型延迟">
          {data.latencies.status === 'error' ? (
            <SectionError section={data.latencies} />
          ) : data.latencies.data.length === 0 ? (
            <Empty />
          ) : (
            <DashboardChart label="模型平均延迟图" option={latencyOption(data.latencies.data)} />
          )}
        </Panel>
      </section>

      <Panel title="最近错误">
        {data.errors.status === 'error' ? (
          <SectionError section={data.errors} />
        ) : data.errors.data.length === 0 ? (
          <Empty />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {data.errors.data.map((error) => (
              <article
                key={error.requestId}
                className="grid gap-1 py-3 text-sm sm:grid-cols-[10rem_1fr_auto]"
              >
                <span className="font-mono text-xs text-slate-500">{error.requestId}</span>
                <span>
                  {error.errorCode ?? 'UNKNOWN'} · {error.errorMessage ?? '未知错误'}
                </span>
                <span className="text-xs text-slate-400">{error.modelAlias}</span>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function SectionError({
  section,
}: {
  section: Extract<DashboardSection<unknown>, { status: 'error' }>
}) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
    >
      {section.message}
    </p>
  )
}

function Empty() {
  return <p className="grid h-48 place-items-center text-sm text-slate-400">暂无数据</p>
}
function DashboardLoading() {
  return (
    <main aria-busy="true" className="space-y-4">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-white/10"
          />
        ))}
      </div>
    </main>
  )
}

function trendOption(buckets: DashboardTrends['buckets']): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['请求', '成功', '失败'] },
    xAxis: {
      type: 'category',
      data: buckets.map(({ start }) =>
        new Date(start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      ),
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: '请求', type: 'line', smooth: true, data: buckets.map(({ requests }) => requests) },
      { name: '成功', type: 'line', smooth: true, data: buckets.map(({ succeeded }) => succeeded) },
      { name: '失败', type: 'line', smooth: true, data: buckets.map(({ failed }) => failed) },
    ],
  }
}

function latencyOption(rows: DashboardLatencies): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['总耗时', 'TTFB'] },
    xAxis: { type: 'category', data: rows.map(({ model }) => model) },
    yAxis: { type: 'value', name: 'ms' },
    series: [
      { name: '总耗时', type: 'bar', data: rows.map(({ averageDurationMs }) => averageDurationMs) },
      { name: 'TTFB', type: 'bar', data: rows.map(({ averageTtfbMs }) => averageTtfbMs) },
    ],
  }
}
