#!/bin/bash
cd backend
pip install numpy scikit-learn rake-nltk python-docx nltk pandas
python -c "
import nltk
nltk.download('punkt')
nltk.download('stopwords')
print('✅ Backend ready')
"
