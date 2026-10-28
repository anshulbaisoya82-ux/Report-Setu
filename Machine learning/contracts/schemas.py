"""
Shared contracts and type definitions for ReportSetu.
These schemas strictly follow Section 5 of the ReportSetu Build Plan.
"""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

# Flag types for measurements
FlagType = Literal["low", "normal", "high", "critical_low", "critical_high", "missing"]

# Insight types
InsightType = Literal["out_of_range", "trend", "unusual_change"]
InsightSeverity = Literal["critical", "review", "info"]
InsightDirection = Literal["rising", "falling", "stable"]
InsightStatus = Literal["pending", "accepted", "dismissed"]

# Triage priority
TriagePriority = Literal["critical", "review", "stable"]


class Measurement(BaseModel):
    report_id: Optional[int] = None
    test_code: str
    test_name: str
    value: float
    unit: str
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    date: str  # YYYY-MM-DD
    flag: FlagType
    needs_check: bool = False


class InsightEvidence(BaseModel):
    date: str
    value: float


class Insight(BaseModel):
    id: Optional[int] = None
    patient_id: int
    test_code: str
    type: InsightType
    direction: Optional[InsightDirection] = None
    severity: InsightSeverity
    explanation: str
    evidence: List[InsightEvidence]
    status: InsightStatus = "pending"


class Forecast(BaseModel):
    test_code: str = "HBA1C"
    horizon_days: int = 90
    estimate: Optional[float] = None
    low: Optional[float] = None
    high: Optional[float] = None
    n_points: int
    baseline_estimate: Optional[float] = None
    warning: Optional[str] = None


class TriageResult(BaseModel):
    patient_id: int
    priority: TriagePriority
    reason: str


class ExtractedReport(BaseModel):
    report_date: str
    lab_name: str
    measurements: List[Measurement]


class ChatResponse(BaseModel):
    answer: str
    escalate: bool
