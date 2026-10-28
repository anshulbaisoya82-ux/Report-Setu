"""
Comprehensive Patient Analyzer Module for ReportSetu (ML 2).
Combines reference range evaluation, longitudinal trend detection,
and acute anomaly detection into a unified Insight generator.
"""

from typing import List, Dict, Any
from .reference_rules import check_reference_and_critical
from .trend_detector import detect_trends
from .unusual_change import detect_unusual_changes


def analyze_patient(measurements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Main entry point for ML 2 analysis engine.
    
    Signature strictly conforming to Section 5:
    analyze_patient(measurements) -> [Insight]
    
    Inputs:
        measurements: All measurements recorded for a single patient across all dates.
        
    Outputs:
        List of Insight dictionaries conforming to Section 5 contract.
    """
    if not measurements:
        return []
        
    # Extract patient_id (if present in measurements or metadata)
    patient_id = 1
    for m in measurements:
        if "patient_id" in m and m["patient_id"] is not None:
            patient_id = m["patient_id"]
            break
            
    # Group by date to determine latest report measurements
    date_to_measurements: Dict[str, List[Dict[str, Any]]] = {}
    for m in measurements:
        d = m.get("date")
        if d:
            date_to_measurements.setdefault(str(d), []).append(m)
            
    if not date_to_measurements:
        latest_measurements = measurements
    else:
        latest_date = sorted(date_to_measurements.keys())[-1]
        latest_measurements = date_to_measurements[latest_date]
        
    all_insights: List[Dict[str, Any]] = []
    
    # 1. Out-of-range & critical values on latest report
    oor_insights = check_reference_and_critical(patient_id, latest_measurements)
    all_insights.extend(oor_insights)
    
    # 2. Longitudinal trend detection across all reports
    trend_insights = detect_trends(patient_id, measurements)
    all_insights.extend(trend_insights)
    
    # 3. Acute unusual changes / jumps
    anomaly_insights = detect_unusual_changes(patient_id, measurements)
    all_insights.extend(anomaly_insights)
    
    # Re-index unique sequential IDs
    for idx, insight in enumerate(all_insights, start=101):
        insight["id"] = idx
        insight["patient_id"] = patient_id
        if "status" not in insight:
            insight["status"] = "pending"
            
    return all_insights
