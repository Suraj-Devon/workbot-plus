'use client'

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
  clusters: Record<string, ClusterData>  // NEW
  anomalies: AnomalyData  // NEW
  forecast: Record<string, ForecastData>  // NEW
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
  return (
    <div className="space-y-4">
      {/* Top KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Total rows
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {analysis.file_info?.rows?.toLocaleString() || 0}
          </p>
        </div>

        <div className="card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Numeric columns
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {analysis.file_info?.numeric_columns?.length || 0}
          </p>
        </div>

        <div className="card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Data segments found
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {Object.keys(analysis.clusters || {}).length}
          </p>
        </div>

        <div className="card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Anomalies detected
          </p>
          <p className="mt-1 text-lg font-semibold text-rose-600">
            {analysis.anomalies?.total_count || 0}
          </p>
        </div>
      </div>

      {/* Executive summary */}
      <div className="card p-5 bg-gradient-to-r from-emerald-50 to-teal-50">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Executive Summary</h2>
        <p className="text-sm text-slate-700 mb-2">
          {analysis.summary}
        </p>
        <p className="text-xs text-slate-500">
          Execution ID: {analysis.execution_id}
        </p>
      </div>

      {/* ===== NEW: CLUSTERS (KMeans Segmentation) ===== */}
      {analysis.clusters && Object.keys(analysis.clusters).length > 0 && (
        <div className="card p-5 border-l-4 border-blue-500">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">🎯 Customer Segments (KMeans)</h2>
          <div className="space-y-3">
            {Object.entries(analysis.clusters).map(([segName, segData]: [string, any]) => {
              if (segData.error) return null
              return (
                <div key={segName} className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-slate-800">{segName}</h3>
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      {segData.size} records ({segData.pct})
                    </span>
                  </div>
                  <ul className="text-xs text-slate-700 space-y-1">
                    {Object.entries(segData.avg_metrics).slice(0, 3).map(([metric, value]: [string, any]) => (
                      <li key={metric}>
                        <span className="font-medium">{metric}:</span> {typeof value === 'number' ? value.toFixed(2) : value}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== NEW: ANOMALIES (Isolation Forest) ===== */}
      {analysis.anomalies && analysis.anomalies.total_count > 0 && (
        <div className="card p-5 border-l-4 border-rose-500">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">⚠️ Anomalies Detected (Isolation Forest)</h2>
          <p className="text-sm text-rose-700 mb-3">
            Found <span className="font-bold">{analysis.anomalies.total_count}</span> outliers ({analysis.anomalies.pct})
          </p>
          {analysis.anomalies.top_3_anomalies && (
            <div className="bg-rose-50 p-3 rounded-lg text-xs">
              <p className="font-medium text-slate-800 mb-2">Top anomalous rows:</p>
              <ul className="space-y-2">
                {analysis.anomalies.top_3_anomalies.map((row, idx) => (
                  <li key={idx} className="text-slate-700">
                    Row {idx + 1}: {Object.entries(row).slice(0, 2).map(([k, v]: [string, any]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ===== NEW: FORECAST (Linear Trend) ===== */}
      {analysis.forecast && Object.keys(analysis.forecast).length > 0 && (
        <div className="card p-5 border-l-4 border-purple-500">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">📈 Forecast (Next 3 Periods)</h2>
          <div className="space-y-2">
            {Object.entries(analysis.forecast).slice(0, 3).map(([col, fcData]: [string, any]) => {
              const trend = fcData.slope > 0 ? '📈' : '📉'
              return (
                <div key={col} className="bg-purple-50 p-3 rounded-lg">
                  <p className="font-medium text-slate-800 mb-1">
                    {trend} {col}
                  </p>
                  <p className="text-xs text-slate-600">
                    Forecast: {fcData.next_3_periods.map((v: number) => v.toFixed(2)).join(' → ')}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Trends */}
      {analysis.trends && Object.keys(analysis.trends).length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Trends</h2>
          <ul className="text-xs text-slate-700 space-y-2">
            {Object.entries(analysis.trends).map(([col, value]) => {
              const isPositive = String(value).trim().startsWith('+')
              const colorClass = isPositive ? 'text-emerald-600' : 'text-rose-600'
              return (
                <li key={col} className="flex justify-between">
                  <span>{col}:</span>
                  <span className={`font-bold ${colorClass}`}>{value}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Statistics Table */}
      {analysis.statistics && Object.keys(analysis.statistics).length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Key Statistics</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border px-2 py-1 text-left">Column</th>
                  <th className="border px-2 py-1 text-right">Mean</th>
                  <th className="border px-2 py-1 text-right">Median</th>
                  <th className="border px-2 py-1 text-right">Min</th>
                  <th className="border px-2 py-1 text-right">Max</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(analysis.statistics).map(([col, s]) => (
                  <tr key={col} className="odd:bg-white even:bg-slate-50 border-b">
                    <td className="border px-2 py-1 font-medium">{col}</td>
                    <td className="border px-2 py-1 text-right">{(s.mean as number).toFixed(2)}</td>
                    <td className="border px-2 py-1 text-right">{(s.median as number).toFixed(2)}</td>
                    <td className="border px-2 py-1 text-right">{(s.min as number).toFixed(2)}</td>
                    <td className="border px-2 py-1 text-right">{(s.max as number).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Correlations */}
      {analysis.correlations && Object.keys(analysis.correlations).length > 0 && (
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Strong Correlations</h2>
          <ul className="text-xs text-slate-700 space-y-1">
            {Object.entries(analysis.correlations).map(([pair, corr]) => (
              <li key={pair}>
                <span className="font-medium">{pair}:</span> {(corr as number).toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Insights */}
      {analysis.insights && analysis.insights.length > 0 && (
        <div className="card p-5 bg-emerald-50">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Key Insights</h2>
          <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">
            {analysis.insights.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Debug */}
      {process.env.NODE_ENV !== 'production' && raw && (
        <div className="card p-3">
          <p className="text-xs text-slate-500 mb-2">Raw response (dev only):</p>
          <pre className="text-xs bg-slate-100 p-2 rounded overflow-auto max-h-48">
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
