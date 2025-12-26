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

type PythonCorrelations = Record<string, number>
type PythonTrends = Record<string, string>

export type PythonAnalysis = {
  success: boolean
  execution_id: string
  file_info: FileInfo
  statistics: Record<string, ColumnStats>
  correlations: PythonCorrelations
  trends: PythonTrends
  outliers: Record<string, number>
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
    <div className="space-y-3">
      {/* Top scorecards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {analysis.statistics?.Price && (
          <div className="card px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Avg price
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-800">
              {analysis.statistics.Price.mean.toFixed(2)}
            </p>
          </div>
        )}

        {analysis.statistics?.Revenue && (
          <div className="card px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Avg revenue
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-800">
              {analysis.statistics.Revenue.mean.toFixed(2)}
            </p>
          </div>
        )}

        <div className="card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Strong correlations
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {analysis.correlations ? Object.keys(analysis.correlations).length : 0}
          </p>
        </div>

        <div className="card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Potential outliers
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {analysis.outliers
              ? Object.values(analysis.outliers).reduce((sum, v) => sum + v, 0)
              : 0}
          </p>
        </div>
      </div>

      {/* Executive summary */}
      <div className="card p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Executive summary</h2>
        <p className="text-sm text-slate-700">
          {analysis.summary}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Execution ID: {analysis.execution_id}
        </p>
      </div>

      {/* What this likely means */}
      <div className="card border border-amber-100 bg-amber-50/60 p-5 text-xs text-slate-800">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">What this likely means</h2>
        <p>
          {(() => {
            const trends = analysis.trends || {}
            const price = trends['Price'] || trends['Unit_Price']
            const quantity = trends['Quantity_Sold'] || trends['Units'] || ''
            const revenue = trends['Revenue'] || trends['Sales'] || ''

            const up = (v: string) => v.trim().startsWith('+')
            const down = (v: string) => v.trim().startsWith('-')

            if (price && revenue && down(price) && down(revenue)) {
              return 'Prices and revenue are both falling. Discounts may be eroding revenue without bringing in enough new volume. Review your discounting or pricing strategy.'
            }
            if (price && quantity && down(price) && up(quantity)) {
              return 'Prices are down but volume is up. Recent discounts are driving more units; check if margins remain healthy.'
            }
            if (revenue && up(revenue)) {
              return 'Revenue is trending up. Double‑check which columns drive this growth and consider doubling down on those segments.'
            }
            if (revenue && down(revenue)) {
              return 'Revenue is trending down. Focus on the columns with strongest negative trends or outliers to diagnose the drop.'
            }
            return 'Use the trends, correlations, and outliers above to investigate which levers are moving your business up or down.'
          })()}
        </p>
      </div>

      {/* Dataset overview + Trends */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {analysis.file_info && (
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Dataset overview</h2>
            <ul className="text-xs text-slate-700 space-y-1">
              <li>Total rows: {analysis.file_info.rows}</li>
              <li>Total columns: {analysis.file_info.columns}</li>
              <li>
                Numeric columns:{' '}
                {analysis.file_info.numeric_columns.length > 0
                  ? analysis.file_info.numeric_columns.join(', ')
                  : 'None detected'}
              </li>
            </ul>
          </div>
        )}

        {analysis.trends && Object.keys(analysis.trends).length > 0 && (
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Trends</h2>
            <ul className="text-xs text-slate-700 space-y-1">
              {Object.entries(analysis.trends).map(([col, value]) => {
                const trendString =
                  typeof value === 'string' ? value : String(value ?? '')

                const isPositive = trendString.trim().startsWith('+')
                const isNegative = trendString.trim().startsWith('-')

                const colorClass = isPositive
                  ? 'text-emerald-600'
                  : isNegative
                  ? 'text-rose-600'
                  : 'text-slate-700'

                return (
                  <li key={col}>
                    {col}:{' '}
                    <span className={colorClass}>
                      {trendString}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Key statistics */}
      {analysis.statistics && Object.keys(analysis.statistics).length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Key statistics</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="border px-2 py-1 text-left">Column</th>
                  <th className="border px-2 py-1 text-right">Mean</th>
                  <th className="border px-2 py-1 text-right">Median</th>
                  <th className="border px-2 py-1 text-right">Min</th>
                  <th className="border px-2 py-1 text-right">Max</th>
                  <th className="border px-2 py-1 text-right">Missing</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(analysis.statistics).map(([col, s]) => (
                  <tr key={col} className="odd:bg-white even:bg-slate-50">
                    <td className="border px-2 py-1 text-slate-800">{col}</td>
                    <td className="border px-2 py-1 text-right">{s.mean.toFixed(2)}</td>
                    <td className="border px-2 py-1 text-right">{s.median.toFixed(2)}</td>
                    <td className="border px-2 py-1 text-right">{s.min.toFixed(2)}</td>
                    <td className="border px-2 py-1 text-right">{s.max.toFixed(2)}</td>
                    <td className="border px-2 py-1 text-right">{s.missing}</td>
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
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Strong correlations</h2>
          <ul className="text-xs text-slate-700 space-y-1">
            {Object.entries(analysis.correlations).map(([pair, corr]) => (
              <li key={pair}>
                {pair}: {corr.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Outliers */}
      {analysis.outliers && Object.keys(analysis.outliers).length > 0 && (
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Outliers detected</h2>
          <ul className="text-xs text-slate-700 space-y-1">
            {Object.entries(analysis.outliers).map(([col, count]) => (
              <li key={col}>
                {col}: {count} potential outlier{count === 1 ? '' : 's'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Insights */}
      {analysis.insights && analysis.insights.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Insights</h2>
          <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">
            {analysis.insights.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw payload debug (dev only) */}
      {process.env.NODE_ENV !== 'production' && raw && (
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            Raw response debug
          </h2>
          <p className="mb-2 text-xs text-slate-500">
            This section is for internal debugging. Hide it in production once everything is stable.
          </p>
          <div className="max-h-72 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs">
            <pre className="whitespace-pre-wrap text-slate-800">
              {JSON.stringify(raw, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
