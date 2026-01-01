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

# NLTK data
try:
    nltk.data.find("tokenizers/punkt")
except LookupError:
    nltk.download("punkt", quiet=True)
try:
    nltk.data.find("corpora/stopwords")
except LookupError:
    nltk.download("stopwords", quiet=True)


def extract_text_from_file(file_path: str) -> str:
    try:
        if file_path.endswith(".txt"):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        elif file_path.endswith(".pdf"):
            import PyPDF2
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                return " ".join([page.extract_text() or "" for page in reader.pages])
        return ""
    except Exception:
        return ""


def parse_job_requirements(job_desc: str) -> dict:
    jd_lower = job_desc.lower()

    must_haves = []
    must_patterns = [
        r"(?:required|must have|must-have|essential).*?([a-zA-Z\s/,+]+?)(?:\.|;|\n|$)",
        r"requirements?:\s*([a-zA-Z0-9\s/,+-]+)(?:\.|;|\n|$)",
    ]
    for pattern in must_patterns:
        matches = re.findall(pattern, jd_lower, re.IGNORECASE)
        for match in matches:
            tokens = [s.strip() for s in re.split(r"[,/]", match) if len(s.strip()) > 2]
            must_haves.extend(tokens)

    years_patterns = [
        r"(\d+)\s*(?:\+?\s*)?(?:years?|yrs?)\s+(?:of\s+)?experience",
        r"(?:experience|exp).*?(\d+)\s*(?:years?|yrs?)",
    ]
    min_years = 0
    for pattern in years_patterns:
        match = re.search(pattern, jd_lower)
        if match:
            min_years = max(min_years, int(match.group(1)))

    nice_haves = []
    nice_patterns = [
        r"(?:nice to have|preferred|bonus).*?([a-zA-Z\s/,+]+?)(?:\.|;|\n|$)",
    ]
    for pattern in nice_patterns:
        matches = re.findall(pattern, jd_lower, re.IGNORECASE)
        for match in matches:
            tokens = [s.strip() for s in re.split(r"[,/]", match) if len(s.strip()) > 2]
            nice_haves.extend(tokens)

    return {
        "must_haves": list(dict.fromkeys(must_haves))[:8],
        "nice_haves": list(dict.fromkeys(nice_haves))[:8],
        "min_years": min_years,
    }


def extract_resume_experience(resume_text: str) -> dict:
    exp_dict = {}
    patterns = [
        r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:of\s+)?experience\s+(?:in|with)?\s*([a-zA-Z]+(?:\s[a-zA-Z]+)?)",
        r"([a-zA-Z]+(?:\s[a-zA-Z]+)?)\s+(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:experience)?",
    ]
    resume_lower = resume_text.lower()
    for pattern in patterns:
        matches = re.finditer(pattern, resume_lower, re.IGNORECASE)
        for match in matches:
            try:
                first = match.group(1).strip().lower()
                second = match.group(2).strip().lower()
                if re.match(r"\d", first):
                    years = float(first)
                    skill = second
                else:
                    skill = first
                    years = float(second)
                if len(skill) > 2:
                    exp_dict[skill] = max(exp_dict.get(skill, 0.0), years)
            except (IndexError, ValueError):
                continue
    return exp_dict


def clean_text_basic(text: str) -> str:
    stop_words = set(stopwords.words("english"))
    tokens = word_tokenize(text.lower())
    return " ".join([t for t in tokens if t.isalpha() and t not in stop_words and len(t) > 2])


