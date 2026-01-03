#!/usr/bin/env python3
import sys
import json
import re
import os
from pathlib import Path
from datetime import datetime

import numpy as np

import nltk
from nltk.corpus import stopwords

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from rake_nltk import Rake


# ---------------- Config (safe defaults) ----------------
MAX_RESUMES = int(os.getenv("MAX_RESUMES", "300"))
TOP_N_RANKING = int(os.getenv("TOP_N_RANKING", "25"))
MIN_RESUME_CHARS = int(os.getenv("MIN_RESUME_CHARS", "50"))

# Optional knobs
JD_SKILL_TOP_K = int(os.getenv("JD_SKILL_TOP_K", "25"))
JD_SKILL_DENOM_CAP = int(os.getenv("JD_SKILL_DENOM_CAP", "10"))  # score considers up to 10 JD skills
MAX_MONTHS_CAP = int(os.getenv("MAX_MONTHS_CAP", "480"))


# ---------------- NLTK bootstrap (stopwords only) ----------------
try:
    nltk.data.find("corpora/stopwords")
except LookupError:
    nltk.download("stopwords", quiet=True)


# ---------------- File extraction ----------------
def extract_text_from_file(file_path: str) -> str:
    p = (file_path or "").lower()
    try:
        if p.endswith(".txt"):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read() or ""

        if p.endswith(".docx"):
            import docx
            d = docx.Document(file_path)
            return "\n".join([para.text for para in d.paragraphs if para.text]) or ""

        if p.endswith(".pdf"):
            # Fallback chain: PyMuPDF -> pdfplumber -> PyPDF2
            try:
                import fitz  # PyMuPDF
                doc = fitz.open(file_path)
                out = []
                for page in doc:
                    out.append(page.get_text("text") or "")
                text = "\n".join(out).strip()
                if len(text) >= 20:
                    return text
            except Exception:
                pass

            try:
                import pdfplumber
                out = []
                with pdfplumber.open(file_path) as pdf:
                    for page in pdf.pages:
                        out.append(page.extract_text() or "")
                text = "\n".join(out).strip()
                if len(text) >= 20:
                    return text
            except Exception:
                pass

            try:
                import PyPDF2
                with open(file_path, "rb") as f:
                    reader = PyPDF2.PdfReader(f)
                    out = []
                    for page in reader.pages:
                        out.append(page.extract_text() or "")
                return "\n".join(out).strip()
            except Exception:
                return ""

        return ""
    except Exception:
        return ""


# ---------------- Normalization ----------------
def normalize_text(t: str) -> str:
    t = (t or "").lower()

    # normalize common variants
    t = re.sub(r"\bpower\s*bi\b", "power bi", t)
    t = re.sub(r"\bms\s*excel\b", "excel", t)
    t = re.sub(r"\bmicrosoft\s*excel\b", "excel", t)
    t = re.sub(r"\bpostgre\s*sql\b", "postgresql", t)
    t = re.sub(r"\bpostgre\b", "postgresql", t)
    t = re.sub(r"\bsql\s*server\b", "sql server", t)

    t = re.sub(r"\bnode\.?\s*js\b", "node js", t)
    t = re.sub(r"\breact\.?\s*js\b", "react js", t)
    t = re.sub(r"\brest\s*api(s)?\b", "rest api", t)
    t = re.sub(r"\bfull[-\s]*stack\b", "full stack", t)

    # normalize dashes
    t = re.sub(r"[\u2010\u2011\u2012\u2013\u2014]", "-", t)

    # collapse whitespace
    t = re.sub(r"\s+", " ", t).strip()
    return t


def phrase_in_text(phrase: str, text_norm: str) -> bool:
    pattern = r"(?<!\w)" + re.escape(phrase) + r"(?!\w)"
    return re.search(pattern, text_norm) is not None


# ---------------- RAKE tokenizers (NO punkt dependency) ----------------
def simple_sentence_tokenizer(text: str):
    parts = re.split(r"[.!?\n\r]+", text)
    return [p.strip() for p in parts if p and p.strip()]


def simple_word_tokenizer(sentence: str):
    return re.findall(r"[a-z0-9][a-z0-9+\-#]*", sentence.lower())


