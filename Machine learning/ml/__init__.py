"""
ReportSetu ML Package.
Provides extraction, language, analysis, forecast, triage, and drug services.
"""

from .extraction import extract_report
from .language import draft_summary, patient_chat
from .analysis import analyze_patient
from .forecast import forecast_hba1c
from .agents import triage
from .drug import get_drug_indication, get_drug_info, suggest_medicine_names

__all__ = [
    "extract_report",
    "draft_summary",
    "patient_chat",
    "analyze_patient",
    "forecast_hba1c",
    "triage",
    "get_drug_indication",
    "get_drug_info",
    "suggest_medicine_names",
]
