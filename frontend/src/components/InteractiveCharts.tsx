'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { CSSProperties, ComponentType } from 'react'

type EChartsProps = {
  option: any
  style?: CSSProperties
}

// ✅ Return the component itself from the loader (not the full module)
const ReactECharts = dynamic<EChartsProps>(
  () => import('./EChartsClient').then((m) => m.default as unknown as ComponentType<EChartsProps>),
  { ssr: false }
)

function safeNumber(x: unknown): number | null {
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

export default function InteractiveCharts({
  clusters,
  correlations,
  forecast,
}: {
  clusters?: Record<string, any>
  correlations?: Record<string, number>
  forecast?: Record<string, any>
}) {
  const segmentsOption = useMemo(() => {
    const rows = Object.entries(clusters || {})
      .filter(([, v]) => v && typeof v === 'object' && typeof (v as any).size === 'number')
      .map(([name, v]) => ({ name, value: Number((v as any).size || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)

    if (rows.length === 0) return null

    return {
      title: { text: 'Segments (by size)', left: 'center' },
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, type: 'scroll' },
      series: [
        {
          name: 'Segments',
          type: 'pie',
          radius: ['35%', '70%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
          labelLine: { show: false },
          data: rows,
        },
      ],
    }
  }, [clusters])

  const correlationsOption = useMemo(() => {
    const rows = Object.entries(correlations || {})
      .map(([k, v]) => ({ pair: k, corr: Number(v), abs: Math.abs(Number(v)) }))
      .filter((r) => Number.isFinite(r.corr))
      .sort((a, b) => b.abs - a.abs)
      .slice(0, 10)

    if (rows.length === 0) return null

    return {
      title: { text: 'Top correlations', left: 'center' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 12, right: 12, top: 50, bottom: 40, containLabel: true },
      xAxis: { type: 'value', min: -1, max: 1 },
      yAxis: {
        type: 'category',
        data: rows.map((r) => r.pair),
        axisLabel: { width: 220, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          data: rows.map((r) => r.corr),
          itemStyle: { color: (p: any) => (Number(p.value) >= 0 ? '#10b981' : '#ef4444') },
        },
      ],
    }
  }, [correlations])

  const forecastOption = useMemo(() => {
    const entries = Object.entries(forecast || {}).slice(0, 3)
    if (entries.length === 0) return null

    const series = entries
      .map(([metric, fcData]) => {
        const vals = Array.isArray((fcData as any)?.next_3_periods) ? (fcData as any).next_3_periods : []
       const y = vals
  .map((v: unknown) => safeNumber(v))
  .filter((v: number | null): v is number => v != null)


        if (y.length === 0) return null

        return { name: metric, type: 'line', smooth: true, symbolSize: 8, data: y }
      })
      .filter((s): s is NonNullable<typeof s> => Boolean(s))

    if (series.length === 0) return null

    return {
      title: { text: 'Forecast (next 3 periods)', left: 'center' },
      tooltip: { trigger: 'axis' },
      legend: { top: 28, type: 'scroll' },
      grid: { left: 12, right: 12, top: 70, bottom: 30, containLabel: true },
      xAxis: { type: 'category', data: ['P1', 'P2', 'P3'] },
      yAxis: { type: 'value' },
      series,
    }
  }, [forecast])

  if (!segmentsOption && !correlationsOption && !forecastOption) return null

  return (
    <div className="card p-5 border-l-4 border-teal-500 bg-gradient-to-r from-teal-50 to-emerald-50">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">📊 Interactive Charts</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {segmentsOption && (
          <div className="bg-white rounded-xl border border-teal-100 p-3">
            <ReactECharts option={segmentsOption} style={{ height: 320 }} />
          </div>
        )}

        {correlationsOption && (
          <div className="bg-white rounded-xl border border-teal-100 p-3">
            <ReactECharts option={correlationsOption} style={{ height: 320 }} />
          </div>
        )}

        {forecastOption && (
          <div className="bg-white rounded-xl border border-teal-100 p-3 lg:col-span-2">
            <ReactECharts option={forecastOption} style={{ height: 320 }} />
          </div>
        )}
      </div>
    </div>
  )
}
