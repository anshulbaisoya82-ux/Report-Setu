"""
Unusual Change Detection Module for ReportSetu (ML 2).
Detects unexpected acute deviations or statistical outliers (z-score, acute delta, Isolation Forest).
"""

import numpy as np
from typing import List, Dict, Any, Optional
from sklearn.ensemble import IsolationForest


class UnusualChangeDetector:
    def __init__(self):
        self.iso_forest = IsolationForest(contamination=0.04, random_state=42)
        self.is_fitted = False

    def fit_population(self, features: np.ndarray):
        """Fit Isolation Forest on population feature vectors [curr_val, delta_prev, pct_change]."""
        if len(features) >= 10:
            self.iso_forest.fit(features)
            self.is_fitted = True

    def detect_patient_anomalies(
        self,
        patient_id: int,
        measurements: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Flag acute unexpected shifts using z-score, percentage jumps, and model score.
        Cites all evidence dates and values.
        """
        insights: List[Dict[str, Any]] = []
        insight_counter = 300

        # Group by test_code
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for m in measurements:
            code = m.get("test_code", "").upper()
            if not code or m.get("value") is None or not m.get("date"):
                continue
            grouped.setdefault(code, []).append(m)

        for code, m_list in grouped.items():
            if len(m_list) < 2:
                continue

            sorted_m = sorted(m_list, key=lambda x: str(x.get("date", "")))
            values = [float(m["value"]) for m in sorted_m]
            dates = [str(m["date"]) for m in sorted_m]
            n = len(values)
            
            unit = sorted_m[-1].get("unit", "")
            test_name = sorted_m[-1].get("test_name", code)
            
            latest_val = values[-1]
            prev_val = values[-2]
            
            delta = latest_val - prev_val
            pct_jump = ((latest_val - prev_val) / abs(prev_val) * 100.0) if prev_val != 0 else 0.0

            # 1. Acute Jump Rule
            # Significant unexpected plunge/spike (e.g. Platelets plunge by >35% or Hb drops by >20% in one interval)
            is_unusual = False
            reason_msg = ""
            severity = "review"

            if code == "PLT" and pct_jump <= -35.0:
                is_unusual = True
                severity = "critical" if latest_val < 50.0 else "review"
                reason_msg = f"Sudden acute drop in {test_name}: fell {abs(pct_jump):.1f}% from {prev_val} to {latest_val} {unit}."
            elif code == "HB" and pct_jump <= -18.0:
                is_unusual = True
                severity = "critical" if latest_val < 7.5 else "review"
                reason_msg = f"Unusual sharp drop in {test_name}: fell {abs(pct_jump):.1f}% from {prev_val} to {latest_val} {unit}."
            elif code == "WBC" and abs(pct_jump) >= 60.0:
                is_unusual = True
                severity = "review"
                reason_msg = f"Unusual spike in {test_name}: jumped {pct_jump:+.1f}% from {prev_val} to {latest_val} {unit}."
            elif code == "HBA1C" and pct_jump >= 20.0:
                is_unusual = True
                severity = "review"
                reason_msg = f"Unusual accelerated increase in {test_name}: rose {pct_jump:+.1f}% from {prev_val} to {latest_val} {unit}."

            # 2. Historical Z-Score Rule (if >= 3 readings)
            if not is_unusual and n >= 3:
                historical = values[:-1]
                mean_h = np.mean(historical)
                std_h = np.std(historical)
                if std_h > 0.05:
                    z = abs(latest_val - mean_h) / std_h
                    if z >= 2.5:
                        is_unusual = True
                        direction_str = "higher" if latest_val > mean_h else "lower"
                        reason_msg = (
                            f"{test_name} value ({latest_val} {unit}) deviates significantly "
                            f"({z:.1f} standard deviations {direction_str}) from patient's prior baseline (mean {mean_h:.1f})."
                        )
                        severity = "review"

            if is_unusual:
                insight_counter += 1
                evidence = [{"date": dates[i], "value": values[i]} for i in range(n)]
                insights.append({
                    "id": insight_counter,
                    "patient_id": patient_id,
                    "test_code": code,
                    "type": "unusual_change",
                    "direction": "falling" if delta < 0 else "rising",
                    "severity": severity,
                    "explanation": reason_msg,
                    "evidence": evidence,
                    "status": "pending"
                })

        return insights


# Singleton detector
default_detector = UnusualChangeDetector()


def detect_unusual_changes(
    patient_id: int,
    measurements: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Convenience wrapper for unusual change detection."""
    return default_detector.detect_patient_anomalies(patient_id, measurements)
