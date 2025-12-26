'use client'

import { FormEvent, useState } from 'react'
import { useAuth } from '../../../../context/AuthContext'
import api from '../../../../lib/api'
import toast from 'react-hot-toast'
import DataAnalysisResult, { PythonAnalysis } from '../../../../components/DataAnalysisResult'

export default function DataAnalystBotPage() {
  const { user } = useAuth()
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

      const outer = res.data.results || res.data
      const pythonResult: PythonAnalysis = outer.data || outer

      setAnalysis(pythonResult)
      setRaw(outer)

      if (pythonResult.success === false) {
        toast.error(pythonResult.error || 'Analysis failed')
      } else {
        toast.success('Analysis completed! 🎉')
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to analyze file')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero Section - Phase 6 Design System */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 bg-teal-100/80 backdrop-blur-sm text-teal-800 px-6 py-3 rounded-2xl mb-6 border border-teal-200/50">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 via-teal-500 to-blue-600 bg-clip-text text-transparent">
              Data Analyst Bot
            </h1>
          </div>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Turn raw CSVs into board‑ready insights in seconds. Upload sales or operations data and get instant KPIs, trends, outliers.
          </p>
        </div>

        {/* Upload Section - Matches dashboard cards */}
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Upload Form */}
          <div className="card bg-white/80 backdrop-blur-sm shadow-xl border border-slate-100/50 rounded-3xl p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              📊 Upload Your Data
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Data file (CSV or JSON)
                </label>
                <div 
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    file 
                      ? 'border-teal-300 bg-teal-50' 
                      : 'border-slate-300 hover:border-teal-400 hover:bg-teal-50/50'
                  }`}
                >
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl shadow-lg">
                      📊
                    </div>
                    {file ? (
                      <div>
                        <p className="font-semibold text-slate-900">{file.name}</p>
                        <p className="text-sm text-teal-700">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-lg font-semibold text-slate-900 mb-1">Drop CSV/JSON or click to browse</p>
                        <p className="text-sm text-slate-500">Max 10MB - Secure processing</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading || !file}
                className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white py-4 px-8 rounded-2xl font-semibold text-lg shadow-xl hover:from-teal-600 hover:to-teal-700 transform hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  '🚀 Run Analysis'
                )}
              </button>
            </form>
          </div>

          {/* Preview/Status */}
          <div className="space-y-6">
            <div className="card bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200/50 p-6 rounded-3xl">
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                🎯 What You'll Get
              </h4>
              <ul className="text-sm text-slate-700 space-y-1">
                <li>• Dataset profile (rows, columns, types)</li>
                <li>• Core statistics per numeric column</li>
                <li>• Key relationships & outliers</li>
                <li>• Executive summary</li>
              </ul>
            </div>
            
            {!analysis && (
              <div className="h-80 bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                <div className="text-center text-slate-500">
                  <div className="w-20 h-20 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
                    📈
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Results appear here</h3>
                  <p>Upload data to see charts, metrics, and insights</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {analysis && (
          <div className="card bg-white shadow-2xl border-0 rounded-3xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <div>
                  <h2 className="text-2xl font-bold">Analysis Complete!</h2>
                  <p className="text-emerald-100">Your data insights are ready</p>
                </div>
              </div>
            </div>
            <div className="p-8">
              <DataAnalysisResult analysis={analysis} raw={raw} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
