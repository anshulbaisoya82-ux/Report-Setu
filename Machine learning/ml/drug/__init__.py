"""
Drug Information Service package (HealthPilot.ai / drugdb.in).
"""

from .drug_service import get_drug_indication, get_drug_info, suggest_medicine_names

__all__ = [
    "get_drug_indication",
    "get_drug_info",
    "suggest_medicine_names",
]
