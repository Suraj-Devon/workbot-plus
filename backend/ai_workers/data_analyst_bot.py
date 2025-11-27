#!/usr/bin/env python3
import sys
import json
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import warnings

warnings.filterwarnings('ignore')

def analyze_csv(file_path, execution_id):
    """
    Analyze CSV file and return insights
    """
    try:
        # Read CSV
        df = pd.read_csv(file_path)
        
        # Basic info
        num_rows = len(df)
        num_cols = len(df.columns)
        
        # Numeric columns only
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        
        if not numeric_cols:
            return {
                "success": False,
                "error": "No numeric columns found",
                "summary": "Could not analyze: file has no numeric data"
            }
        
        # Calculate statistics
        stats = {}
        for col in numeric_cols:
            stats[col] = {
                "mean": float(df[col].mean()),
                "median": float(df[col].median()),
                "std": float(df[col].std()),
                "min": float(df[col].min()),
                "max": float(df[col].max()),
                "missing": int(df[col].isnull().sum())
            }
        
        # Correlations (if multiple numeric columns)
        correlations = {}
        if len(numeric_cols) > 1:
            corr_matrix = df[numeric_cols].corr()
            for i, col1 in enumerate(numeric_cols):
                for col2 in numeric_cols[i+1:]:
                    corr = float(corr_matrix.loc[col1, col2])
                    if abs(corr) > 0.5:  # Only strong correlations
                        correlations[f"{col1} vs {col2}"] = corr
        
        # Trends (for time-series-like data)
        trends = {}
        for col in numeric_cols:
            values = df[col].dropna()
            if len(values) > 1:
                # Simple trend: compare first half vs second half
                first_half = values[:len(values)//2].mean()
                second_half = values[len(values)//2:].mean()
                if first_half != 0:
                    trend_pct = ((second_half - first_half) / abs(first_half)) * 100
                    if abs(trend_pct) > 5:  # Only significant trends
                        trends[col] = f"{trend_pct:+.1f}%"
        
        # Outliers
        outliers = {}
        for col in numeric_cols:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            outlier_count = len(df[(df[col] < Q1 - 1.5*IQR) | (df[col] > Q3 + 1.5*IQR)])
            if outlier_count > 0:
                outliers[col] = outlier_count
        
        # Generate insights
        insights = []
        insights.append(f"Analyzed {num_rows} rows and {num_cols} columns")
        insights.append(f"Found {len(numeric_cols)} numeric columns")
        
        if trends:
            insights.append(f"Detected {len(trends)} columns with significant trends")
        
        if correlations:
            insights.append(f"Found {len(correlations)} strong correlations between variables")
        
        if outliers:
            total_outliers = sum(outliers.values())
            insights.append(f"Detected {total_outliers} potential outliers")
        
        # Prepare response
        response = {
            "success": True,
            "execution_id": execution_id,
            "file_info": {
                "rows": num_rows,
                "columns": num_cols,
                "numeric_columns": numeric_cols
            },
            "statistics": stats,
            "correlations": correlations,
            "trends": trends,
            "outliers": outliers,
            "insights": insights,
            "summary": " | ".join(insights[:3])
        }
        
        return response
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "summary": f"Analysis failed: {str(e)}"
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing file path"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    execution_id = sys.argv[2] if len(sys.argv) > 2 else "unknown"
    
    result = analyze_csv(file_path, execution_id)
    print(json.dumps(result))
