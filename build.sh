#!/bin/bash
pip install -r backend/requirements.txt
pip install PyMuPDF pdfplumber

python -c "
import nltk
nltk.download('stopwords', quiet=True)  # punkt NOT needed
print('✅ All Python deps + PyMuPDF/pdfplumber + NLTK stopwords ready')
"
