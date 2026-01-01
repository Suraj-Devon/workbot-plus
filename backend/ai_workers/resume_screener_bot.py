#!/usr/bin/env python3
import sys
import json
import re
import nltk
from pathlib import Path
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


# ---------- File loading ----------

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


# ---------- Core feature logic (from notebook) ----------

def estimate_experience_months(text: str) -> int:
    text = text.lower()
    months = 0

    year_match = re.search(r"(\d+)\s*(?:years?|yrs?)", text)
    if year_match:
        months += int(year_match.group(1)) * 12

    month_match = re.search(r"(\d+)\s*(?:months?|mos?)", text)
    if month_match:
        months += int(month_match.group(1))

    return months


# Extended stopwords for JD tokens (removes generic words like "required", "experience"). [web:277]
JD_STOPWORDS = {
    "and", "the", "for", "with", "from", "that", "this", "have", "able", "will",
    "required", "requirement", "requirements", "must", "should", "strong",
    "good", "excellent", "skills", "skill", "experience", "experiences", "exp",
    "year", "years", "yr", "yrs", "working", "work", "job", "role", "responsibilities",
    "looking", "hiring", "candidate", "candidates", "ability", "proven", "etc",
    "hands", "on", "hands-on"
}


def jd_resume_features(job_desc: str, resume_text: str) -> dict:
    jd = job_desc.lower()
    res = resume_text.lower()

    # Tokens (simple alphabetic tokens)
    jd_tokens = set(re.findall(r"\b[a-z]{3,}\b", jd))
    res_tokens = set(re.findall(r"\b[a-z]{3,}\b", res))

    common_tokens = jd_tokens & res_tokens
    overlap_ratio = len(common_tokens) / max(1, len(jd_tokens))

    # Important JD words (JD-driven skills)
    jd_keywords = [
        t for t in jd_tokens
        if len(t) > 2 and t not in JD_STOPWORDS
    ]
    keyword_hits = sum(1 for t in jd_keywords if t in res_tokens)

    # Experience
    exp_months = estimate_experience_months(res)

    # Education
    has_degree = bool(
        re.search(
            r"\b(bachelor|master|b\.tech|btech|mca|bca|bsc|msc|bba|mba|diploma|degree)\b",
            res,
        )
    )
    education_score = 1 if has_degree else 0

    # Projects / achievements
    project_mentions = len(
        re.findall(
            r"\b(project|projects|built|developed|created|led|managed|implemented)\b",
            res,
        )
    )

    return {
        "jd_tokens": jd_tokens,
        "res_tokens": res_tokens,
        "jd_keywords": jd_keywords,
        "overlap_ratio": overlap_ratio,      # 0–1
        "keyword_hits": keyword_hits,        # 0+
        "exp_months": exp_months,            # 0+
        "education_score": education_score,  # 0/1
        "project_mentions": project_mentions # 0+
    }


def compute_match_score(job_desc: str, resume_text: str) -> dict:
    feats = jd_resume_features(job_desc, resume_text)

    # Normalize pieces
    exp_score = min(feats["exp_months"] / 36, 1.0)          # 3 years -> full exp
    overlap_score = feats["overlap_ratio"]                  # already 0–1
    keyword_score = min(feats["keyword_hits"] / 10, 1.0)    # cap at 10 keywords
    project_score = min(feats["project_mentions"] / 5, 1.0) # cap at 5
    edu_score = feats["education_score"]                    # 0 or 1

    # Weighting (same as notebook)
    final = (
        0.30 * overlap_score +
        0.20 * keyword_score +
        0.25 * exp_score +
        0.15 * project_score +
        0.10 * edu_score
    )

    score_0_100 = round(final * 100, 1)

    # Reasons
    reasons = []
    if exp_score > 0.6:
        reasons.append(f"Solid experience (~{feats['exp_months']} months).")
    elif exp_score > 0.2:
        reasons.append(f"Some relevant experience (~{feats['exp_months']} months).")
    else:
        reasons.append("Little or no explicit experience mentioned.")

    if overlap_score > 0.5:
        reasons.append("Resume matches many terms from the job description.")
    elif overlap_score > 0.25:
        reasons.append("Moderate alignment with job description keywords.")
    else:
        reasons.append("Low keyword overlap with the job description.")

    if project_score > 0.4:
        reasons.append("Good number of projects/achievements listed.")
    elif project_score == 0:
        reasons.append("Few or no projects explicitly described.")

    if edu_score == 1:
        reasons.append("Relevant degree or education mentioned.")

    # JD skills for Matched / Missing columns
    # Use jd_keywords already filtered by JD_STOPWORDS, and
    # only keep up to 10 distinct tokens.
    jd_skills = list(dict.fromkeys(feats["jd_keywords"]))[:10]
    matched = [s for s in jd_skills if s in feats["res_tokens"]][:5]
    missing = [s for s in jd_skills if s not in feats["res_tokens"]][:5]

    return {
        "score": score_0_100,
        "features": feats,
        "reasons": reasons,
        "matched": matched,
        "missing": missing,
        "overlap_ratio": overlap_score,
        "exp_months": feats["exp_months"],
    }


# ---------- Adapter used by your app ----------

def score_resume_ml(resume_text: str, job_desc: str) -> dict:
    """
    Adapter so the rest of the code (screen_resumes + frontend) can stay the same.
    """
    result = compute_match_score(job_desc, resume_text)

    overall_score = int(result["score"])

    # Map features into the fields your frontend expects
    semantic_similarity = float(result["overlap_ratio"] * 100.0)  # use overlap as "semantic"
    exp_months = result["exp_months"]
    # simple exp_score 0–100 relative to 36 months
    exp_score = int(min(exp_months / 36.0, 1.0) * 100)

    return {
        "overall_score": overall_score,
        "semantic_similarity": semantic_similarity,
        "exp_score": exp_score,
        "matched_must": result["matched"],
        "missing_must": result["missing"],
        "reasoning": " ".join(result["reasons"]),
        "total_exp": float(exp_months / 12.0),  # years, for info only
    }


# ---------- Main screening ----------

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
                f"AI screened {len(results)} resumes using JD keyword overlap + rules",
                f"Avg JD keyword overlap: {avg_sem:.0f}%",
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
