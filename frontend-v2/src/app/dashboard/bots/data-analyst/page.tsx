'use client'

import { FormEvent, useState } from 'react'
import api from './../../../../lib/api'
import toast from 'react-hot-toast'
import DataAnalysisResult, { PythonAnalysis } from '../../../../components/DataAnalysisResult'

export default function DataAnalystBotPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<PythonAnalysis | null>(null)
  const [raw, setRaw] = useState<any | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error('Please choose a CSV or JSON file')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      setLoading(true)
      setAnalysis(null)
      setRaw(null)

      const res = await api.post('/api/bots/data-analyst', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      // Backend: { success, message, executionId, data: <pythonResult> }
      const outer = res.data.results || res.data
      const pythonResult: PythonAnalysis = outer.data || outer

      setAnalysis(pythonResult)
      setRaw(outer)

      if (pythonResult.success === false) {
        toast.error(pythonResult.error || 'Analysis failed')
      } else {
        toast.success('Analysis completed')
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to analyze file')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Bot hero */}
      <div className="card flex flex-col gap-4 border border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
              Data Analyst Bot
            </span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Turn raw CSVs into board‑ready insights in seconds
          </h1>
          <p className="text-sm text-slate-600">
            Upload sales or operations data and get an instant health check: key KPIs, trends, outliers, and where to pay attention this week.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span className="rounded-full bg-white px-2 py-0.5">CSV &amp; JSON</span>
            <span className="rounded-full bg-white px-2 py-0.5">Best for founders &amp; HR leads</span>
            <span className="rounded-full bg-white px-2 py-0.5">No data science needed</span>
          </div>
        </div>
        <div className="rounded-xl bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            How teams use this
          </p>
          <ul className="mt-1 list-disc pl-4 space-y-1">
            <li>Spot if revenue is growing or leaking before reviews.</li>
            <li>See which metrics move when you change prices.</li>
            <li>Share one clean view with managers or investors.</li>
          </ul>
        </div>
      </div>

      {/* What this bot does */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card md:col-span-2 p-4 text-xs text-slate-600">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold text-slate-800">What this bot does</span>
            <span className="rounded-full bg-teal-600/10 px-2 py-0.5 text-[10px] font-medium text-teal-700">
              Designed for non‑technical users
            </span>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            <li>Profiles your dataset: rows, columns, and numeric fields.</li>
            <li>Calculates core statistics for each numeric column.</li>
            <li>Highlights strong relationships and suspicious outliers.</li>
            <li>Summarizes everything into a short executive overview.</li>
          </ul>
        </div>

        <div className="card p-4 text-xs text-slate-600">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Example output
          </p>
          <p className="text-slate-700">
            “Average price dropped 83% while revenue fell 55%. Volume is slightly up, which means discounts are not driving enough extra sales.”
          </p>
        </div>
      </div>

      {/* Upload form */}
      <div className="card p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Data file (CSV or JSON)
              </label>
              <input
                type="file"
                accept=".csv,.json"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-teal-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-teal-700"
              />
              <p className="mt-1 text-xs text-slate-400">
                Files are processed securely on the server and only summarized statistics are stored.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-2 w-full sm:mt-6 sm:w-auto disabled:opacity-60"
            >
              {loading ? 'Analyzing…' : 'Run analysis'}
            </button>
          </div>
        </form>
      </div>

      {/* Results – now using reusable component */}
      {analysis && (
        <DataAnalysisResult analysis={analysis} raw={raw} />
      )}
    </div>
  )
}
