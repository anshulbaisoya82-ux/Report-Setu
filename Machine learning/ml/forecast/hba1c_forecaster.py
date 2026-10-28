"""
HbA1c Forecaster Module for ReportSetu (ML 2).
Predicts next HbA1c value (90-day horizon) using Ordinary Least Squares
with prediction intervals, comparing against a last-value baseline.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
import numpy as np
from scipy import stats


def forecast_hba1c(measurements: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Produces a 90-day forecast for HbA1c based on patient's historical readings.
    
    Conforms strictly to Section 5:
    Input:
        measurements: list of HbA1c measurements (or full patient measurements,
                      from which HbA1c readings are filtered)
    Output:
        {
            "test_code": "HBA1C",
            "horizon_days": 90,
            "estimate": float | None,
            "low": float | None,
            "high": float | None,
            "n_points": int,
            "baseline_estimate": float | None,
            "warning": str | None
        }
    """
    # Filter for valid HbA1c readings
    hba1c_readings = [
        m for m in measurements
        if m.get("test_code", "").upper() == "HBA1C"
        and m.get("value") is not None
        and m.get("date")
    ]
    
    # Sort chronologically by date
    sorted_readings = sorted(hba1c_readings, key=lambda x: str(x.get("date", "")))
    n_points = len(sorted_readings)
    
    # Baseline estimate is always the latest recorded value (if available)
    latest_val = float(sorted_readings[-1]["value"]) if n_points > 0 else None
    
    # Rule: With fewer than 3 readings, return null estimate with warning
    if n_points < 3:
        return {
            "test_code": "HBA1C",
            "horizon_days": 90,
            "estimate": None,
            "low": None,
            "high": None,
            "n_points": n_points,
            "baseline_estimate": latest_val,
            "warning": "Not enough readings to forecast"
        }
        
    # Convert dates to days relative to first reading
    dates = []
    values = []
    
    for r in sorted_readings:
        d_str = str(r["date"])
        try:
            dt = datetime.strptime(d_str[:10], "%Y-%m-%d")
        except ValueError:
            dt = datetime.now()
        dates.append(dt)
        values.append(float(r["value"]))
        
    t0 = dates[0]
    t_days = np.array([(d - t0).days for d in dates], dtype=float)
    y = np.array(values, dtype=float)
    
    # Future prediction target: 90 days after latest reading
    t_target = t_days[-1] + 90.0
    
    # Fit Linear Regression (Ordinary Least Squares)
    t_mean = np.mean(t_days)
    y_mean = np.mean(y)
    
    ss_tt = np.sum((t_days - t_mean) ** 2)
    if ss_tt == 0:
        # Edge case: readings on the exact same day
        slope = 0.0
        intercept = y_mean
        residual_var = 0.1
    else:
        slope = np.sum((t_days - t_mean) * (y - y_mean)) / ss_tt
        intercept = y_mean - slope * t_mean
        
        # Residual sum of squares
        residuals = y - (intercept + slope * t_days)
        df = max(1, n_points - 2)
        residual_var = np.sum(residuals ** 2) / df
        
    se = np.sqrt(max(0.01, residual_var))
    
    # Standard error of prediction at t_target
    if ss_tt > 0:
        se_pred = se * np.sqrt(1.0 + (1.0 / n_points) + ((t_target - t_mean) ** 2) / ss_tt)
    else:
        se_pred = se * np.sqrt(1.0 + (1.0 / n_points))
        
    # 95% Prediction Interval using t-distribution
    df = max(1, n_points - 2)
    t_crit = stats.t.ppf(0.975, df=df)
    
    estimate = float(intercept + slope * t_target)
    # Clip to realistic physiological bounds (3.0% to 18.0%)
    estimate = max(3.5, min(16.0, estimate))
    
    low = max(3.0, estimate - (t_crit * se_pred))
    high = min(18.0, estimate + (t_crit * se_pred))
    
    return {
        "test_code": "HBA1C",
        "horizon_days": 90,
        "estimate": round(estimate, 1),
        "low": round(low, 1),
        "high": round(high, 1),
        "n_points": n_points,
        "baseline_estimate": round(latest_val, 1) if latest_val is not None else None,
        "warning": None
    }
