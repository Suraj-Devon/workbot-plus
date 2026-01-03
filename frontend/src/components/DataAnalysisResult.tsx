'use client'

import { useState } from 'react'
import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'
import InteractiveCharts from './InteractiveCharts'
import type { GeoPoint } from './GeoMap'

// ✅ typed dynamic import so <GeoMap points={...} /> has correct props
const GeoMap = dynamic(() => import('./GeoMap'), { ssr: false }) as unknown as ComponentType<{
  points: GeoPoint[]
}>

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

type DataQuality = {
  overall_score: number
  completeness: number
  numeric_columns: number
  missing_values: number
}

type Recommendation = {
  priority: string
  action: string
  reason: string
  impact: string
}

type TimeAnalysis = {
  enabled: boolean
  datetime_col?: string
  target_metric?: string
  grain?: string
  last_period_value?: number
  prev_period_value?: number
  delta?: number
  delta_pct?: number | null
  periods?: number
  latest_period?: string
  reason?: string
}

type Sampling = {
  applied: boolean
  method?: string
  original_rows?: number
  rows_used?: number
  note?: string
}

type GeoInfo = {
  detected: boolean
  lat_col?: string
  lon_col?: string
  points_sample?: GeoPoint[]
  reason?: string
}

export type PythonAnalysis = {
  success: boolean
  execution_id: string
  file_encoding: string
  file_info: FileInfo
  data_quality: DataQuality
  statistics: Record<string, ColumnStats>
  correlations: Record<string, number>
  trends: Record<string, string>
  outliers: Record<string, number>
  clusters: Record<string, any>
  anomalies: any
  forecast: Record<string, any>
  ai_insights: string[]
  recommendations: Recommendation[]
  insights: string[]
  summary: string
  error?: string

  time_analysis?: TimeAnalysis
  sampling?: Sampling
  run_notes?: string[]

  geo?: GeoInfo
}

