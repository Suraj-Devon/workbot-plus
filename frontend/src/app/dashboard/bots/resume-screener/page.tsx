'use client'

import { FormEvent, useState, ChangeEvent } from 'react'
import { useAuth } from '../../../../context/AuthContext'
import api from './../../../../lib/api'
import toast from 'react-hot-toast'

const MAX_FILE_MB = 5
const MAX_FILES = 300

// Add DOCX support (browser MIME can vary, so also check extension)
const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

// Support BOTH old (score/matched_skills) + new ML (overall_score/semantic_similarity)
type Candidate = {
  file_name: string
  rank: number
  // Old fields (legacy)
  score?: number
  matched_skills?: string[]
  missing_skills?: string[]
  // New ML fields
  overall_score?: number
  semantic_similarity?: number
  exp_score?: number
  matched_must?: string[]
  missing_must?: string[]
  // Both
  reasoning: string
}

type ScreenerResult = {
  success: boolean
  execution_id: string
  total_resumes: number
  strong_candidates: number
  strong_threshold?: number // NEW (backend can send this)
  ranking: Candidate[]
  insights: string[]
  summary: string
  error?: string
}

// Helpers
const getScore = (c: Candidate): number => c.overall_score ?? c.score ?? 0

const getMatched = (c: Candidate): string[] =>
  (c.matched_must ?? c.matched_skills ?? []).slice(0, 5)

const getMissing = (c: Candidate): string[] =>
  (c.missing_must ?? c.missing_skills ?? []).slice(0, 5)

const getSemantic = (c: Candidate): number => c.semantic_similarity ?? 0

const getExpScore = (c: Candidate): number => c.exp_score ?? 0

export default function ResumeScreenerPage() {
  const { user } = useAuth()
  const [files, setFiles] = useState<FileList | null>(null)
  const [jobDesc, setJobDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScreenerResult | null>(null)

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list || list.length === 0) {
      setFiles(null)
      return
    }

    if (list.length > MAX_FILES) {
      toast.error(`Too many files. Max ${MAX_FILES} resumes`)
      e.target.value = ''
      setFiles(null)
      return
    }

    for (const f of Array.from(list)) {
      const sizeMb = f.size / 1024 / 1024
      if (sizeMb > MAX_FILE_MB) {
        toast.error(`"${f.name}" is too large. Max ${MAX_FILE_MB} MB per file`)
        e.target.value = ''
        setFiles(null)
        return
      }

      const name = f.name.toLowerCase()
      const extOk = name.endsWith('.pdf') || name.endsWith('.txt') || name.endsWith('.docx')

      // Some browsers return empty/odd MIME types for .docx, so allow by extension too
      const mimeOk = ALLOWED_TYPES.includes(f.type) || f.type === '' || f.type === 'application/octet-stream'

      if (!extOk || !mimeOk) {
        toast.error(`"${f.name}" must be PDF, TXT, or DOCX`)
        e.target.value = ''
        setFiles(null)
        return
      }
    }

    setFiles(list)
  }

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
      toast.success(`Screened ${screener.total_resumes} resumes!`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to screen resumes')
    } finally {
      setLoading(false)
    }
  }

  const strongLabel = result?.strong_threshold ? `≥ ${result.strong_threshold}%` : '70%+'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 bg-indigo-100/80 backdrop-blur-sm text-indigo-800 px-6 py-3 rounded-2xl mb-6 border border-indigo-200/50">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Resume Screener Bot
            </h1>
          </div>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Upload resumes + job description → AI skill coverage + semantic similarity + experience signals → ranked candidates in seconds.
          </p>
        </div>

        {/* Form */}
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
                  accept=".pdf,.txt,.docx"
                  multiple
                  onChange={handleFilesChange}
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
                      <p className="text-sm text-indigo-700">
                        PDF/TXT/DOCX • Max {MAX_FILES} files • {MAX_FILE_MB}MB each
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-semibold text-slate-900 mb-1">Drop resumes or click</p>
                      <p className="text-sm text-slate-500">
                        PDF/TXT/DOCX • Max {MAX_FILES} files • {MAX_FILE_MB}MB each
                      </p>
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
              placeholder="Paste the full job description here..."
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
          <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white/90 border border-slate-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Total resumes
                </p>
                <p className="text-2xl font-bold text-slate-900">{result.total_resumes}</p>
              </div>
 
              <div className="bg-white/90 border border-emerald-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-emerald-600 mb-1">
                  Strong candidates ({strongLabel})
                </p>
                <p className="text-2xl font-bold text-emerald-700">{result.strong_candidates}</p>
              </div>

              <div className="bg-white/90 border border-indigo-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-indigo-600 mb-1">Summary</p>
                <p className="text-sm text-slate-800 line-clamp-2">{result.summary}</p>
              </div>
            </div>

            {/* How scoring works */}
            <div className="bg-white/90 border border-slate-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">How scoring works</h3>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                <li>Overall score is conservative and combines JD skill coverage, TF‑IDF semantic similarity, and experience/projects/education signals.</li>
                <li>Matched/Missing shows key JD skills found/not found in each resume (phrases like “Power BI”, “Full Stack”, “REST API”).</li>
                <li>“Strong candidates” uses the threshold shown above (often top ~20% for the current JD).</li>
              </ul>
            </div>

            {/* Insights */}
            {result.insights?.length > 0 && (
              <div className="bg-white/90 border border-slate-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Insights</h3>
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                  {result.insights.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ranking table */}
            <div className="bg-white/90 border border-slate-100 rounded-2xl p-5 shadow-sm overflow-x-auto">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Ranked candidates</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">Rank</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">File</th>
                      <th className="text-center py-3 px-3 font-semibold text-slate-700">Overall</th>
                      <th className="text-center py-3 px-3 font-semibold text-slate-700">Semantic</th>
                      <th className="text-center py-3 px-3 font-semibold text-slate-700">Exp</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">Matched</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">Missing</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">Reasoning</th>
                    </tr>
                  </thead>

                  <tbody>
                    {result.ranking?.length ? (
                      result.ranking.map((c) => (
                        <tr
                          key={`${c.rank}-${c.file_name}`}
                          className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-3 px-3 font-bold text-slate-900">#{c.rank}</td>

                          <td className="py-3 px-3 text-slate-800 truncate max-w-xs">
                            {c.file_name}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-700 min-w-12">
                              {getScore(c)}%
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="text-slate-600 text-xs font-medium">
                              {getSemantic(c).toFixed(1)}%
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="text-slate-600 text-xs font-medium">
                              {getExpScore(c)}%
                            </span>
                          </td>

                          <td className="py-3 px-3 text-slate-700 text-xs">
                            {getMatched(c).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {getMatched(c).map((skill, idx) => (
                                  <span
                                    key={idx}
                                    className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-medium"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-slate-700 text-xs">
                            {getMissing(c).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {getMissing(c).map((skill, idx) => (
                                  <span
                                    key={idx}
                                    className="bg-rose-50 text-rose-700 px-2 py-1 rounded text-xs font-medium"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-slate-700 text-xs max-w-sm truncate">
                            {c.reasoning || 'Analyzed'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-4 text-center text-slate-500">
                          No results
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
