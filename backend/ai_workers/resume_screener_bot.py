#!/usr/bin/env python3
import sys
import json
import re
import nltk
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords

# Download NLTK data (one-time, silent)
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)

def extract_text_from_file(file_path):
    try:
        if file_path.endswith('.txt'):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        elif file_path.endswith('.pdf'):
            import PyPDF2
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                return ' '.join([page.extract_text() or '' for page in reader.pages])
        return ""
    except Exception:
        return ""

def parse_job_requirements(job_desc):
    """Extract structured requirements from JD"""
    jd_lower = job_desc.lower()
    
    # Must-haves: "required", "must have", "essential"
    must_haves = []
    must_patterns = [
        r'(?:required|must have|essential).*?([a-zA-Z\s/]+?)(?:\W+(?:exp|skill|or|$))',
        r'req.*?([a-zA-Z\s/]+?)(?:\W+(?:exp|skill|or|$))'
    ]
    for pattern in must_patterns:
        matches = re.findall(pattern, jd_lower, re.IGNORECASE)
        for match in matches:
            must_haves.extend([s.strip() for s in match.split() if len(s) > 2])
    
    # Experience requirement
    years_patterns = [r'(\d+)\s*(?:year|yr)s?', r'(?:experience|exp).*?(\d+)']
    min_years = 0
    for pattern in years_patterns:
        match = re.search(pattern, jd_lower)
        if match:
            min_years = max(min_years, int(match.group(1)))
    
    # Nice-to-haves
    nice_haves = []
    nice_patterns = [r'(?:nice to have|preferred|bonus).*?([a-zA-Z\s/]+?)(?=\W+or|\W*$)']
    for pattern in nice_patterns:
        matches = re.findall(pattern, jd_lower, re.IGNORECASE)
        for match in matches:
            nice_haves.extend([s.strip() for s in match.split() if len(s) > 2])
    
    return {
        'must_haves': list(set(must_haves))[:5],  # Dedupe top 5
        'nice_haves': list(set(nice_haves))[:5],
        'min_years': min_years
    }

def extract_resume_experience(resume_text):
    """Extract skills + years from resume"""
    exp_dict = {}
    patterns = [
        r'(\d+(?:\.\d+)?)\s*(?:years?|yrs?|experience).*?([a-zA-Z]+(?:\s[a-zA-Z]+)?)',
        r'([a-zA-Z]+(?:\s[a-zA-Z]+)?).*?(\d+(?:\.\d+)?)\s*(?:years?|yrs?)',
    ]
    resume_lower = resume_text.lower()
    for pattern in patterns:
        matches = re.finditer(pattern, resume_lower, re.IGNORECASE)
        for match in matches:
            try:
                years = float(match.group(1))
                skill = match.group(2).strip().lower()
                if len(skill) > 2:
                    exp_dict[skill] = max(exp_dict.get(skill, 0), years)
            except (IndexError, ValueError):
                continue
    return exp_dict

def score_resume_ml(resume_text, job_desc):
    """Core ML semantic + rules scoring"""
    stop_words = stopwords.words('english')
    
    # Clean & tokenize
    def clean_text(text):
        tokens = word_tokenize(text.lower())
        return ' '.join([t for t in tokens if t not in stop_words and len(t) > 2])
    
    resume_clean = clean_text(resume_text)
    jd_clean = clean_text(job_desc)
    
    # TF-IDF semantic similarity (the magic)
    if len(jd_clean.split()) < 3 or len(resume_clean.split()) < 3:
        semantic_sim = 0.0
    else:
        vectorizer = TfidfVectorizer(max_features=500, ngram_range=(1,2))
        tfidf_matrix = vectorizer.fit_transform([jd_clean, resume_clean])
        semantic_sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
    
    # Parse requirements & experience
    jd_reqs = parse_job_requirements(job_desc)
    resume_exp = extract_resume_experience(resume_text)
    
    # Experience score
    total_exp = sum(resume_exp.values())
    exp_score = 0
    if jd_reqs['min_years'] > 0:
        exp_score = min(100, (total_exp / jd_reqs['min_years']) * 100)
    
    # Must-have keyword matches
    resume_lower = resume_text.lower()
    matched_must = [req for req in jd_reqs['must_haves'] if req.lower() in resume_lower]
    missing_must = [req for req in jd_reqs['must_haves'] if req.lower() not in resume_lower]
    must_score = len(matched_must) * 20
    
    # Overall weighted score
    overall_score = int((semantic_sim * 100 * 0.5) + (exp_score * 0.3) + must_score)
    
    # Reasoning
    reasoning_parts = [
        f"Semantic: {semantic_sim:.1%}",
        f"Exp: {total_exp:.1f}yr" + (f" (need {jd_reqs['min_years']}+)" if jd_reqs['min_years'] else "")
    ]
    if missing_must:
        reasoning_parts.append(f"Missing: {', '.join(missing_must[:2])}")
        overall_score = min(overall_score, 65)  # Knockout penalty
    
    return {
        'overall_score': max(0, min(100, overall_score)),
        'semantic_similarity': float(semantic_sim * 100),
        'exp_score': int(exp_score),
        'matched_must': matched_must[:3],
        'missing_must': missing_must[:3],
        'reasoning': '; '.join(reasoning_parts),
        'total_exp': float(total_exp)
    }

def screen_resumes(upload_dir, job_description, execution_id):
    try:
        results = []
        resume_files = list(Path(upload_dir).glob('*.[tp]df')) + list(Path(upload_dir).glob('*.txt'))
        
        if not resume_files:
            return {"success": False, "error": "No resumes found"}
        
        for resume_file in resume_files[:100]:  # Production limit
            resume_text = extract_text_from_file(str(resume_file))
            if len(resume_text.strip()) < 50:
                continue
            
            scores = score_resume_ml(resume_text, job_description)
            
            results.append({
                "file_name": resume_file.name,
                "overall_score": scores['overall_score'],
                "semantic_similarity": round(scores['semantic_similarity'], 1),
                "exp_score": scores['exp_score'],
                "matched_must": scores['matched_must'],
                "missing_must": scores['missing_must'],
                "reasoning": scores['reasoning'],
                "rank": 0
            })
        
        if not results:
            return {"success": True, "total_resumes": 0, "strong_candidates": 0, "ranking": [], "summary": "No valid resumes found"}
        
        results.sort(key=lambda x: x['overall_score'], reverse=True)
        for i, result in enumerate(results):
            result['rank'] = i + 1
        
        strong_count = len([r for r in results if r['overall_score'] >= 75])
        
        response = {
            "success": True,
            "execution_id": execution_id,
            "total_resumes": len(results),
            "strong_candidates": strong_count,
            "ranking": results[:25],  # Top 25 for UI
            "insights": [
                f"AI screened {len(results)} resumes (semantic ML + exp parsing)",
                f"Avg semantic match: {np.mean([r['semantic_similarity'] for r in results]):.0f}%"
            ],
            "summary": f"Top: {results[0]['file_name']} ({results[0]['overall_score']}%) - {results[0]['reasoning']}"
        }
        return response
        
    except Exception as e:
        import traceback
        return {"success": False, "error": str(e), "summary": traceback.format_exc()[:200]}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing args: upload_dir job_description [execution_id]"}))
        sys.exit(1)
    
    upload_dir = sys.argv[1]
    job_description = sys.argv[2]
    execution_id = sys.argv[3] if len(sys.argv) > 3 else "unknown"
    
    result = screen_resumes(upload_dir, job_description, execution_id)
    print(json.dumps(result))
