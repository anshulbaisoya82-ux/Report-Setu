"""
Doctor Copilot Tools for ReportSetu (ML 1 - P1).
Provides query tools across patients for doctor copilot assistant.
"""

from typing import List, Dict, Any


def find_patients_by_trend(
    patients_insights: List[Dict[str, Any]],
    test_code: str,
    direction: str = "rising"
) -> List[Dict[str, Any]]:
    """Finds all patients who have a specific trend direction for a test code."""
    matched = []
    for item in patients_insights:
        patient_id = item.get("patient_id")
        insights = item.get("insights", [])
        for ins in insights:
            if (ins.get("test_code", "").upper() == test_code.upper() and
                ins.get("direction", "").lower() == direction.lower()):
                matched.append({
                    "patient_id": patient_id,
                    "test_code": test_code,
                    "direction": direction,
                    "explanation": ins.get("explanation"),
                    "severity": ins.get("severity")
                })
                break
    return matched


def find_critical_patients(patients_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Identifies patients flagged with Critical priority or critical insights."""
    critical = []
    for p in patients_data:
        priority = p.get("priority", "").lower()
        has_critical_insight = any(i.get("severity") == "critical" for i in p.get("insights", []))
        if priority == "critical" or has_critical_insight:
            critical.append({
                "patient_id": p.get("patient_id"),
                "name": p.get("name", f"Patient {p.get('patient_id')}"),
                "priority": "critical",
                "reason": p.get("reason", "Critical lab value alert")
            })
    return critical
