'use client'

import { useState } from 'react'

type FileInfo = {
  rows: number
  columns: number
  numeric_columns: string[]
}

type ColumnStats = {
  mean: number
  median: number
  std: number
  min: number
  max: number
  missing: number
}

type ClusterData = {
  size: number
  pct: string
  avg_metrics: Record<string, number>
}

type AnomalyData = {
  total_count: number
  pct: string
  top_3_anomalies: Record<string, number>[]
}

type ForecastData = {
  next_3_periods: number[]
  slope: number
}

export type PythonAnalysis = {
  success: boolean
  execution_id: string
  file_info: FileInfo
  statistics: Record<string, ColumnStats>
  correlations: Record<string, number>
  trends: Record<string, string>
  outliers: Record<string, number>
  clusters: Record<string, ClusterData>
  anomalies: AnomalyData
  forecast: Record<string, ForecastData>
  insights: string[]
  summary: string
  error?: string
}

export default function DataAnalysisResult({
  analysis,
  raw,
}: {
  analysis: PythonAnalysis
  raw?: any
}) {
  // ===== INTERACTIVE STATE =====
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null)
  const [hoveredAnomaly, setHoveredAnomaly] = useState<number | null>(null)
  const [showAllMetrics, setShowAllMetrics] = useState(false)

  // ===== EXPORT FUNCTION =====
  const handleExportCSV = () => {
    let csv = 'Data Analysis Insights\n\n'
    csv += `Execution ID,${analysis.execution_id}\n`
    csv += `Total Rows,${analysis.file_info?.rows}\n`
    csv += `Numeric Columns,${analysis.file_info?.numeric_columns?.length}\n`
    csv += `Anomalies Detected,${analysis.anomalies?.total_count}\n\n`
    
    if (analysis.clusters && Object.keys(analysis.clusters).length > 0) {
      csv += 'Customer Segments\n'
      Object.entries(analysis.clusters).forEach(([seg, data]: [string, any]) => {
        csv += `${seg},${data.size} records (${data.pct})\n`
      })
      csv += '\n'
    }

    if (analysis.forecast && Object.keys(analysis.forecast).length > 0) {
      csv += 'Forecasts\n'
      Object.entries(analysis.forecast).forEach(([col, fcData]: [string, any]) => {
        csv += `${col},${fcData.next_3_periods.join(' → ')}\n`
      })
    }

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis-${Date.now()}.csv`
    a.click()
  }

  return (
    <div className="space-y-4">
      {/* ===== TOP KPIs (Animated) ===== */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card px-4 py-3 hover:shadow-lg transition-shadow duration-300">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Total rows
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-800 animate-pulse">
            {analysis.file_info?.rows?.toLocaleString() || 0}
          </p>
        </div>

        <div className="card px-4 py-3 hover:shadow-lg transition-shadow duration-300">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Numeric columns
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {analysis.file_info?.numeric_columns?.length || 0}
          </p>
        </div>

        <div className="card px-4 py-3 hover:shadow-lg transition-shadow duration-300 bg-gradient-to-br from-blue-50 to-blue-100">
          <p className="text-[11px] uppercase tracking-wide text-blue-600 font-bold">
            Data segments found
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-700">
            {Object.keys(analysis.clusters || {}).length}
          </p>
        </div>

        <div className="card px-4 py-3 hover:shadow-lg transition-shadow duration-300 bg-gradient-to-br from-rose-50 to-rose-100">
          <p className="text-[11px] uppercase tracking-wide text-rose-600 font-bold">
            Anomalies detected
          </p>
          <p className="mt-1 text-2xl font-bold text-rose-700">
            {analysis.anomalies?.total_count || 0}
          </p>
        </div>
      </div>

      {/* ===== EXPORT BUTTON ===== */}
      <button
        onClick={handleExportCSV}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center justify-center gap-2"
      >
        📥 Export Analysis as CSV
      </button>

      {/* ===== EXECUTIVE SUMMARY ===== */}
      <div className="card p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-500">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">🎯 Executive Summary</h2>
        <p className="text-sm text-slate-700 mb-2 font-medium">
          {analysis.summary}
        </p>
        <p className="text-xs text-slate-500">
          Execution ID: {analysis.execution_id}
        </p>
      </div>

      {/* ===== INTERACTIVE CLUSTERS ===== */}
      {analysis.clusters && Object.keys(analysis.clusters).length > 0 && (
        <div className="card p-5 border-l-4 border-blue-500">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">🎯 Customer Segments (KMeans) - Click to expand</h2>
          <div className="space-y-3">
            {Object.entries(analysis.clusters).map(([segName, segData]: [string, any]) => {
              if (segData.error) return null
              const isExpanded = expandedSegment === segName
              return (
                <div
                  key={segName}
                  onClick={() => setExpandedSegment(isExpanded ? null : segName)}
                  className="bg-blue-50 p-4 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors border-l-4 border-blue-400"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">{segName}</h3>
                      <p className="text-xs text-slate-600 mt-1">
                        {segData.size} records • {segData.pct} of total
                      </p>
                    </div>
                    <div className="text-2xl">{isExpanded ? '▼' : '▶'}</div>
                  </div>

                  {/* Expanded view */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-blue-200 grid grid-cols-2 gap-3">
                      {Object.entries(segData.avg_metrics).map(([metric, value]: [string, any]) => (
                        <div key={metric} className="bg-white p-3 rounded border border-blue-200">
                          <p className="text-xs text-slate-500 font-medium">{metric}</p>
                          <p className="text-sm font-bold text-blue-600 mt-1">
                            {typeof value === 'number' ? value.toFixed(2) : value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Collapsed view */}
                  {!isExpanded && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {Object.entries(segData.avg_metrics)
                        .slice(0, 3)
                        .map(([metric, value]: [string, any]) => (
                          <span key={metric} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {metric}: {typeof value === 'number' ? value.toFixed(1) : value}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== INTERACTIVE ANOMALIES ===== */}
      {analysis.anomalies && analysis.anomalies.total_count > 0 && (
        <div className="card p-5 border-l-4 border-rose-500">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">⚠️ Anomalies Detected (Isolation Forest)</h2>
          <p className="text-sm text-rose-700 mb-4">
            Found <span className="font-bold text-lg">{analysis.anomalies.total_count}</span> outliers ({analysis.anomalies.pct}) - <span className="text-xs text-rose-600">potential fraud/errors</span>
          </p>
          {analysis.anomalies.top_3_anomalies && (
            <div className="space-y-2">
              {analysis.anomalies.top_3_anomalies.map((row, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredAnomaly(idx)}
                  onMouseLeave={() => setHoveredAnomaly(null)}
                  className={`p-3 rounded-lg text-xs transition-all transform ${
                    hoveredAnomaly === idx
                      ? 'bg-rose-200 border-2 border-rose-500 scale-105 shadow-lg'
                      : 'bg-rose-50 border border-rose-200'
                  }`}
                >
                  <span className="font-bold text-rose-700">Row {idx + 1}:</span>
                  <span className="text-slate-700 ml-2">
                    {Object.entries(row)
                      .slice(0, 2)
                      .map(([k, v]: [string, any]) => `${k}=${typeof v === 'number' ? v.toFixed(0) : v}`)
                      .join(' | ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== ANIMATED FORECAST ===== */}
      {analysis.forecast && Object.keys(analysis.forecast).length > 0 && (
        <div className="card p-5 border-l-4 border-purple-500">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">📈 Forecast (Next 3 Periods)</h2>
          <div className="space-y-4">
            {Object.entries(analysis.forecast)
              .slice(0, 3)
              .map(([col, fcData]: [string, any]) => {
                const trend = fcData.slope > 0 ? '📈' : '📉'
                const maxVal = Math.max(...fcData.next_3_periods)
                const minVal = Math.min(...fcData.next_3_periods)
                const range = maxVal - minVal || 1

                return (
                  <div key={col} className="bg-purple-50 p-4 rounded-lg">
                    <p className="font-bold text-slate-800 mb-3">
                      {trend} {col}
                    </p>
                    <div className="flex items-end gap-2 h-24">
                      {fcData.next_3_periods.map((val: number, idx: number) => {
                        const normalizedHeight = ((val - minVal) / range) * 80 + 20
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center">
                            <div
                              className="w-full bg-gradient-to-t from-purple-500 to-purple-300 rounded-t transition-all duration-500 hover:from-purple-600 hover:to-purple-400"
                              style={{ height: `${normalizedHeight}px` }}
                              title={`Period ${idx + 1}: ${val.toFixed(0)}`}
                            />
                            <p className="text-xs text-slate-600 mt-1 font-medium">{val.toFixed(0)}</p>
                            <p className="text-xs text-slate-400">P{idx + 1}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ===== TRENDS ===== */}
      {analysis.trends && Object.keys(analysis.trends).length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">📊 Trends</h2>
          <ul className="text-xs text-slate-700 space-y-2">
            {Object.entries(analysis.trends).map(([col, value]) => {
              const isPositive = String(value).trim().startsWith('+')
              const colorClass = isPositive ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
              return (
                <li key={col} className={`flex justify-between p-2 rounded ${colorClass}`}>
                  <span className="font-medium">{col}:</span>
                  <span className="font-bold">{value}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ===== CORRELATION HEATMAP (COLOR CODED) ===== */}
      {analysis.correlations && Object.keys(analysis.correlations).length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">🔗 Strong Correlations</h2>
          <div className="space-y-2">
            {Object.entries(analysis.correlations).map(([pair, corr]) => {
              const corrValue = corr as number
              const absCorr = Math.abs(corrValue)
              let bgColor = 'bg-slate-100'
              if (absCorr > 0.8) bgColor = 'bg-green-200'
              else if (absCorr > 0.6) bgColor = 'bg-emerald-100'
              else if (absCorr > 0.5) bgColor = 'bg-yellow-100'

              return (
                <div key={pair} className={`p-3 rounded-lg ${bgColor}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-700">{pair}</span>
                    <span className={`font-bold text-lg ${absCorr > 0.7 ? 'text-green-700' : 'text-slate-600'}`}>
                      {corrValue.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1 rounded-full mt-2">
                    <div className="bg-green-500 h-1 rounded-full transition-all" style={{ width: `${absCorr * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== STATISTICS TABLE ===== */}
      {analysis.statistics && Object.keys(analysis.statistics).length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">📋 Key Statistics</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-slate-100 to-slate-200">
                  <th className="border px-2 py-2 text-left font-bold">Column</th>
                  <th className="border px-2 py-2 text-right font-bold">Mean</th>
                  <th className="border px-2 py-2 text-right font-bold">Median</th>
                  <th className="border px-2 py-2 text-right font-bold">Min</th>
                  <th className="border px-2 py-2 text-right font-bold">Max</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(analysis.statistics).map(([col, s]) => (
                  <tr key={col} className="odd:bg-white even:bg-slate-50 border-b hover:bg-slate-100 transition-colors">
                    <td className="border px-2 py-2 font-medium text-slate-800">{col}</td>
                    <td className="border px-2 py-2 text-right">{(s.mean as number).toFixed(2)}</td>
                    <td className="border px-2 py-2 text-right">{(s.median as number).toFixed(2)}</td>
                    <td className="border px-2 py-2 text-right font-semibold text-rose-600">{(s.min as number).toFixed(2)}</td>
                    <td className="border px-2 py-2 text-right font-semibold text-emerald-600">{(s.max as number).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== INSIGHTS ===== */}
      {analysis.insights && analysis.insights.length > 0 && (
        <div className="card p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-500">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">💡 Key Insights</h2>
          <ul className="space-y-2">
            {analysis.insights.map((line, idx) => (
              <li key={idx} className="flex gap-2 text-xs text-slate-700">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ===== DEBUG (DEV ONLY) ===== */}
      {process.env.NODE_ENV !== 'production' && raw && (
        <div className="card p-3 bg-slate-100">
          <p className="text-xs text-slate-600 mb-2 font-semibold">Raw response (dev only):</p>
          <pre className="text-xs bg-slate-900 text-green-400 p-3 rounded overflow-auto max-h-48 font-mono">
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