export default function DataAnalysisResult({
  analysis,
  raw,
}: {
  analysis: PythonAnalysis
  raw?: any
}) {
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null)
  const [hoveredAnomaly, setHoveredAnomaly] = useState<number | null>(null)
  const [selectedInsight, setSelectedInsight] = useState<number | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [showRunNotes, setShowRunNotes] = useState(false)

  const timeEnabled = !!analysis.time_analysis?.enabled

  const geoPoints = (analysis.geo?.points_sample || []).slice(0, 1000)
  const geoEnabled = !!analysis.geo?.detected && geoPoints.length > 0

  // ===== EXPORT AS HTML (No jsPDF!) =====
  const handleExportHTML = () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Data Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
    h2 { color: #0369a1; margin-top: 30px; }
    .score-box { background: #eff6ff; border-left: 4px solid #0369a1; padding: 15px; margin: 15px 0; }
    .insight { background: #faf5ff; border-left: 4px solid #a855f7; padding: 12px; margin: 10px 0; }
    .recommendation { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 10px 0; }
    .high { color: #991b1b; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f3f4f6; font-weight: bold; }
    .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; color: #666; }
    .note { background: #f8fafc; border-left: 4px solid #64748b; padding: 10px; margin: 10px 0; font-size: 12px; color: #334155; }
  </style>
</head>
<body>
  <h1>📊 Data Analysis Report</h1>
  
  <div class="score-box">
    <h2>Data Quality Score</h2>
    <p><strong>${analysis.data_quality?.overall_score || 0}%</strong> Overall Health</p>
    <p>Completeness: ${analysis.data_quality?.completeness || 0}% | Missing Values: ${
      analysis.data_quality?.missing_values || 0
    }</p>
  </div>

  ${
    analysis.time_analysis?.enabled
      ? `
  <div class="note">
    <strong>Time Analysis:</strong> ${analysis.time_analysis.target_metric} vs previous ${analysis.time_analysis.grain} period:
    ${analysis.time_analysis.delta_pct != null ? `${analysis.time_analysis.delta_pct}%` : ''}
  </div>
  `
      : ''
  }

  ${
    analysis.sampling?.applied
      ? `
  <div class="note">
    <strong>Sampling:</strong> ${analysis.sampling.note || 'Sampling applied for performance.'}
  </div>
  `
      : ''
  }

  <h2>Executive Summary</h2>
  <p>${analysis.summary}</p>
  
  ${
    analysis.ai_insights && analysis.ai_insights.length > 0
      ? `
  <h2>🤖 AI Insights</h2>
  ${analysis.ai_insights.map((insight) => `<div class="insight">${insight}</div>`).join('')}
  `
      : ''
  }
  
  ${
    analysis.recommendations && analysis.recommendations.length > 0
      ? `
  <h2>✅ Recommendations</h2>
  ${analysis.recommendations
    .map(
      (rec) => `
  <div class="recommendation">
    <strong class="${rec.priority === 'HIGH' ? 'high' : ''}">[${rec.priority}] ${rec.action}</strong><br/>
    Reason: ${rec.reason}<br/>
    Impact: ${rec.impact}
  </div>
  `
    )
    .join('')}
  `
      : ''
  }
  
  <h2>Key Metrics</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Rows</td><td>${analysis.file_info?.rows?.toLocaleString() || 0}</td></tr>
    <tr><td>Numeric Columns</td><td>${analysis.file_info?.numeric_columns?.length || 0}</td></tr>
    <tr><td>Segments Found</td><td>${Object.keys(analysis.clusters || {}).length}</td></tr>
    <tr><td>Anomalies</td><td>${analysis.anomalies?.total_count || 0}</td></tr>
  </table>
  
  <div class="footer">
    <p>Generated on ${new Date().toLocaleString()}</p>
    <p>Execution ID: ${analysis.execution_id}</p>
  </div>
</body>
</html>
    `

    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis-${Date.now()}.html`
    a.click()
  }

  // ===== EXPORT CSV =====
  const handleExportCSV = () => {
    let csv = 'Data Analysis Report\n\n'
    csv += `Execution ID,${analysis.execution_id}\n`
    csv += `Data Quality,${analysis.data_quality?.overall_score}%\n`
    csv += `Total Rows,${analysis.file_info?.rows}\n\n`

    if (analysis.time_analysis?.enabled) {
      csv += 'Time Analysis\n'
      csv += `Datetime Column,${analysis.time_analysis.datetime_col || ''}\n`
      csv += `Target Metric,${analysis.time_analysis.target_metric || ''}\n`
      csv += `Grain,${analysis.time_analysis.grain || ''}\n`
      csv += `Delta,${analysis.time_analysis.delta ?? ''}\n`
      csv += `Delta %,${analysis.time_analysis.delta_pct ?? ''}\n\n`
    }

    if (analysis.sampling?.applied) {
      csv += 'Sampling\n'
      csv += `Applied,Yes\n`
      csv += `Original Rows,${analysis.sampling.original_rows ?? ''}\n`
      csv += `Rows Used,${analysis.sampling.rows_used ?? ''}\n`
      csv += `Note,"${analysis.sampling.note || ''}"\n\n`
    }

    if (analysis.ai_insights && analysis.ai_insights.length > 0) {
      csv += 'Key Insights\n'
      analysis.ai_insights.forEach((insight: string) => {
        csv += `"${insight}"\n`
      })
      csv += '\n'
    }

    if (analysis.recommendations && analysis.recommendations.length > 0) {
      csv += 'Recommendations\nPriority,Action,Reason,Impact\n'
      analysis.recommendations.forEach((rec: Recommendation) => {
        csv += `"${rec.priority}","${rec.action}","${rec.reason}","${rec.impact}"\n`
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
      {/* ===== DATA QUALITY GAUGE ===== */}
      {analysis.data_quality && (
        <div className="card p-8 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300">
          <h2 className="text-lg font-bold text-slate-900 mb-6">
            📊 Data Health Score
          </h2>

          <div className="flex items-center justify-between">
            <div className="w-32 h-32 rounded-full border-8 border-blue-200 flex items-center justify-center bg-white shadow-lg">
              <div className="text-center">
                <p className="text-4xl font-bold text-blue-600">
                  {analysis.data_quality.overall_score.toFixed(0)}
                </p>
                <p className="text-xs text-slate-600">out of 100</p>
              </div>
            </div>

            <div className="flex-1 ml-8 space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">
                    Completeness
                  </p>
                  <p className="text-sm font-bold text-blue-600">
                    {analysis.data_quality.completeness.toFixed(1)}%
                  </p>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${analysis.data_quality.completeness}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white p-3 rounded border border-blue-200">
                  <p className="text-xs text-slate-500">Numeric Columns</p>
                  <p className="text-lg font-bold text-blue-600">
                    {analysis.data_quality.numeric_columns}
                  </p>
                </div>
                <div className="bg-white p-3 rounded border border-blue-200">
                  <p className="text-xs text-slate-500">Missing Values</p>
                  <p className="text-lg font-bold text-rose-600">
                    {analysis.data_quality.missing_values}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== EXPORT BUTTONS =====*/}
      <div className="flex gap-3">
        <button
          onClick={handleExportHTML}
          className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all flex items-center justify-center gap-2"
        >
          📄 Export HTML Report
        </button>
        <button
          onClick={handleExportCSV}
          className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center justify-center gap-2"
        >
          📥 Export CSV
        </button>
      </div>

      {/* ===== COMPARISON MODE TOGGLE ===== */}
      <div className="card p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-l-4 border-indigo-500">
        <button
          onClick={() => setCompareMode(!compareMode)}
          className={`w-full py-2 px-4 text-white rounded-lg font-semibold transition-all ${
            timeEnabled
              ? 'bg-indigo-500 hover:bg-indigo-600'
              : 'bg-slate-400 cursor-not-allowed'
          }`}
          disabled={!timeEnabled}
          title={
            !timeEnabled
              ? 'Upload a dataset with a reliable datetime column to enable comparison.'
              : ''
          }
        >
          {compareMode ? '📊 Exit Comparison Mode' : '📈 Compare (This vs Last Period)'}
        </button>

        {compareMode && timeEnabled && (
          <p className="text-xs text-slate-700 mt-3">
            Detected {analysis.time_analysis?.grain} comparison on{' '}
            <span className="font-semibold">
              {analysis.time_analysis?.target_metric}
            </span>{' '}
            {analysis.time_analysis?.delta_pct != null ? (
              <>
                (
                {analysis.time_analysis.delta_pct > 0 ? '+' : ''}
                {analysis.time_analysis.delta_pct}% vs previous period)
              </>
            ) : null}
          </p>
        )}

        {!timeEnabled && (
          <p className="text-xs text-slate-600 mt-3">
            💡 Comparison mode requires a datetime column (e.g., created_at, date, timestamp).
          </p>
        )}
      </div>

      {/* ===== TRUST PANEL ===== */}
      {(analysis.sampling?.applied ||
        (analysis.run_notes && analysis.run_notes.length > 0)) && (
        <div className="card p-5 bg-gradient-to-r from-slate-50 to-slate-100 border-l-4 border-slate-500">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              🧾 Run Notes (Trust & Method)
            </h2>
            <button
              onClick={() => setShowRunNotes(!showRunNotes)}
              className="text-xs font-semibold px-3 py-1 rounded bg-slate-800 text-white hover:bg-slate-900"
            >
              {showRunNotes ? 'Hide' : 'Show'}
            </button>
          </div>

          {analysis.sampling?.applied && (
            <p className="text-xs text-slate-700 mt-3">
              {analysis.sampling.note || 'Sampling applied for speed.'}
            </p>
          )}

          {showRunNotes && analysis.run_notes && analysis.run_notes.length > 0 && (
            <ul className="mt-3 text-xs text-slate-700 list-disc pl-5 space-y-1">
              {analysis.run_notes.slice(0, 12).map((n, idx) => (
                <li key={idx}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ===== INTERACTIVE CHARTS (now handled by separate component) ===== */}
      <InteractiveCharts
        clusters={analysis.clusters}
        correlations={analysis.correlations}
        forecast={analysis.forecast}
      />

      {/* ===== GEO MAP (now handled by separate component) ===== */}
      {geoEnabled && <GeoMap points={geoPoints} />}

      {/* ===== AI INSIGHTS ===== */}
      {analysis.ai_insights && analysis.ai_insights.length > 0 && (
        <div className="card p-5 bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            🤖 AI-Powered Insights
          </h2>
          <div className="space-y-3">
            {analysis.ai_insights.map((insight: string, idx: number) => (
              <div
                key={idx}
                onClick={() => setSelectedInsight(selectedInsight === idx ? null : idx)}
                className={`p-4 rounded-lg cursor-pointer transition-all border-l-4 ${
                  selectedInsight === idx
                    ? 'bg-purple-100 border-purple-500 shadow-lg'
                    : 'bg-white border-purple-300 hover:shadow-md'
                }`}
              >
                <p className="font-medium text-slate-800">{insight}</p>
                {selectedInsight === idx && (
                  <p className="text-xs text-slate-600 mt-2">
                    ✓ Click to see detailed analysis
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== RECOMMENDATIONS ===== */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <div className="card p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            ✅ Actionable Recommendations
          </h2>
          <div className="space-y-3">
            {analysis.recommendations.map((rec: Recommendation, idx: number) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-l-4 ${
                  rec.priority === 'HIGH'
                    ? 'bg-rose-50 border-rose-500'
                    : rec.priority === 'MEDIUM'
                    ? 'bg-amber-50 border-amber-500'
                    : 'bg-blue-50 border-blue-500'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-900">{rec.action}</h3>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded ${
                      rec.priority === 'HIGH'
                        ? 'bg-rose-200 text-rose-800'
                        : rec.priority === 'MEDIUM'
                        ? 'bg-amber-200 text-amber-800'
                        : 'bg-blue-200 text-blue-800'
                    }`}
                  >
                    {rec.priority}
                  </span>
                </div>
                <p className="text-xs text-slate-700 mb-2">{rec.reason}</p>
                <p className="text-xs font-semibold text-slate-600">
                  💰 Impact: {rec.impact}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== TOP KPIs ===== */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card px-4 py-3 hover:shadow-lg transition-shadow duration-300">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Total rows
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
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

      {/* ===== EXECUTIVE SUMMARY ===== */}
      <div className="card p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-500">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          🎯 Executive Summary
        </h2>
        <p className="text-sm text-slate-700 mb-2 font-medium">{analysis.summary}</p>
        <p className="text-xs text-slate-500">Execution ID: {analysis.execution_id}</p>
      </div>

      {/* ===== CLUSTERS ===== */}
      {analysis.clusters && Object.keys(analysis.clusters).length > 0 && (
        <div className="card p-5 border-l-4 border-blue-500">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            🎯 Customer Segments
          </h2>

          <div className="space-y-3">
            {Object.entries(analysis.clusters).map(([segName, segData]: [string, any]) => {
              if (segData?.error) return null
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
                        {segData.size} records • {segData.pct}
                      </p>
                    </div>
                    <div className="text-2xl">{isExpanded ? '▼' : '▶'}</div>
                  </div>

                  {isExpanded && segData.avg_metrics && (
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
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== ANOMALIES ===== */}
      {analysis.anomalies && analysis.anomalies.total_count > 0 && (
        <div className="card p-5 border-l-4 border-rose-500">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            ⚠️ Anomalies Detected
          </h2>

          <p className="text-sm text-rose-700 mb-4">
            Found <span className="font-bold text-lg">{analysis.anomalies.total_count}</span>{' '}
            outliers ({analysis.anomalies.pct})
          </p>

          {analysis.anomalies.top_3_anomalies && (
            <div className="space-y-2">
              {analysis.anomalies.top_3_anomalies.map((row: any, idx: number) => (
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
                      .map(([k, v]: [string, any]) =>
                        `${k}=${typeof v === 'number' ? v.toFixed(0) : v}`
                      )
                      .join(' | ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== FORECAST (your existing cards remain) ===== */}
      {analysis.forecast && Object.keys(analysis.forecast).length > 0 && (
        <div className="card p-6 border-l-4 border-purple-500">
          <h2 className="mb-6 text-sm font-semibold text-slate-900">
            📈 Forecast (Next 3 Periods)
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {Object.entries(analysis.forecast)
              .slice(0, 3)
              .map(([col, fcData]: [string, any]) => {
                const trend = fcData.slope > 0 ? '📈 UPWARD' : '📉 DECLINING'
                const maxVal = Math.max(...fcData.next_3_periods)
                const minVal = Math.min(...fcData.next_3_periods)
                const range = maxVal - minVal || 1

                return (
                  <div
                    key={col}
                    className="bg-gradient-to-br from-purple-50 to-violet-50 p-5 rounded-xl border border-purple-200 shadow-sm hover:shadow-md transition-all min-h-[280px]"
                  >
                    <div className="mb-4 text-center pb-2 border-b border-purple-100">
                      <h3
                        className="font-bold text-slate-800 text-sm bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent mb-2"
                        title={col}
                        style={{
                          wordBreak: 'break-word',
                          maxHeight: '3em',
                          overflow: 'hidden',
                        }}
                      >
                        {col.length > 18 ? col.substring(0, 18) + '...' : col}
                      </h3>

                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                        {trend}{' '}
                        {fcData.slope > 0
                          ? `+${(fcData.slope * 100).toFixed(1)}%`
                          : `${(fcData.slope * 100).toFixed(1)}%`}
                      </span>
                    </div>

                    <div className="flex items-end gap-2 h-28 mx-1 w-full px-2">
                      {fcData.next_3_periods.map((val: number, idx: number) => {
                        const normalizedHeight =
                          ((val - minVal) / range) * 85 + 8
                        const isHighest = val === maxVal

                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center min-w-0">
                            <div
                              className={`w-[85%] rounded-t-xl shadow-md transition-all duration-500 hover:scale-[1.05] ${
                                isHighest
                                  ? 'bg-gradient-to-t from-purple-600 via-purple-500 to-purple-400 border-t-4 border-white'
                                  : 'bg-gradient-to-t from-purple-400 to-purple-200'
                              }`}
                              style={{ height: `${normalizedHeight}%` }}
                              title={`Period ${idx + 1}: ${val.toLocaleString()}`}
                            />
                            <p className="text-xs font-mono text-slate-700 mt-2 text-center leading-tight min-w-[48px]">
                              {val.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium">
                              P{idx + 1}
                            </p>
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-4 pt-3 border-t border-purple-200 text-center">
                      <p className="text-xs text-slate-600">
                        Slope:{' '}
                        <span className="font-bold text-purple-700 font-mono">
                          {(fcData.slope * 100).toFixed(1)}%
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Max: {maxVal.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ===== CORRELATIONS LIST ===== */}
      {analysis.correlations && Object.keys(analysis.correlations).length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            🔗 Strong Correlations
          </h2>

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
                    <span
                      className={`font-bold text-lg ${
                        absCorr > 0.7 ? 'text-green-700' : 'text-slate-600'
                      }`}
                    >
                      {corrValue.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1 rounded-full mt-2">
                    <div
                      className="bg-green-500 h-1 rounded-full transition-all"
                      style={{ width: `${absCorr * 100}%` }}
                    />
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
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            📋 Key Statistics
          </h2>

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
                  <tr
                    key={col}
                    className="odd:bg-white even:bg-slate-50 border-b hover:bg-slate-100"
                  >
                    <td className="border px-2 py-2 font-medium text-slate-800">{col}</td>
                    <td className="border px-2 py-2 text-right">{(s.mean as number).toFixed(2)}</td>
                    <td className="border px-2 py-2 text-right">{(s.median as number).toFixed(2)}</td>
                    <td className="border px-2 py-2 text-right font-semibold text-rose-600">
                      {(s.min as number).toFixed(2)}
                    </td>
                    <td className="border px-2 py-2 text-right font-semibold text-emerald-600">
                      {(s.max as number).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== DEBUG ===== */}
      {process.env.NODE_ENV !== 'production' && raw && (
        <div className="card p-3 bg-slate-100">
          <p className="text-xs text-slate-600 mb-2 font-semibold">
            Raw response (dev only):
          </p>
          <pre className="text-xs bg-slate-900 text-green-400 p-3 rounded overflow-auto max-h-48 font-mono">
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
