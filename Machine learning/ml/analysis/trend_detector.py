"""
Trend Detection Module for ReportSetu (ML 2).
Computes longitudinal slopes, percentage changes, and categorizes parameters
as rising, falling, or stable across chronological measurements.
"""

from datetime import datetime
from typing import List, Dict, Any


def detect_trends(
    patient_id: int,
    measurements: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Analyzes historical readings per test_code and returns trend insights.
    
    Requires >= 2 readings per test parameter.
    Cites all values and dates used in `evidence`.
    """
    # Group by test_code
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for m in measurements:
        code = m.get("test_code", "").upper()
        if not code or m.get("value") is None or not m.get("date"):
            continue
        grouped.setdefault(code, []).append(m)
        
    insights: List[Dict[str, Any]] = []
    insight_counter = 200
    
    for code, m_list in grouped.items():
        if len(m_list) < 2:
            continue
            
        # Sort chronologically by date
        sorted_m = sorted(m_list, key=lambda x: str(x.get("date", "")))
        
        # Build evidence list
        evidence = [{"date": m["date"], "value": float(m["value"])} for m in sorted_m]
        
        first_val = evidence[0]["value"]
        last_val = evidence[-1]["value"]
        n_points = len(evidence)
        unit = sorted_m[-1].get("unit", "")
        test_name = sorted_m[-1].get("test_name", code)
        
        if first_val == 0:
            pct_change = 0.0
        else:
            pct_change = ((last_val - first_val) / abs(first_val)) * 100.0
            
        # Thresholds customized per parameter
        direction = "stable"
        severity = "info"
        
        if code == "HBA1C":
            # For HbA1c, an absolute shift of 0.3% is clinically meaningful
            abs_diff = last_val - first_val
            if abs_diff >= 0.3 or pct_change >= 5.0:
                direction = "rising"
                severity = "review" if last_val >= 6.5 or abs_diff >= 0.6 else "info"
            elif abs_diff <= -0.3 or pct_change <= -5.0:
                direction = "falling"
                severity = "info"
            else:
                direction = "stable"
                severity = "info"
                
        elif code == "HB":
            # Hemoglobin drop >= 5% is falling; drop >= 10% is review
            if pct_change <= -5.0:
                direction = "falling"
                severity = "review" if pct_change <= -10.0 or last_val < 11.5 else "info"
            elif pct_change >= 5.0:
                direction = "rising"
                severity = "info"
            else:
                direction = "stable"
                severity = "info"
                
        elif code == "PLT":
            # Platelet change
            if pct_change <= -15.0:
                direction = "falling"
                severity = "review" if last_val < 100.0 or pct_change <= -30.0 else "info"
            elif pct_change >= 15.0:
                direction = "rising"
                severity = "info"
            else:
                direction = "stable"
                severity = "info"
                
        else:
            # General parameters (WBC, RBC, etc.)
            if pct_change >= 10.0:
                direction = "rising"
                # For WBC, only mark review if significantly elevated (e.g. infection > 14.0)
                if code == "WBC":
                    severity = "review" if last_val >= 14.5 else "info"
                else:
                    severity = "review" if pct_change >= 40.0 else "info"
            elif pct_change <= -10.0:
                direction = "falling"
                if code == "WBC":
                    severity = "review" if last_val <= 3.0 else "info"
                else:
                    severity = "review" if pct_change <= -40.0 else "info"
            else:
                direction = "stable"
                severity = "info"
                
        # Generate clear explanation citing values and dates
        direction_word = "rose" if direction == "rising" else ("fell" if direction == "falling" else "remained stable")
        if direction == "stable":
            explanation = f"{test_name} remained stable ({first_val} to {last_val} {unit}) across {n_points} reports."
        else:
            explanation = f"{test_name} {direction_word} from {first_val} to {last_val} {unit} ({pct_change:+.1f}%) across {n_points} reports."
            
        insight_counter += 1
        insights.append({
            "id": insight_counter,
            "patient_id": patient_id,
            "test_code": code,
            "type": "trend",
            "direction": direction,
            "severity": severity,
            "explanation": explanation,
            "evidence": evidence,
            "status": "pending"
        })
        
    return insights
