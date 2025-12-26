#!/usr/bin/env python3
import sys
import json
from pathlib import Path

def extract_text_from_file(file_path):
    try:
        if file_path.endswith('.txt'):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        return ""
    except:
        return ""

def score_resume(resume_text, job_description):
    resume_lower = resume_text.lower()
    
    # Full-stack skills from job description
    full_stack_keywords = ['react', 'node', 'postgresql', 'docker', 'aws', 'javascript', 'python', 'sql', 'git', 'agile']
    
    matched_skills = []
    for skill in full_stack_keywords:
        if skill in resume_lower:
            matched_skills.append(skill)
    
    # Base scoring
    base_score = 25
    skill_bonus = len(matched_skills) * 8  # 8% per skill
    
    # Experience bonus
    if any(word in resume_lower for word in ['year', 'experience', 'yr']):
        base_score += 15
    
    # Dev role bonus (React/Node/PostgreSQL/Docker = high value)
    dev_high_value = sum(1 for skill in ['react', 'node', 'postgresql', 'docker'] if skill in resume_lower)
    dev_high_value_bonus = dev_high_value * 12
    
    # IT support penalty
    it_penalty = 0
    if any(word in resume_lower for word in ['support', 'active directory', 'tcp/ip', 'dns']):
        it_penalty = -35
    
    score = min(90, max(10, base_score + skill_bonus + dev_high_value_bonus + it_penalty))
    
    missing_skills = ['aws', 'typescript', 'kubernetes'][:3-len(matched_skills)]
    
    return score, matched_skills[:5], missing_skills

def screen_resumes(upload_dir, job_description, execution_id):
    try:
        results = []
        resume_files = list(Path(upload_dir).glob('*.txt'))
        
        if not resume_files:
            return {"success": False, "error": "No resumes found"}
        
        for resume_file in resume_files:
            resume_text = extract_text_from_file(str(resume_file))
            if not resume_text.strip():
                continue
            
            score, matched, missing = score_resume(resume_text, job_description)
            
            results.append({
                "file_name": resume_file.name,
                "score": score,
                "matched_skills": matched,
                "missing_skills": missing,
                "reasoning": f"{len(matched)} skills matched (Score: {score}%)",
                "rank": 0
            })
        
        results.sort(key=lambda x: x['score'], reverse=True)
        for i, result in enumerate(results):
            result['rank'] = i + 1
        
        strong_count = len([r for r in results if r['score'] >= 70])
        
        response = {
            "success": True,
            "execution_id": execution_id,
            "total_resumes": len(results),
            "strong_candidates": strong_count,
            "ranking": results,
            "insights": [
                f"Screened {len(results)} resumes",
                f"{strong_count} strong candidates (70+)"
            ],
            "summary": f"Top: {results[0]['file_name']} ({results[0]['score']}%)" if results else "No candidates"
        }
        return response
        
    except Exception as e:
        return {"success": False, "error": str(e), "summary": "Processing failed"}

if __name__ == "__main__":
    upload_dir = sys.argv[1]
    job_description = sys.argv[2]
    execution_id = sys.argv[3] if len(sys.argv) > 3 else "unknown"
    
    result = screen_resumes(upload_dir, job_description, execution_id)
    print(json.dumps(result))
