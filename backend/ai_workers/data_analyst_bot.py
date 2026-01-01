#!/usr/bin/env python3
import sys
import json
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
import warnings

warnings.filterwarnings('ignore')

def analyze_csv(file_path, execution_id):
    """
    Advanced ML analysis: KMeans clustering + Isolation Forest anomalies + trend forecast
    """
    try:
        df = pd.read_csv(file_path)
        
        num_rows = len(df)
        num_cols = len(df.columns)
        
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        
        if not numeric_cols:
            return {
                "success": False,
                "error": "No numeric columns found",
                "summary": "Could not analyze: file has no numeric data"
            }
        
        # ===== STATISTICS =====
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
        
        # ===== CORRELATIONS =====
        correlations = {}
        if len(numeric_cols) > 1:
            corr_matrix = df[numeric_cols].corr()
            for i, col1 in enumerate(numeric_cols):
                for col2 in numeric_cols[i+1:]:
                    corr = float(corr_matrix.loc[col1, col2])
                    if abs(corr) > 0.5:
                        correlations[f"{col1} vs {col2}"] = corr
        
        # ===== TRENDS (first half vs second half) =====
        trends = {}
        for col in numeric_cols:
            values = df[col].dropna()
            if len(values) > 1:
                first_half = values[:len(values)//2].mean()
                second_half = values[len(values)//2:].mean()
                if first_half != 0:
                    trend_pct = ((second_half - first_half) / abs(first_half)) * 100
                    if abs(trend_pct) > 5:
                        trends[col] = f"{trend_pct:+.1f}%"
        
        # ===== OUTLIERS (IQR method) =====
        outliers = {}
        for col in numeric_cols:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            outlier_count = len(df[(df[col] < Q1 - 1.5*IQR) | (df[col] > Q3 + 1.5*IQR)])
            if outlier_count > 0:
                outliers[col] = outlier_count
        
        # ===== KMEANS CLUSTERING (ML MAGIC) =====
        clusters = {}
        optimal_k = min(3, len(df) // 10, 5)  # 3-5 clusters, scale to data size
        
        if len(numeric_cols) > 0 and len(df) >= optimal_k:
            try:
                X = df[numeric_cols].fillna(df[numeric_cols].mean())
                scaler = StandardScaler()
                X_scaled = scaler.fit_transform(X)
                
                kmeans = KMeans(n_clusters=optimal_k, random_state=42, n_init=10)
                df['cluster'] = kmeans.fit_predict(X_scaled)
                
                for cluster_id in range(optimal_k):
                    cluster_data = df[df['cluster'] == cluster_id]
                    cluster_size = len(cluster_data)
                    cluster_mean = cluster_data[numeric_cols].mean().to_dict()
                    
                    clusters[f"Segment_{cluster_id + 1}"] = {
                        "size": int(cluster_size),
                        "pct": f"{(cluster_size/len(df)*100):.1f}%",
                        "avg_metrics": {k: float(v) for k, v in cluster_mean.items()}
                    }
            except Exception as e:
                clusters["error"] = str(e)
        
        # ===== ISOLATION FOREST ANOMALIES (ML MAGIC) =====
        anomalies = {}
        if len(numeric_cols) > 0 and len(df) > 10:
            try:
                X = df[numeric_cols].fillna(df[numeric_cols].mean())
                iso_forest = IsolationForest(contamination=0.05, random_state=42)
                df['anomaly'] = iso_forest.fit_predict(X)
                
                anomaly_count = len(df[df['anomaly'] == -1])
                if anomaly_count > 0:
                    anomaly_rows = df[df['anomaly'] == -1][numeric_cols].head(3)
                    anomalies = {
                        "total_count": int(anomaly_count),
                        "pct": f"{(anomaly_count/len(df)*100):.2f}%",
                        "top_3_anomalies": anomaly_rows.to_dict(orient='records')
                    }
            except Exception as e:
                anomalies["error"] = str(e)
        
        # ===== FORECASTING (simple linear trend) =====
        forecast = {}
        for col in numeric_cols:
            values = df[col].dropna().values
            if len(values) > 2:
                x = np.arange(len(values))
                z = np.polyfit(x, values, 1)
                future_x = np.array([len(values), len(values) + 1, len(values) + 2])
                future_y = np.polyval(z, future_x)
                
                forecast[col] = {
                    "next_3_periods": [float(y) for y in future_y],
                    "slope": float(z[0])  # positive = uptrend, negative = downtrend
                }
        
        # ===== INSIGHTS =====
        insights = []
        insights.append(f"Analyzed {num_rows} rows and {num_cols} columns")
        insights.append(f"Found {len(numeric_cols)} numeric columns for ML analysis")
        insights.append(f"KMeans identified {optimal_k} customer/data segments")
        
        if anomalies and 'total_count' in anomalies:
            insights.append(f"Detected {anomalies['total_count']} anomalies ({anomalies['pct']})")
        
        if trends:
            insights.append(f"Detected {len(trends)} columns with significant trends")
        
        if correlations:
            insights.append(f"Found {len(correlations)} strong correlations")
        
        # ===== RESPONSE =====
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
            "clusters": clusters,  # NEW
            "anomalies": anomalies,  # NEW
            "forecast": forecast,  # NEW
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
