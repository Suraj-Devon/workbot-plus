#!/bin/bash
pip install -r backend/requirements.txt

python -c "
import nltk
nltk.download('punkt', quiet=True)
nltk.download('stopwords', quiet=True)
print('✅ All Python deps installed + NLTK ready')
"
