#!/bin/bash
pip install -r backend/requirements.txt
pip install PyMuPDF pdfplumber

python -c "
import nltk
nltk.download('stopwords', quiet=True)  # Custom tokenizer = no punkt needed
print('✅ Production ready: PyMuPDF/pdfplumber + NLTK stopwords')
"
