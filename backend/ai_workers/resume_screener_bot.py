#!/usr/bin/env python3
import sys
import json
import os
from pathlib import Path

def extract_text_from_file(file_path):
    """
    Extract text from resume file (TXT, PDF support)
    """
    try:
        if file_path.endswith('.txt'):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        elif file_path.endswith('.pdf'):
            try:
                import PyPDF2
                with open(file_path, 'rb') as f:
                    reader = PyPDF2.PdfReader(f)
                    text = ""
                    for page in reader.pages:
                        text += page.extract_text()
                return text
            except:
                return ""
        else:
            return ""
    except:
        return ""

def score_resume(resume_text, job_description):
    """
    Score a resume against job description
    Returns: (score, matched_skills, missing_skills)
    """
    
    # Extract key skills from job description
    # Common tech skills
    tech_skills = [
        'python', 'javascript', 'java', 'c++', 'c#', 'ruby', 'php', 'go', 'rust',
        'react', 'node', 'django', 'flask', 'spring', 'express', 'vue', 'angular',
        'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform',
        'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
        'git', 'ci/cd', 'jenkins', 'gitlab', 'github',
        'agile', 'scrum', 'rest', 'graphql', 'microservices',
        'machine learning', 'ai', 'ml', 'nlp', 'computer vision',
        'sql', 'nosql', 'html', 'css', 'api', 'unix', 'linux'
    ]
    
    # Soft skills
    soft_skills = [
        'leadership', 'communication', 'teamwork', 'problem solving',
        'project management', 'analytical', 'creative', 'attention to detail',
        'customer service', 'collaboration'
    ]
    
    all_skills = tech_skills + soft_skills
    
    resume_lower = resume_text.lower()
    job_lower = job_description.lower()
    
    # Find required skills from job description
    required_skills = []
    for skill in all_skills:
        if skill in job_lower:
            required_skills.append(skill)
    
    # Score resume
    matched_skills = []
    for skill in required_skills:
        if skill in resume_lower:
            matched_skills.append(skill)
    
    missing_skills = [s for s in required_skills if s not in matched_skills]
    
    # Calculate score (0-100)
    if len(required_skills) == 0:
        score = 50  # Default if no recognized skills
    else:
        score = int((len(matched_skills) / len(required_skills)) * 70) + 15  # 15-85 range
    
    # Bonus points for experience keywords
    experience_keywords = ['years', 'experience', 'senior', 'lead', 'manager', 'director']
    for keyword in experience_keywords:
        if keyword in resume_lower:
            score = min(100, score + 5)
            break
    
    return score, matched_skills, missing_skills

def screen_resumes(upload_dir, job_description, execution_id):
    """
    Screen all resumes in directory
    """
    try:
        results = []
        resume_files = []
        
        # Find all resume files
        for ext in ['.txt', '.pdf']:
            resume_files.extend(list(Path(upload_dir).glob(f'*{ext}')))
        
        if not resume_files:
            return {
                "success": False,
                "error": "No resume files found",
                "summary": "No valid resume files uploaded"
            }
        
        # Score each resume
        for resume_file in resume_files:
            resume_text = extract_text_from_file(str(resume_file))
            
            if not resume_text:
                continue
            
            score, matched, missing = score_resume(resume_text, job_description)
            
            results.append({
                "file_name": resume_file.name,
                "score": score,
                "matched_skills": matched[:5],  # Top 5
                "missing_skills": missing[:3],  # Top 3 missing
                "reasoning": f"Found {len(matched)} required skills. Missing: {', '.join(missing[:2]) if missing else 'None'}"
            })
        
        # Sort by score
        results.sort(key=lambda x: x['score'], reverse=True)
        
        # Add rankings
        for i, result in enumerate(results):
            result['rank'] = i + 1
        
        # Generate summary
        top_candidates = results[:5]
        strong_count = len([r for r in results if r['score'] >= 70])
        
        insights = [
            f"Screened {len(results)} resumes",
            f"{strong_count} candidates with strong fit (70+)",
            f"Top candidate: {top_candidates[0]['file_name']} ({top_candidates[0]['score']}%)"
        ]
        
        response = {
            "success": True,
            "execution_id": execution_id,
            "total_resumes": len(results),
            "strong_candidates": strong_count,
            "ranking": results,
            "insights": insights,
            "summary": " | ".join(insights)
        }
        
        return response
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "summary": f"Screening failed: {str(e)}"
        }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments"}))
        sys.exit(1)
    
    upload_dir = sys.argv[1]
    job_description = sys.argv[2]
    execution_id = sys.argv[3] if len(sys.argv) > 3 else "unknown"
    
    result = screen_resumes(upload_dir, job_description, execution_id)
    print(json.dumps(result))