# ---------------- Stopwords ----------------
def build_stopwords():
    base = set(stopwords.words("english"))
    domain = {
        "required", "requirements", "requirement", "must", "should", "nice", "preferred", "bonus", "plus",
        "strong", "good", "excellent",
        "experience", "experiences", "exp", "year", "years", "yrs", "yr", "month", "months",
        "skill", "skills",
        "responsibility", "responsibilities",
        "looking", "hiring", "candidate", "candidates", "role", "job",
        "using", "use", "used", "create", "created", "creating", "develop", "developed", "developing",
        "analyze", "analyzing", "analysis", "work", "working", "manage", "managed", "managing",
        "ability", "able",
        "summary", "objective", "profile", "education", "projects", "project", "certification", "certifications",
        "contact", "email", "phone", "address"
    }
    return base.union(domain)


STOP_ALL = build_stopwords()


# ---------------- Canonical skill patterns ----------------
SKILL_PATTERNS = {
    "excel": r"\bexcel\b",
    "sql": r"\bsql\b",
    "power bi": r"\bpower\s*bi\b",
    "tableau": r"\btableau\b",
    "python": r"\bpython\b",
    "pandas": r"\bpandas\b",
    "numpy": r"\bnumpy\b",
    "data cleaning": r"\bdata\s*clean(ing)?\b",
    "dashboard": r"\bdashboard(s)?\b",
    "a/b testing": r"\ba\/b\s*test(ing)?\b|\bab\s*test(ing)?\b",
    "experiments": r"\bexperiment(s)?\b",
    "etl": r"\betl\b",
    "bigquery": r"\bbigquery\b|\bgoogle\s*bigquery\b",
    "sql server": r"\bsql\s*server\b|\bssrs\b",
}


def _match_canonical(skill: str, text_norm: str) -> bool:
    pat = SKILL_PATTERNS.get(skill)
    if not pat:
        return phrase_in_text(skill, text_norm)
    return re.search(pat, text_norm) is not None


def _extract_canonical_from_text(text_norm: str) -> list[str]:
    out = []
    for s, pat in SKILL_PATTERNS.items():
        if re.search(pat, text_norm):
            out.append(s)
    return out


def _clean_skill(s: str) -> str:
    s = normalize_text(s)
    s = re.sub(r"[^a-z0-9+\-# ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    # remove useless numeric-only tokens
    if not s or re.fullmatch(r"\d+", s):
        return ""
    return s


def _expand_phrase_into_skills(phrase: str) -> list[str]:
    phrase = _clean_skill(phrase)
    if not phrase:
        return []

    # drop “data analyst 2” style artifacts
    if re.search(r"\bdata\s+analyst\b", phrase) and re.search(r"\b\d+\b", phrase):
        phrase = re.sub(r"\b\d+\b", "", phrase).strip()

    # split on separators
    parts = re.split(r"\s*(?:,|/|&|\band\b|\bor\b|\(|\)|:|;|\||\+)\s*", phrase)
    parts = [p.strip() for p in parts if p and p.strip()]

    out = []
    for p in parts:
        p = _clean_skill(p)
        if not p:
            continue
        out.append(p)

    # If phrase still contains multiple known canonicals, extract them too
    canonicals = []
    for s in SKILL_PATTERNS.keys():
        if s in phrase:
            canonicals.append(s)

    # de-dupe while preserving order
    merged = []
    seen = set()
    for x in canonicals + out + [phrase]:
        x = _clean_skill(x)
        if not x or x in seen:
            continue
        # avoid very generic junk terms
        if x in {"data", "analyst", "years", "experience"}:
            continue
        merged.append(x)
        seen.add(x)

    return merged


# ---------------- JD skill extraction ----------------
def extract_jd_skills(job_desc: str, vectorizer: TfidfVectorizer, top_k: int = 25) -> list[str]:
    jd_norm = normalize_text(job_desc)

    # 1) deterministic “canonical” skills from JD
    seed = _extract_canonical_from_text(jd_norm)

    # 2) RAKE phrases (good for multi-word keywords)
    rake = Rake(
        stopwords=list(STOP_ALL),
        min_length=1,
        max_length=4,
        include_repeated_phrases=False,
        sentence_tokenizer=simple_sentence_tokenizer,
        word_tokenizer=simple_word_tokenizer,
    )
    rake.extract_keywords_from_text(jd_norm)
    rake_phrases = [p.strip() for p in rake.get_ranked_phrases() if len(p.strip()) >= 3]

    # 3) TF-IDF terms
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

    # Merge + expand phrases into matchable skills
    merged = []
    seen = set()

    for raw in seed + rake_phrases + tfidf_terms:
        for s in _expand_phrase_into_skills(raw):
            if not s or s in seen:
                continue
            # remove numeric-only and ultra-generic
            if re.fullmatch(r"\d+", s):
                continue
            merged.append(s)
            seen.add(s)
            if len(merged) >= top_k:
                break
        if len(merged) >= top_k:
            break

    return merged[:top_k]


# ---------------- Experience / signals ----------------
MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}


