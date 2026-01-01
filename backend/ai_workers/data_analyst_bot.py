#!/usr/bin/env python3
import sys
import json
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
import chardet
import warnings

warnings.filterwarnings('ignore')

def detect_encoding(file_path):
    """Detect file encoding"""
    with open(file_path, 'rb') as f:
        raw_data = f.read(10000)
    
    result = chardet.detect(raw_data)
    encoding = result.get('encoding', 'utf-8')
    
    if encoding is None:
        encoding = 'utf-8'
    
    return encoding

def calculate_data_quality_score(df):
    """Calculate data completeness and quality (0-100%)"""
    total_cells = len(df) * len(df.columns)
    missing_cells = df.isnull().sum().sum()
    completeness = (1 - missing_cells / total_cells) * 100
    
    # Bonus for numeric data
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    numeric_bonus = (len(numeric_cols) / max(len(df.columns), 1)) * 10
    
    quality_score = min(100, completeness + numeric_bonus)
    
    return {
        "overall_score": round(quality_score, 1),
        "completeness": round(completeness, 1),
        "numeric_columns": len(numeric_cols),
        "missing_values": int(missing_cells)
    }

def generate_ai_insights(df, clusters, anomalies, trends, forecast):
    """Generate human-readable AI insights"""
    insights_text = []
    
    # Cluster insights
    if clusters and len(clusters) > 0:
        largest_seg = max(clusters.items(), key=lambda x: x[1]['size'] if isinstance(x[1], dict) and 'size' in x[1] else 0)
        if isinstance(largest_seg[1], dict) and 'size' in largest_seg[1]:
            insights_text.append(f"🎯 {largest_seg[0]} is your largest segment ({largest_seg[1]['pct']} of customers)")
    
    # Anomaly insights
    if anomalies and isinstance(anomalies, dict) and 'total_count' in anomalies:
        if anomalies['total_count'] > 0:
            insights_text.append(f"⚠️ {anomalies['total_count']} anomalies detected ({anomalies['pct']}) - investigate immediately for fraud/errors")
    
    # Trend insights
    if trends:
        declining = [k for k, v in trends.items() if str(v).startswith('-')]
        growing = [k for k, v in trends.items() if str(v).startswith('+')]
        
        if declining:
            insights_text.append(f"📉 {', '.join(declining[:2])} showing decline - focus on retention strategy")
        
        if growing:
            insights_text.append(f"📈 {', '.join(growing[:2])} trending up - double-down on growth levers")
    
    # Forecast insights
    if forecast:
        for col, fcData in list(forecast.items())[:1]:
            if fcData['slope'] > 0:
                insights_text.append(f"🚀 {col} forecast shows {abs(fcData['slope'])*100:.0f}% monthly growth - scaling opportunity")
            else:
                insights_text.append(f"🛑 {col} forecast declining - needs intervention")
    
    return insights_text[:4]  # Top 4 insights

def generate_recommendations(df, anomalies, clusters, stats):
    """Generate actionable recommendations"""
    recommendations = []
    
    # Anomaly recommendations
    if anomalies and isinstance(anomalies, dict) and 'total_count' in anomalies and anomalies['total_count'] > 0:
        recommendations.append({
            "priority": "HIGH",
            "action": f"Investigate {anomalies['total_count']} anomalies",
            "reason": f"Potential fraud or data errors ({anomalies['pct']} of data)",
            "impact": "Prevent revenue loss"
        })
    
    # Quality recommendations
    quality = calculate_data_quality_score(df)
    if quality['missing_values'] > 0:
        recommendations.append({
            "priority": "MEDIUM",
            "action": f"Clean {quality['missing_values']} missing values",
            "reason": "Improve data reliability",
            "impact": "Better ML predictions"
        })
    
    # Segment recommendations
    if clusters:
        recommendations.append({
            "priority": "MEDIUM",
            "action": "Create targeted campaigns for 3 segments",
            "reason": "Segments show different behavior patterns",
            "impact": "Increase conversion by 15-25%"
        })
    
    return recommendations[:3]  # Top 3 recommendations

def analyze_csv(file_path, execution_id):
    """Advanced ML analysis with quality score + AI insights"""
    try:
        encoding = detect_encoding(file_path)
        
        df = None
        encodings_to_try = [encoding, 'utf-8', 'latin-1', 'cp1252', 'utf-16', 'iso-8859-1']
        
        for enc in encodings_to_try:
            try:
                df = pd.read_csv(file_path, encoding=enc)
                break
            except (UnicodeDecodeError, UnicodeError):
                continue
        
        if df is None:
            return {
                "success": False,
                "error": "Could not decode CSV with any encoding",
                "summary": "File encoding error"
            }
        
        num_rows = len(df)
        num_cols = len(df.columns)
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        
        if not numeric_cols:
            return {
                "success": False,
                "error": "No numeric columns found",
                "summary": "Could not analyze: file has no numeric data"
            }
        
        # ===== DATA QUALITY =====
        quality = calculate_data_quality_score(df)
        
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
        
        # ===== TRENDS =====
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
        
        # ===== OUTLIERS =====
        outliers = {}
        for col in numeric_cols:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            outlier_count = len(df[(df[col] < Q1 - 1.5*IQR) | (df[col] > Q3 + 1.5*IQR)])
            if outlier_count > 0:
                outliers[col] = outlier_count
        
        # ===== KMEANS CLUSTERING =====
        clusters = {}
        optimal_k = min(3, len(df) // 10, 5)
        
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
        
        # ===== ISOLATION FOREST ANOMALIES =====
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
        
        # ===== FORECASTING =====
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
                    "slope": float(z[0])
                }
        
        # ===== AI INSIGHTS (NEW) =====
        ai_insights = generate_ai_insights(df, clusters, anomalies, trends, forecast)
        
        # ===== RECOMMENDATIONS (NEW) =====
        recommendations = generate_recommendations(df, anomalies, clusters, stats)
        
        # ===== STANDARD INSIGHTS =====
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
            "file_encoding": encoding,
            "file_info": {
                "rows": num_rows,
                "columns": num_cols,
                "numeric_columns": numeric_cols
            },
            "data_quality": quality,  # NEW
            "statistics": stats,
            "correlations": correlations,
            "trends": trends,
            "outliers": outliers,
            "clusters": clusters,
            "anomalies": anomalies,
            "forecast": forecast,
            "ai_insights": ai_insights,  # NEW
            "recommendations": recommendations,  # NEW
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
