"""
Reference Rules and Critical Value Checker for ReportSetu (ML 2).
Checks measurements against laboratory reference ranges and critical alert tables.
"""

from typing import List, Dict, Any, Optional
from ml.extraction.name_matching import TEST_METADATA

CRITICAL_BOUNDS = {
    "HB": {"low": 7.0, "high": 20.0, "name": "Haemoglobin", "unit": "g/dL"},
    "PLT": {"low": 50.0, "high": 1000.0, "name": "Platelets", "unit": "10^3/uL"},
    "WBC": {"low": 2.0, "high": 30.0, "name": "White Blood Cells", "unit": "10^3/uL"},
    "HBA1C": {"high": 10.0, "name": "HbA1c", "unit": "%"}
}


def check_reference_and_critical(
    patient_id: int,
    latest_measurements: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Generates out-of-range and critical alerts from latest measurements.
    """
    insights: List[Dict[str, Any]] = []
    insight_counter = 100
    
    for m in latest_measurements:
        code = m.get("test_code", "").upper()
        val = m.get("value")
        date_str = m.get("date", "")
        unit = m.get("unit", "")
        t_name = m.get("test_name", code)
        
        if val is None:
            continue
            
        ref_low = m.get("ref_low")
        ref_high = m.get("ref_high")
        
        # Check standard metadata if reference range is missing
        if ref_low is None or ref_high is None:
            meta = TEST_METADATA.get(code, {})
            if ref_low is None:
                ref_low = meta.get("ref_low")
            if ref_high is None:
                ref_high = meta.get("ref_high")
                
        # 1. Critical value check
        crit_info = CRITICAL_BOUNDS.get(code)
        is_critical = False
        crit_msg = ""
        
        if crit_info:
            c_low = crit_info.get("low")
            c_high = crit_info.get("high")
            if c_low is not None and val < c_low:
                is_critical = True
                crit_msg = f"{t_name} is critically low at {val} {unit} (critical threshold < {c_low})."
            elif c_high is not None and val > c_high:
                is_critical = True
                crit_msg = f"{t_name} is critically elevated at {val} {unit} (critical threshold > {c_high})."
                
        if is_critical:
            insight_counter += 1
            insights.append({
                "id": insight_counter,
                "patient_id": patient_id,
                "test_code": code,
                "type": "out_of_range",
                "direction": "falling" if "low" in crit_msg else "rising",
                "severity": "critical",
                "explanation": crit_msg,
                "evidence": [{"date": date_str, "value": val}],
                "status": "pending"
            })
            continue
            
        # 2. General out of range check
        is_out = False
        out_msg = ""
        severity = "info"
        
        if ref_low is not None and val < ref_low:
            is_out = True
            diff_pct = abs((ref_low - val) / ref_low) * 100.0
            severity = "review" if diff_pct > 15.0 else "info"
            out_msg = f"{t_name} ({val} {unit}) is below reference range ({ref_low} - {ref_high} {unit})."
        elif ref_high is not None and val > ref_high:
            is_out = True
            diff_pct = abs((val - ref_high) / ref_high) * 100.0
            severity = "review" if diff_pct > 15.0 else "info"
            out_msg = f"{t_name} ({val} {unit}) is above reference range ({ref_low} - {ref_high} {unit})."
            
        if is_out:
            insight_counter += 1
            insights.append({
                "id": insight_counter,
                "patient_id": patient_id,
                "test_code": code,
                "type": "out_of_range",
                "direction": "falling" if val < ref_low else "rising",
                "severity": severity,
                "explanation": out_msg,
                "evidence": [{"date": date_str, "value": val}],
                "status": "pending"
            })
            
    return insights
