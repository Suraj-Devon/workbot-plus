"""
Placeholder for future supervised model training.

Right now the live scoring in `resume_screener_bot.py` uses:
- TF-IDF semantic similarity between JD and resume
- Parsed experience vs required years
- Must-have keyword matches

Once you have real labeled pairs (JD, resume, label/score),
you can:
1) Extract the same features used in production
2) Train a regression/classifier model
3) Replace or augment the rule-based scoring.
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error
import joblib

# Example skeleton; not used in production yet.


def train_model_from_labeled_csv(csv_path: str = "data/labeled_resumes.csv") -> None:
    df = pd.read_csv(csv_path)

    feature_cols = [
        "semantic_similarity",
        "exp_years",
        "must_match_count",
        "nice_match_count",
    ]
    target_col = "human_score"

    X = df[feature_cols].values
    y = df[target_col].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = RandomForestRegressor(
        n_estimators=150, max_depth=10, random_state=42
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print("R2:", r2_score(y_test, y_pred))
    print("MAE:", mean_absolute_error(y_test, y_pred))

    joblib.dump(model, "backend/ai_workers/resume_model.pkl")
    print("Saved: backend/ai_workers/resume_model.pkl")


if __name__ == "__main__":
    print(
        "This script is a template. "
        "Prepare a labeled CSV and call train_model_from_labeled_csv(path)."
    )
