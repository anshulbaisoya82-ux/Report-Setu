"""
Analysis Package for ReportSetu (ML 2).
"""

from .analyzer import analyze_patient
from .reference_rules import check_reference_and_critical
from .trend_detector import detect_trends
from .unusual_change import detect_unusual_changes, UnusualChangeDetector

__all__ = [
    "analyze_patient",
    "check_reference_and_critical",
    "detect_trends",
    "detect_unusual_changes",
    "UnusualChangeDetector",
]
