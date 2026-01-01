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
            # Best-effort extraction with fallbacks
            # 1) PyMuPDF (fitz)
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

            # 2) pdfplumber (pdfminer.six based)
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

            # 3) PyPDF2
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

    t = re.sub(r"[\u2010\u2011\u2012\u2013\u2014]", "-", t)
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


# ---------------- Experience / signals ----------------
def estimate_experience_months(text_norm: str) -> int:
    months = 0

    y = re.search(r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b", text_norm)
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:months?|mos?)\b", text_norm)

    if y:
        years = float(y.group(1))
        if 0 <= years <= 40:
            months += int(years * 12)

    if m:
        mm = float(m.group(1))
        if 0 <= mm <= 480:
            months += int(mm)

    return int(min(max(months, 0), 480))


def education_score(text_norm: str) -> int:
    return 1 if re.search(
        r"\b(bachelor|master|b\.tech|btech|mba|mca|bca|bsc|msc|diploma|degree)\b",
        text_norm
    ) else 0


def project_mentions(text_norm: str) -> int:
    c = len(re.findall(r"\b(project|projects|built|developed|created|led|implemented)\b", text_norm))
    return int(min(c, 30))


# ---------------- Stopwords ----------------
def build_stopwords():
    base = set(stopwords.words("english"))
    domain = {
        "required","requirements","requirement","must","should","nice","preferred","bonus","plus",
        "strong","good","excellent",
        "experience","experiences","exp","year","years","yrs","yr","month","months",
        "skill","skills",
        "responsibility","responsibilities",
        "looking","hiring","candidate","candidates","role","job",
        "using","use","used","create","created","creating","develop","developed","developing",
        "analyze","analyzing","analysis","work","working","manage","managed","managing",
        "ability","able",
        "summary","objective","profile","education","projects","project","certification","certifications",
        "contact","email","phone","address"
    }
    return base.union(domain)


STOP_ALL = build_stopwords()


# ---------------- JD skill extraction (RAKE + TF-IDF) ----------------
def extract_jd_skills(job_desc: str, vectorizer: TfidfVectorizer, top_k: int = 25) -> list[str]:
    jd_norm = normalize_text(job_desc)

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

    multi = [s for s in merged if " " in s]
    multi_parts = set()
    for m in multi:
        for part in m.split():
            if part not in STOP_ALL:
                multi_parts.add(part)

    cleaned = []
    for s in merged:
        if " " not in s and s in multi_parts:
            continue
        cleaned.append(s)

    return cleaned[:top_k]


# ---------------- Core scoring ----------------
def compute_candidate(job_desc: str, resume_text_norm: str, vectorizer: TfidfVectorizer, jd_skills: list[str]) -> dict:
    matched = []
    missing = []
    for s in jd_skills:
        if phrase_in_text(s, resume_text_norm):
            matched.append(s)
        else:
            missing.append(s)

    matched_top = matched[:8]
    missing_top = missing[:8]

    denom = max(1, min(len(jd_skills), 10))
    coverage = len(matched[:denom]) / denom

    jd_norm = normalize_text(job_desc)
    M = vectorizer.transform([jd_norm, resume_text_norm])
    sem = float(cosine_similarity(M[0], M[1])[0][0]) if M.shape[1] else 0.0

    exp_m = estimate_experience_months(resume_text_norm)
    exp_score = min(exp_m / 36.0, 1.0)
    proj_score = min(project_mentions(resume_text_norm) / 5.0, 1.0)
    edu = education_score(resume_text_norm)

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
        # FIXED: "*.pdf" (your old "*.[tp]df" doesn't match PDFs)
        resume_files = (
            list(Path(upload_dir).glob("*.pdf"))
            + list(Path(upload_dir).glob("*.txt"))
            + list(Path(upload_dir).glob("*.docx"))
        )

        if not resume_files:
            return {"success": False, "error": "No resumes found"}

        resumes = []
        skipped = 0
        for resume_file in resume_files[:100]:
            text = extract_text_from_file(str(resume_file))
            if len((text or "").strip()) < 50:
                skipped += 1
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
                "insights": [f"No valid resumes found (skipped {skipped} files: unreadable/empty text)."],
                "summary": "No valid resumes found",
            }

        vectorizer = TfidfVectorizer(
            lowercase=True,
            stop_words=list(STOP_ALL),
            ngram_range=(1, 3),
            min_df=1,
            max_df=0.90,
            max_features=40000,
            norm="l2",
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

        results.sort(key=lambda x: x["overall_score"], reverse=True)
        for i, r in enumerate(results):
            r["rank"] = i + 1

        scores = np.array([r["overall_score"] for r in results], dtype=float)
        p80 = float(np.quantile(scores, 0.80))
        strong_threshold = int(max(60, round(p80)))
        strong_count = int((scores >= strong_threshold).sum())

        avg_sem = float(np.mean([r["semantic_similarity"] for r in results])) if results else 0.0

        insights = [
            f"AI screened {len(results)} resumes using RAKE skill phrases + TF‑IDF similarity.",
            f"Avg semantic match: {avg_sem:.0f}%.",
        ]
        if skipped:
            insights.append(f"Skipped {skipped} files (empty/unreadable text).")

        return {
            "success": True,
            "execution_id": execution_id,
            "total_resumes": len(results),
            "strong_candidates": strong_count,
            "strong_threshold": strong_threshold,
            "ranking": results[:25],
            "insights": insights,
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
