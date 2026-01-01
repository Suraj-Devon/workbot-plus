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
  </style>
</head>
<body>
  <h1>📊 Data Analysis Report</h1>
  
  <div class="score-box">
    <h2>Data Quality Score</h2>
    <p><strong>${analysis.data_quality?.overall_score || 0}%</strong> Overall Health</p>
    <p>Completeness: ${analysis.data_quality?.completeness || 0}% | Missing Values: ${analysis.data_quality?.missing_values || 0}</p>
  </div>
  
  <h2>Executive Summary</h2>
  <p>${analysis.summary}</p>
  
  ${analysis.ai_insights && analysis.ai_insights.length > 0 ? `
  <h2>🤖 AI Insights</h2>
  ${analysis.ai_insights.map((insight) => `<div class="insight">${insight}</div>`).join('')}
  ` : ''}
  
  ${analysis.recommendations && analysis.recommendations.length > 0 ? `
  <h2>✅ Recommendations</h2>
  ${analysis.recommendations.map((rec) => `
  <div class="recommendation">
    <strong class="${rec.priority === 'HIGH' ? 'high' : ''}">[${rec.priority}] ${rec.action}</strong><br/>
    Reason: ${rec.reason}<br/>
    Impact: ${rec.impact}
  </div>
  `).join('')}
  ` : ''}
  
  <h2>Key Metrics</h2>
  <table>
    <tr>
      <th>Metric</th>
      <th>Value</th>
    </tr>
    <tr>
      <td>Total Rows</td>
      <td>${analysis.file_info?.rows?.toLocaleString() || 0}</td>
    </tr>
    <tr>
      <td>Numeric Columns</td>
      <td>${analysis.file_info?.numeric_columns?.length || 0}</td>
    </tr>
    <tr>
      <td>Segments Found</td>
      <td>${Object.keys(analysis.clusters || {}).length}</td>
    </tr>
    <tr>
      <td>Anomalies</td>
      <td>${analysis.anomalies?.total_count || 0}</td>
    </tr>
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
          <h2 className="text-lg font-bold text-slate-900 mb-6">📊 Data Health Score</h2>
          <div className="flex items-center justify-between">
            <div className="w-32 h-32 rounded-full border-8 border-blue-200 flex items-center justify-center bg-white shadow-lg">
              <div className="text-center">
                <p className="text-4xl font-bold text-blue-600">{analysis.data_quality.overall_score.toFixed(0)}</p>
                <p className="text-xs text-slate-600">out of 100</p>
              </div>
            </div>
            
            <div className="flex-1 ml-8 space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">Completeness</p>
                  <p className="text-sm font-bold text-blue-600">{analysis.data_quality.completeness.toFixed(1)}%</p>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${analysis.data_quality.completeness}%` }} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white p-3 rounded border border-blue-200">
                  <p className="text-xs text-slate-500">Numeric Columns</p>
                  <p className="text-lg font-bold text-blue-600">{analysis.data_quality.numeric_columns}</p>
                </div>
                <div className="bg-white p-3 rounded border border-blue-200">
                  <p className="text-xs text-slate-500">Missing Values</p>
                  <p className="text-lg font-bold text-rose-600">{analysis.data_quality.missing_values}</p>
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

      {/* ===== COMPARISON MODE TOGGLE (NEW!) =====*/}
      <div className="card p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-l-4 border-indigo-500">
        <button
          onClick={() => setCompareMode(!compareMode)}
          className="w-full py-2 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold transition-all"
        >
          {compareMode ? '📊 Exit Comparison Mode' : '📈 Compare (This vs Last Period)'}
        </button>
        {compareMode && (
          <p className="text-xs text-slate-600 mt-3">
            💡 Tip: Compare current trends with previous period to identify acceleration or deceleration
          </p>
        )}
      </div>

      {/* ===== AI INSIGHTS ===== */}
      {analysis.ai_insights && analysis.ai_insights.length > 0 && (
        <div className="card p-5 bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">🤖 AI-Powered Insights</h2>
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
                  <p className="text-xs text-slate-600 mt-2">✓ Click to see detailed analysis</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== RECOMMENDATIONS ===== */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <div className="card p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">✅ Actionable Recommendations</h2>
          <div className="space-y-3">
            {analysis.recommendations.map((rec: Recommendation, idx: number) => (
              <div key={idx} className={`p-4 rounded-lg border-l-4 ${
                rec.priority === 'HIGH' ? 'bg-rose-50 border-rose-500' :
                rec.priority === 'MEDIUM' ? 'bg-amber-50 border-amber-500' :
                'bg-blue-50 border-blue-500'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-900">{rec.action}</h3>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    rec.priority === 'HIGH' ? 'bg-rose-200 text-rose-800' :
                    rec.priority === 'MEDIUM' ? 'bg-amber-200 text-amber-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {rec.priority}
                  </span>
                </div>
                <p className="text-xs text-slate-700 mb-2">{rec.reason}</p>
                <p className="text-xs font-semibold text-slate-600">💰 Impact: {rec.impact}</p>
              </div>
            ))}
            
          </div>
        </div>
      )}

      {/* ===== TOP KPIs ===== */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card px-4 py-3 hover:shadow-lg transition-shadow duration-300">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Total rows</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {analysis.file_info?.rows?.toLocaleString() || 0}
          </p>
        </div>

        <div className="card px-4 py-3 hover:shadow-lg transition-shadow duration-300">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Numeric columns</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {analysis.file_info?.numeric_columns?.length || 0}
          </p>
        </div>

        <div className="card px-4 py-3 hover:shadow-lg transition-shadow duration-300 bg-gradient-to-br from-blue-50 to-blue-100">
          <p className="text-[11px] uppercase tracking-wide text-blue-600 font-bold">Data segments found</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">
            {Object.keys(analysis.clusters || {}).length}
          </p>
        </div>

        <div className="card px-4 py-3 hover:shadow-lg transition-shadow duration-300 bg-gradient-to-br from-rose-50 to-rose-100">
          <p className="text-[11px] uppercase tracking-wide text-rose-600 font-bold">Anomalies detected</p>
          <p className="mt-1 text-2xl font-bold text-rose-700">
            {analysis.anomalies?.total_count || 0}
          </p>
        </div>
      </div>

      {/* ===== EXECUTIVE SUMMARY ===== */}
      <div className="card p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-500">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">🎯 Executive Summary</h2>
        <p className="text-sm text-slate-700 mb-2 font-medium">{analysis.summary}</p>
        <p className="text-xs text-slate-500">Execution ID: {analysis.execution_id}</p>
      </div>

      {/* ===== CLUSTERS ===== */}
      {analysis.clusters && Object.keys(analysis.clusters).length > 0 && (
        <div className="card p-5 border-l-4 border-blue-500">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">🎯 Customer Segments</h2>
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
                      <p className="text-xs text-slate-600 mt-1">{segData.size} records • {segData.pct}</p>
                    </div>
                    <div className="text-2xl">{isExpanded ? '▼' : '▶'}</div>
                  </div>

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
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== ANOMALIES ===== */}
      {analysis.anomalies && analysis.anomalies.total_count > 0 && (
        <div className="card p-5 border-l-4 border-rose-500">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">⚠️ Anomalies Detected</h2>
          <p className="text-sm text-rose-700 mb-4">
            Found <span className="font-bold text-lg">{analysis.anomalies.total_count}</span> outliers ({analysis.anomalies.pct})
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
                    {Object.entries(row).slice(0, 2).map(([k, v]: [string, any]) => `${k}=${typeof v === 'number' ? v.toFixed(0) : v}`).join(' | ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== FORECAST ===== */}
      {analysis.forecast && Object.keys(analysis.forecast).length > 0 && (
        <div className="card p-5 border-l-4 border-purple-500">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">📈 Forecast</h2>
          <div className="space-y-4">
            {Object.entries(analysis.forecast).slice(0, 3).map(([col, fcData]: [string, any]) => {
              const trend = fcData.slope > 0 ? '📈' : '📉'
              const maxVal = Math.max(...fcData.next_3_periods)
              const minVal = Math.min(...fcData.next_3_periods)
              const range = maxVal - minVal || 1

              return (
                <div key={col} className="bg-purple-50 p-4 rounded-lg">
                  <p className="font-bold text-slate-800 mb-3">{trend} {col}</p>
                  <div className="flex items-end gap-2 h-24">
                    {fcData.next_3_periods.map((val: number, idx: number) => {
                      const normalizedHeight = ((val - minVal) / range) * 80 + 20
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center">
                          <div className="w-full bg-gradient-to-t from-purple-500 to-purple-300 rounded-t transition-all" style={{ height: `${normalizedHeight}px` }} />
                          <p className="text-xs text-slate-600 mt-1 font-medium">{val.toFixed(0)}</p>
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
              return (
                <li key={col} className={`flex justify-between p-2 rounded ${isPositive ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                  <span className="font-medium">{col}:</span>
                  <span className="font-bold">{value}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ===== CORRELATIONS ===== */}
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
                  <tr key={col} className="odd:bg-white even:bg-slate-50 border-b hover:bg-slate-100">
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

      {/* ===== DEBUG ===== */}
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