def _to_month_index(year: int, month: int) -> int:
    return year * 12 + month


def _parse_mm_yyyy(s: str):
    m = re.match(r"^\s*(\d{1,2})[/-](\d{4})\s*$", s)
    if not m:
        return None
    mm = int(m.group(1))
    yy = int(m.group(2))
    if 1 <= mm <= 12 and 1900 <= yy <= 2100:
        return (yy, mm)
    return None


def _parse_mon_yyyy(s: str):
    m = re.match(r"^\s*([a-zA-Z]{3,9})\s+(\d{4})\s*$", s)
    if not m:
        return None
    mon = m.group(1).lower()
    yy = int(m.group(2))
    if mon in MONTHS and 1900 <= yy <= 2100:
        return (yy, MONTHS[mon])
    return None


def estimate_experience_months(text_norm: str) -> int:
    # 1) detect explicit “X years/months”
    months = 0
    y = re.search(r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b", text_norm)
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:months?|mos?)\b", text_norm)

    if y:
        years = float(y.group(1))
        if 0 <= years <= 40:
            months = max(months, int(years * 12))
    if m:
        mm = float(m.group(1))
        if 0 <= mm <= 480:
            months = max(months, int(mm))

    # 2) date-range parsing (sum of ranges)
    # handles: 08/2021 - Present, 10/2019 – 07/2021, etc.
    ranges = []
    dash = r"(?:-|–|—|to)"
    present = r"(?:present|current|now)"
    pat = re.compile(
        rf"(\d{{1,2}}[/-]\d{{4}}|[a-z]{{3,9}}\s+\d{{4}})\s*{dash}\s*(\d{{1,2}}[/-]\d{{4}}|[a-z]{{3,9}}\s+\d{{4}}|{present})",
        re.IGNORECASE
    )

    now = datetime.utcnow()
    now_pair = (now.year, now.month)

    for a, b in pat.findall(text_norm):
        a = a.strip().lower()
        b = b.strip().lower()

        start = _parse_mm_yyyy(a) or _parse_mon_yyyy(a)
        if not start:
            continue

        if re.fullmatch(present, b, flags=re.IGNORECASE):
            end = now_pair
        else:
            end = _parse_mm_yyyy(b) or _parse_mon_yyyy(b)

        if not end:
            continue

        s_idx = _to_month_index(start[0], start[1])
        e_idx = _to_month_index(end[0], end[1])
        if e_idx >= s_idx:
            ranges.append(e_idx - s_idx + 1)

    if ranges:
        months = max(months, int(sum(ranges)))

    return int(min(max(months, 0), MAX_MONTHS_CAP))


def education_score(text_norm: str) -> int:
    return 1 if re.search(
        r"\b(bachelor|master|b\.tech|btech|mba|mca|bca|bsc|msc|diploma|degree)\b",
        text_norm
    ) else 0


def project_mentions(text_norm: str) -> int:
    c = len(re.findall(r"\b(project|projects|built|developed|created|led|implemented)\b", text_norm))
    return int(min(c, 30))


