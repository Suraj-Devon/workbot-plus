'use client'

import { FormEvent, useState } from 'react'
import { useAuth } from '../../../../context/AuthContext'
import api from './../../../../lib/api'
import toast from 'react-hot-toast'

type RankedCandidate = {
  file_name: string
  score: number
  matched_skills: string[]
  missing_skills: string[]
  reasoning: string
  rank: number
}

type ScreenerResult = {
  success: boolean
  execution_id: string
  total_resumes: number
  strong_candidates: number
  ranking: RankedCandidate[]
  insights: string[]
  summary: string
  error?: string
}

export default function ResumeScreenerPage() {
  const { user } = useAuth()
  const [files, setFiles] = useState<FileList | null>(null)
  const [jobDesc, setJobDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScreenerResult | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!files || files.length === 0) {
      toast.error('Please upload at least one resume')
      return
    }
    if (!jobDesc.trim()) {
      toast.error('Please paste the job description')
      return
    }

    const formData = new FormData()
    Array.from(files).forEach((f) => formData.append('files', f))
    formData.append('jobDescription', jobDesc)

    try {
      setLoading(true)
      setResult(null)

      const res = await api.post('/api/bots/resume-screener', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const outer = res.data
      console.log('Resume screener outer:', outer)

      if (!outer || !outer.success) {
        toast.error(outer?.message || outer?.error || 'Screening failed')
        return
      }

      const inner = outer.data
      console.log('Resume screener inner:', inner)

      if (!inner || !inner.success) {
        toast.error(inner?.summary || inner?.error || 'No valid resume files')
        return
      }

      const screener: ScreenerResult = inner
      setResult(screener)
      toast.success(`Screened ${screener.total_resumes} resumes! 🎉`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to screen resumes')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero - Phase 6 Design */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 bg-indigo-100/80 backdrop-blur-sm text-indigo-800 px-6 py-3 rounded-2xl mb-6 border border-indigo-200/50">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Resume Screener Bot
            </h1>
          </div>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Upload resumes + job description → instant ranking by skills fit. Top 3 candidates ready in minutes.
          </p>
        </div>

        {/* Form - 2 Column */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Resumes Upload */}
          <div className="card bg-white/80 backdrop-blur-sm shadow-xl border border-slate-100/50 rounded-3xl p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              📄 Upload Resumes
            </h3>
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-2xl p-8 text-center transition-all hover:border-indigo-400 hover:bg-indigo-50/50">
                <input
                  type="file"
                  accept=".pdf,.txt"
                  multiple
                  onChange={(e) => setFiles(e.target.files)}
                  className="hidden"
                  id="resume-upload"
                />
                <label htmlFor="resume-upload" className="cursor-pointer block">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl shadow-lg">
                    📎
                  </div>
                  {files?.length ? (
                    <div>
                      <p className="font-semibold text-slate-900">{files.length} resumes selected</p>
                      <p className="text-sm text-indigo-700">PDF/TXT - Max 100 files</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-semibold text-slate-900 mb-1">Drop resumes or click</p>
                      <p className="text-sm text-slate-500">PDF or TXT format</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* Job Description */}
          <div className="card bg-white/80 backdrop-blur-sm shadow-xl border border-slate-100/50 rounded-3xl p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              💼 Job Description
            </h3>
            <textarea
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              rows={8}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-vertical"
              placeholder="Paste the full job description here...&#10;&#10;Requirements:&#10;- 3+ years Python experience&#10;- React or JavaScript&#10;- AWS or cloud experience&#10;&#10;Nice to have:&#10;- Docker&#10;- Leadership experience"
            />
          </div>
        </div>

        {/* Run Button */}
        <div className="card bg-gradient-to-r from-indigo-50 to-purple-50/50 border border-indigo-200/50 p-8 rounded-3xl">
          <button
            onClick={handleSubmit as any}
            disabled={loading || !files?.length || !jobDesc.trim()}
            className="mx-auto block w-full max-w-md bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 px-8 rounded-2xl font-semibold text-lg shadow-xl hover:from-indigo-600 hover:to-purple-700 transform hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Screening {files?.length || 0} resumes...
              </>
            ) : (
              '🚀 Run Screening'
            )}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="card bg-white shadow-2xl border-0 rounded-3xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-indigo-600 px-8 py-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <div>
                  <h2 className="text-2xl font-bold">Screening Complete!</h2>
                  <p className="text-emerald-100">
                    Found {result.strong_candidates} strong candidates from {result.total_resumes} resumes
                  </p>
                </div>
              </div>
            </div>
            <div className="p-8 divide-y divide-slate-100">
              {/* Top Candidates */}
              <div className="pb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  🏆 Top Candidates
                </h3>
                <div className="space-y-3">
                  {result.ranking.slice(0, 5).map((candidate) => (
                    <div key={candidate.file_name} className="group bg-gradient-to-r from-slate-50 to-indigo-50 p-6 rounded-2xl border border-slate-200 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="font-bold text-xl text-slate-900">{candidate.file_name}</div>
                        <div className="flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full text-sm font-semibold">
                          #{candidate.rank} • {candidate.score}%
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-semibold text-slate-700 mb-1">✅ Matched Skills</p>
                          <div className="flex flex-wrap gap-1">
                            {candidate.matched_skills.map((skill, i) => (
                              <span key={i} className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700 mb-1">❌ Missing Skills</p>
                          <div className="flex flex-wrap gap-1">
                            {candidate.missing_skills.map((skill, i) => (
                              <span key={i} className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-600 italic">{candidate.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="pt-8">
                <h3 className="text-xl font-bold text-slate-900 mb-4">📋 Hiring Summary</h3>
                <div className="bg-gradient-to-r from-slate-50 to-indigo-50 p-6 rounded-2xl">
                  <p className="text-lg text-slate-800 mb-4">{result.summary}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center p-3 bg-white rounded-xl">
                      <div className="text-2xl font-bold text-indigo-600">{result.total_resumes}</div>
                      <div className="text-slate-600">Total Screened</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-xl">
                      <div className="text-2xl font-bold text-emerald-600">{result.strong_candidates}</div>
                      <div className="text-slate-600">Strong Fits (70+)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