def score_resume_ml(resume_text: str, job_desc: str) -> dict:
    resume_clean = clean_text_basic(resume_text)
    jd_clean = clean_text_basic(job_desc)

    if len(jd_clean.split()) < 3 or len(resume_clean.split()) < 3:
        semantic_sim = 0.0
    else:
        vectorizer = TfidfVectorizer(max_features=800, ngram_range=(1, 2))
        tfidf_matrix = vectorizer.fit_transform([jd_clean, resume_clean])
        semantic_sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]

    jd_reqs = parse_job_requirements(job_desc)
    resume_exp = extract_resume_experience(resume_text)

    total_exp = sum(resume_exp.values())
    if jd_reqs["min_years"] > 0:
        exp_ratio = min(total_exp / jd_reqs["min_years"], 1.5)
        exp_score = int(70 * exp_ratio)
    else:
        exp_score = int(min(total_exp, 3.0) / 3.0 * 70)

    resume_lower = resume_text.lower()
    matched_must = [req for req in jd_reqs["must_haves"] if req and req.lower() in resume_lower]
    missing_must = [req for req in jd_reqs["must_haves"] if req and req.lower() not in resume_lower]

    must_score = min(len(matched_must) * 20, 60)

    overall_score = (
        semantic_sim * 100 * 0.55
        + exp_score * 0.25
        + must_score * 0.20
    )
    overall_score = int(max(0, min(100, overall_score)))

    reasoning_parts = []
    reasoning_parts.append(f"Semantic match: {semantic_sim:.1%}")
    if jd_reqs["min_years"] > 0:
        reasoning_parts.append(f"Experience: {total_exp:.1f} years (JD asks {jd_reqs['min_years']}+)")
    else:
        reasoning_parts.append(f"Experience: {total_exp:.1f} years (no strict min in JD)")
    if matched_must:
        reasoning_parts.append("Matched must‑have: " + ", ".join(matched_must[:3]))
    if missing_must:
        reasoning_parts.append("Missing: " + ", ".join(missing_must[:2]))

    if missing_must and jd_reqs["min_years"] > 0 and total_exp < jd_reqs["min_years"] * 0.6:
        overall_score = min(overall_score, 70)

    return {
        "overall_score": overall_score,
        "semantic_similarity": float(semantic_sim * 100),
        "exp_score": int(exp_score),
        "matched_must": matched_must[:5],
        "missing_must": missing_must[:5],
        "reasoning": "; ".join(reasoning_parts),
        "total_exp": float(total_exp),
    }


def screen_resumes(upload_dir: str, job_description: str, execution_id: str) -> dict:
    try:
        results = []
        resume_files = list(Path(upload_dir).glob("*.[tp]df")) + list(Path(upload_dir).glob("*.txt"))

        if not resume_files:
            return {"success": False, "error": "No resumes found"}

        for resume_file in resume_files[:100]:
            resume_text = extract_text_from_file(str(resume_file))
            if len(resume_text.strip()) < 50:
                continue

            scores = score_resume_ml(resume_text, job_description)

            results.append(
                {
                    "file_name": resume_file.name,
                    "overall_score": scores["overall_score"],
                    "semantic_similarity": round(scores["semantic_similarity"], 1),
                    "exp_score": scores["exp_score"],
                    "matched_must": scores["matched_must"],
                    "missing_must": scores["missing_must"],
                    "reasoning": scores["reasoning"],
                    "rank": 0,
                }
            )

        if not results:
            return {
                "success": True,
                "total_resumes": 0,
                "strong_candidates": 0,
                "ranking": [],
                "summary": "No valid resumes found",
            }

        results.sort(key=lambda x: x["overall_score"], reverse=True)
        for i, result in enumerate(results):
            result["rank"] = i + 1

        strong_count = len([r for r in results if r["overall_score"] >= 75])

        avg_sem = float(np.mean([r["semantic_similarity"] for r in results]))

        response = {
            "success": True,
            "execution_id": execution_id,
            "total_resumes": len(results),
            "strong_candidates": strong_count,
            "ranking": results[:25],
            "insights": [
                f"AI screened {len(results)} resumes using TF‑IDF semantic match + rules",
                f"Avg semantic match: {avg_sem:.0f}%",
            ],
            "summary": f"Top: {results[0]['file_name']} ({results[0]['overall_score']}%) - {results[0]['reasoning']}",
        }
        return response

    except Exception as e:
        import traceback

        return {
            "success": False,
            "error": str(e),
            "summary": traceback.format_exc()[:200],
        }


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing args: upload_dir job_description [execution_id]"}))
        sys.exit(1)

    upload_dir = sys.argv[1]
    job_description = sys.argv[2]
    execution_id = sys.argv[3] if len(sys.argv) > 3 else "unknown"

    result = screen_resumes(upload_dir, job_description, execution_id)
    print(json.dumps(result))