# ---------------- Core scoring ----------------
def compute_candidate(job_desc: str, resume_text_norm: str, vectorizer: TfidfVectorizer, jd_skills: list[str]) -> dict:
    matched = []
    missing = []

    for s in jd_skills:
        if _match_canonical(s, resume_text_norm):
            matched.append(s)
        else:
            missing.append(s)

    denom = max(1, min(len(jd_skills), JD_SKILL_DENOM_CAP))
    coverage = len(matched[:denom]) / denom

    jd_norm = normalize_text(job_desc)
    M = vectorizer.transform([jd_norm, resume_text_norm])
    sem = float(cosine_similarity(M[0], M[1])[0][0]) if M.shape[1] else 0.0

    exp_m_raw = estimate_experience_months(resume_text_norm)
    exp_score_raw = min(exp_m_raw / 36.0, 1.0)

    relevance = max(coverage, sem)
    relevance = min(1.0, max(0.0, relevance))
    exp_score = exp_score_raw * relevance

    proj_score = min(project_mentions(resume_text_norm) / 5.0, 1.0)
    edu = education_score(resume_text_norm)

    final = (
        0.45 * coverage +
        0.30 * sem +
        0.18 * exp_score +
        0.05 * proj_score +
        0.02 * edu
    )
    score = round(final * 100, 1)

    matched_top = matched[:8]
    missing_top = missing[:8]

    reasons = [
        f"Skills: {round(coverage*100,1)}% ({len(matched[:denom])}/{denom} JD skills).",
        f"Semantic: {round(sem*100,1)}%.",
        f"Experience: ~{exp_m_raw} months (relevance-adjusted: {int(round(exp_score*100))}%).",
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
        upload_path = Path(upload_dir)

        allowed = {".pdf", ".txt", ".docx"}
        resume_files = [p for p in upload_path.iterdir() if p.is_file() and p.suffix.lower() in allowed]
        resume_files.sort(key=lambda p: p.name.lower())

        files_found = len(resume_files)
        if not resume_files:
            return {"success": False, "error": "No resumes found"}

        resume_files = resume_files[:max(1, MAX_RESUMES)]
        files_considered = len(resume_files)

        resumes = []
        skipped = []
        for resume_file in resume_files:
            text = extract_text_from_file(str(resume_file))
            if len((text or "").strip()) < MIN_RESUME_CHARS:
                skipped.append(resume_file.name)
                continue
            resumes.append((resume_file.name, normalize_text(text)))

        if not resumes:
            return {
                "success": True,
                "execution_id": execution_id,
                "total_resumes": 0,
                "strong_candidates": 0,
                "strong_threshold": 70,
                "ranking": [],
                "insights": [
                    "No valid resumes found (all were empty/unreadable after extraction).",
                    f"Files found: {files_found}, considered: {files_considered}, skipped: {len(skipped)}.",
                    f"Skipped sample: {', '.join(skipped[:10])}" + (" ..." if len(skipped) > 10 else "")
                ],
                "summary": "No valid resumes found",
                "files_found": files_found,
                "files_considered": files_considered,
                "skipped_files_count": len(skipped),
            }

        vectorizer = TfidfVectorizer(
            lowercase=True,
            stop_words=list(STOP_ALL),
            ngram_range=(1, 4),
            min_df=1,
            max_df=0.85,
            max_features=30000,
            norm="l2",
        )
        vectorizer.fit([normalize_text(job_description)] + [t for _, t in resumes])

        jd_skills = extract_jd_skills(job_description, vectorizer, top_k=JD_SKILL_TOP_K)

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

        results.sort(key=lambda x: x["overall_score"], reverse=True)
        for i, r in enumerate(results):
            r["rank"] = i + 1

        scores = np.array([r["overall_score"] for r in results], dtype=float)
        p80 = float(np.quantile(scores, 0.80)) if len(scores) else 70.0
        strong_threshold = int(max(60, round(p80)))
        strong_count = int((scores >= strong_threshold).sum()) if len(scores) else 0

        avg_sem = float(np.mean([r["semantic_similarity"] for r in results])) if results else 0.0

        insights = [
            f"AI screened {len(results)} resumes using RAKE skill phrases + TF-IDF similarity.",
            f"Avg semantic match: {avg_sem:.0f}%.",
            f"Files found: {files_found}, considered: {files_considered}, skipped: {len(skipped)}.",
            f"JD skills extracted: {', '.join(jd_skills[:12])}" + (" ..." if len(jd_skills) > 12 else "")
        ]
        if skipped:
            insights.append(f"Skipped {len(skipped)} files (empty/unreadable text).")

        top_n = max(1, min(TOP_N_RANKING, len(results)))

        return {
            "success": True,
            "execution_id": execution_id,
            "total_resumes": len(results),
            "strong_candidates": strong_count,
            "strong_threshold": strong_threshold,
            "ranking": results[:top_n],
            "insights": insights,
            "summary": f"Top: {results[0]['file_name']} ({results[0]['overall_score']}%) - {results[0]['reasoning']}",
            "files_found": files_found,
            "files_considered": files_considered,
            "skipped_files_count": len(skipped),
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
