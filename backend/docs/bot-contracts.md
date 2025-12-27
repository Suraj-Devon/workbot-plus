Data Analyst Bot
POST /api/bots/data-analyst
Request: form-data: file (csv)
Response:
{
  success: boolean,
  message?: string,
  executionId: string,
  data: {
    summary: string,
    stats: any,
    insights: string[],
    // keep adding but never remove fields
  }
}

Resume Screener Bot
POST /api/bots/resume-screener
Request: form-data: files[], jobDescription (string)
Response:
{
  success: boolean,
  message?: string,
  executionId: string,
  data: {
    success: boolean,
    total_resumes: number,
    strong_candidates: number,
    ranking: RankedCandidate[],
    insights: string[],
    summary: string
  }
}
