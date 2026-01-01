#!/usr/bin/env python3
import sys
import json
import re
from pathlib import Path
import numpy as np

import nltk
from nltk.corpus import stopwords

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from rake_nltk import Rake


# ---------------- NLTK bootstrap ----------------
try:
    nltk.data.find("corpora/stopwords")
except LookupError:
    nltk.download("stopwords", quiet=True)


# ---------------- File extraction ----------------
def extract_text_from_file(file_path: str) -> str:
    try:
        p = file_path.lower()
        if p.endswith(".txt"):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()

        if p.endswith(".pdf"):
            import PyPDF2
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                return " ".join([(page.extract_text() or "") for page in reader.pages])

        if p.endswith(".docx"):
            import docx
            d = docx.Document(file_path)
            return "\n".join([para.text for para in d.paragraphs])

        return ""
    except Exception:
        return ""


# ---------------- Normalization (phrases + variants) ----------------
def normalize_text(t: str) -> str:
    t = (t or "").lower()

    # multiword skills normalization
    t = re.sub(r"\bpower\s*bi\b", "power bi", t)
    t = re.sub(r"\bnode\.?\s*js\b", "node js", t)
    t = re.sub(r"\breact\.?\s*js\b", "react js", t)
    t = re.sub(r"\brest\s*api(s)?\b", "rest api", t)
    t = re.sub(r"\bfull[-\s]*stack\b", "full stack", t)
    t = re.sub(r"\btalent\s*acquisition\b", "talent acquisition", t)
    t = re.sub(r"\bstakeholder\s*management\b", "stakeholder management", t)

    # normalize punctuation spacing
    t = re.sub(r"[\u2010\u2011\u2012\u2013\u2014]", "-", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def phrase_in_text(phrase: str, text_norm: str) -> bool:
    # strict boundary match: prevents 'sql' matching 'mysql'
    pattern = r"(?<!\w)" + re.escape(phrase) + r"(?!\w)"
    return re.search(pattern, text_norm) is not None


# ---------------- Experience / signals ----------------
def estimate_experience_months(text_norm: str) -> int:
    """
    Conservative: ignores absurd values to avoid phone numbers being mistaken for experience.
    """
    months = 0

    # allow decimals like 2.5 years
    y = re.search(r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b", text_norm)
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:months?|mos?)\b", text_norm)

    if y:
        years = float(y.group(1))
        if 0 <= years <= 40:   # guard
            months += int(years * 12)

    if m:
        mm = float(m.group(1))
        if 0 <= mm <= 480:     # guard
            months += int(mm)

    # cap to 40 years
    return int(min(max(months, 0), 480))


def education_score(text_norm: str) -> int:
    return 1 if re.search(
        r"\b(bachelor|master|b\.tech|btech|mba|mca|bca|bsc|msc|diploma|degree)\b",
        text_norm
    ) else 0


def project_mentions(text_norm: str) -> int:
    c = len(re.findall(r"\b(project|projects|built|developed|created|led|implemented)\b", text_norm))
    return int(min(c, 30))


# ---------------- JD skill extraction (RAKE + TF-IDF) ----------------
def build_stopwords():
    base = set(stopwords.words("english"))
    domain = {
        # JD boilerplate
        "required","requirements","requirement","must","should","nice","preferred","bonus","plus",
        "strong","good","excellent",
        # generic
        "experience","experiences","exp","year","years","yrs","yr","month","months",
        "skill","skills",
        "responsibility","responsibilities",
        "looking","hiring","candidate","candidates","role","job",
        # filler verbs
        "using","use","used","create","created","creating","develop","developed","developing",
        "analyze","analyzing","analysis","work","working","manage","managed","managing",
        "ability","able",
        # common section headers
        "summary","objective","profile","education","projects","project","certification","certifications",
        "contact","email","phone","address"
    }
    return base.union(domain)

STOP_ALL = build_stopwords()


def extract_jd_skills(job_desc: str, vectorizer: TfidfVectorizer, top_k: int = 25) -> list[str]:
    """
    1) RAKE phrases (good at multi-word keyphrases)
    2) TF-IDF top n-grams from the JD using a vectorizer fit on the resume batch
    3) Merge + clean; remove unigram parts when a bigram/trigram exists
    """
    jd_norm = normalize_text(job_desc)

    # RAKE
    rake = Rake(
        stopwords=list(STOP_ALL),
        min_length=1,
        max_length=4,
        include_repeated_phrases=False
    )
    rake.extract_keywords_from_text(jd_norm)
    rake_phrases = [p.strip() for p in rake.get_ranked_phrases() if len(p.strip()) >= 3]

    # TF-IDF terms
    v = vectorizer.transform([jd_norm])
    tfidf_terms = []
    if v.nnz > 0:
        vocab = np.array(vectorizer.get_feature_names_out())
        arr = v.toarray()[0]
        idx = np.argsort(arr)[::-1]
        for i in idx:
            if arr[i] <= 0:
                break
            term = vocab[i].strip()
            if len(term) >= 3:
                tfidf_terms.append(term)
            if len(tfidf_terms) >= top_k:
                break

    # Merge
    merged = []
    seen = set()
    for s in rake_phrases + tfidf_terms:
        s = s.strip()
        if not s or s in seen:
            continue
        if re.fullmatch(r"\d+", s):
            continue
        merged.append(s)
        seen.add(s)
        if len(merged) >= top_k:
            break

    # Remove noisy unigrams when multi-word versions exist
    multi = [s for s in merged if " " in s]
    multi_parts = set()
    for m in multi:
        for part in m.split():
            if part not in STOP_ALL:
                multi_parts.add(part)

    cleaned = []
    for s in merged:
        if " " not in s and s in multi_parts:
            # drop unigram if it's just part of a chosen phrase
            continue
        cleaned.append(s)

    return cleaned[:top_k]


# ---------------- Core scoring ----------------
def compute_candidate(job_desc: str, resume_text_norm: str, vectorizer: TfidfVectorizer, jd_skills: list[str]) -> dict:
    # skills match
    matched = []
    missing = []
    for s in jd_skills:
        if phrase_in_text(s, resume_text_norm):
            matched.append(s)
        else:
            missing.append(s)

    matched_top = matched[:8]
    missing_top = missing[:8]

    # coverage = matched among top 10 jd skills (not whole top_k)
    denom = max(1, min(len(jd_skills), 10))
    coverage = len(matched[:denom]) / denom  # 0..1

    # semantic = TF-IDF cosine similarity JD vs resume
    jd_norm = normalize_text(job_desc)
    M = vectorizer.transform([jd_norm, resume_text_norm])
    sem = float(cosine_similarity(M[0], M[1])[0][0]) if M.shape[1] else 0.0

    # other signals
    exp_m = estimate_experience_months(resume_text_norm)
    exp_score = min(exp_m / 36.0, 1.0)  # 3 years cap
    proj_score = min(project_mentions(resume_text_norm) / 5.0, 1.0)
    edu = education_score(resume_text_norm)

    # final score (0-100) — conservative and stable across JDs
    final = (
        0.40 * coverage +
        0.25 * sem +
        0.25 * exp_score +
        0.07 * proj_score +
        0.03 * edu
    )
    score = round(final * 100, 1)

    reasons = [
        f"Skills: {round(coverage*100,1)}% ({len(matched[:denom])}/{denom} JD skills).",
        f"Semantic: {round(sem*100,1)}%.",
        f"Experience: ~{exp_m} months.",
        f"Projects: {project_mentions(resume_text_norm)}.",
        f"Degree: {'Yes' if edu else 'No'}."
    ]

    return {
        "overall_score": int(round(score)),
        "semantic_similarity": round(sem * 100, 1),
        "exp_score": int(round(exp_score * 100)),
        "matched_must": matched_top,
        "missing_must": missing_top,
        "reasoning": " ".join(reasons),
    }


def screen_resumes(upload_dir: str, job_description: str, execution_id: str) -> dict:
    try:
        resume_files = list(Path(upload_dir).glob("*.[tp]df")) + list(Path(upload_dir).glob("*.txt")) + list(Path(upload_dir).glob("*.docx"))
        if not resume_files:
            return {"success": False, "error": "No resumes found"}

        # load texts
        resumes = []
        for resume_file in resume_files[:100]:
            text = extract_text_from_file(str(resume_file))
            if len(text.strip()) < 50:
                continue
            resumes.append((resume_file.name, normalize_text(text)))

        if not resumes:
            return {"success": True, "total_resumes": 0, "strong_candidates": 0, "ranking": [], "summary": "No valid resumes found"}

        # Fit TF-IDF on this batch (stable per request, no global state)
        vectorizer = TfidfVectorizer(
            lowercase=True,
            stop_words=list(STOP_ALL),
            ngram_range=(1, 3),
            min_df=1,
            max_df=0.90,
            max_features=40000,
            norm="l2"
        )
        vectorizer.fit([normalize_text(job_description)] + [t for _, t in resumes])

        jd_skills = extract_jd_skills(job_description, vectorizer, top_k=25)

        results = []
        for fname, text_norm in resumes:
            c = compute_candidate(job_description, text_norm, vectorizer, jd_skills)
            results.append({
                "file_name": fname,
                "overall_score": c["overall_score"],
                "semantic_similarity": c["semantic_similarity"],
                "exp_score": c["exp_score"],
                "matched_must": c["matched_must"],
                "missing_must": c["missing_must"],
                "reasoning": c["reasoning"],
                "rank": 0
            })

        # rank
        results.sort(key=lambda x: x["overall_score"], reverse=True)
        for i, r in enumerate(results):
            r["rank"] = i + 1

        # strong threshold: 80th percentile (top 20%) with a reasonable floor
        scores = np.array([r["overall_score"] for r in results], dtype=float)
        p80 = float(np.quantile(scores, 0.80))
        strong_threshold = int(max(60, round(p80)))  # never show "strong" too low
        strong_count = int((scores >= strong_threshold).sum())

        avg_sem = float(np.mean([r["semantic_similarity"] for r in results])) if results else 0.0

        return {
            "success": True,
            "execution_id": execution_id,
            "total_resumes": len(results),
            "strong_candidates": strong_count,
            "strong_threshold": strong_threshold,  # NEW (frontend can show)
            "ranking": results[:25],
            "insights": [
                f"AI screened {len(results)} resumes using RAKE skill phrases + TF‑IDF similarity",
                f"Avg semantic match: {avg_sem:.0f}%"
            ],
            "summary": f"Top: {results[0]['file_name']} ({results[0]['overall_score']}%) - {results[0]['reasoning']}"
        }

    except Exception as e:
        import traceback
        return {"success": False, "error": str(e), "summary": traceback.format_exc()[:400]}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing args: upload_dir job_description [execution_id]"}))
        sys.exit(1)

    upload_dir = sys.argv[1]
    job_description = sys.argv[2]
    execution_id = sys.argv[3] if len(sys.argv) > 3 else "unknown"

    result = screen_resumes(upload_dir, job_description, execution_id)
    print(json.dumps(result))
