'use client'

import type { ECharts, EChartsOption } from 'echarts'
import { useEffect, useRef } from 'react'

export function DashboardChart({ option, label }: { option: EChartsOption; label: string }) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let disposed = false
    let chart: ECharts | undefined
    let observer: ResizeObserver | undefined
    void import('echarts').then((echarts) => {
      if (disposed || !container.current) return
      chart = echarts.init(container.current)
      chart.setOption(option)
      observer = new ResizeObserver(() => chart?.resize())
      observer.observe(container.current)
    })
    return () => {
      disposed = true
      observer?.disconnect()
      chart?.dispose()
    }
  }, [option])

  return <div ref={container} className="h-72 w-full" role="img" aria-label={label} />
}
