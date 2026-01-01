#!/usr/bin/env bash
set -e

# Always use python -m pip (more reliable than pip on Windows and avoids wrong pip) [web:473]
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt

# Ensure better PDF + DOCX extraction libs exist
python -m pip install python-docx PyMuPDF pdfplumber

# Your code uses custom tokenizers; only stopwords is required
python - << 'PY'
import nltk
nltk.download('stopwords', quiet=True)
print("✅ Python deps installed + NLTK stopwords ready")
PY
