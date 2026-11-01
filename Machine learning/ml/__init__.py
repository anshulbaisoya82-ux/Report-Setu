"""
ReportSetu ML Package (ML 1 & ML 2).
Provides all machine learning, OCR/extraction, language, trend analysis,
HbA1c forecasting, and LangGraph triage functions.

Conforms strictly to Section 5 Contracts:
- extract_report(file_path) -> {report_date, lab_name, measurements: [Measurement]}
- draft_summary(measurements, insights, lang) -> str (<= 120 words)
- patient_chat(question, approved_summary, history) -> {answer, escalate}
- analyze_patient(measurements) -> [Insight]
- forecast_hba1c(measurements) -> Forecast
- triage(patient_id, insights) -> TriageResult
- suggest_medicine_names(query, limit) -> [str]; get_drug_info(name); get_drug_indication(name)
"""

from .extraction import extract_report
from .language import draft_summary, patient_chat
from .analysis import analyze_patient
from .forecast import forecast_hba1c
from .agents import triage
from .drugs import suggest_medicine_names, get_drug_info, get_drug_indication

__all__ = [
    "extract_report",
    "draft_summary",
    "patient_chat",
    "analyze_patient",
    "forecast_hba1c",
    "triage",
    "suggest_medicine_names",
    "get_drug_info",
    "get_drug_indication",
]
