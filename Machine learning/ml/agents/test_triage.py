"""
Test Suite for LangGraph Triage Agent (ML 2).
Validates priority determination and reason formatting for Critical, Review, and Stable cohorts.
"""

import os
import sys

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ml.agents.triage_agent import triage


def run_triage_tests():
    print("=== Running LangGraph Triage Agent Evaluation ===")
    
    # 1. Critical test case (e.g. Critical low Platelets)
    crit_insights = [
        {
            "id": 101,
            "patient_id": 1,
            "test_code": "PLT",
            "type": "out_of_range",
            "severity": "critical",
            "explanation": "Platelets is critically low at 35 10^3/uL (critical threshold < 50.0).",
            "evidence": [{"date": "2026-10-15", "value": 35.0}]
        }
    ]
    t_crit = triage(patient_id=1, insights=crit_insights)
    print(f"\n[Critical Case Result]: {t_crit}")
    assert t_crit["priority"] == "critical", f"Expected 'critical' but got {t_crit['priority']}"
    assert "Platelets" in t_crit["reason"] or "critical" in t_crit["reason"].lower()
    print("  -> Critical triage passed.")
    
    # 2. Review test case (e.g. Falling Hb across 3 reports)
    review_insights = [
        {
            "id": 102,
            "patient_id": 2,
            "test_code": "HB",
            "type": "trend",
            "direction": "falling",
            "severity": "review",
            "explanation": "Haemoglobin fell from 13.8 to 10.4 g/dL (-24.6%) across 3 reports.",
            "evidence": [
                {"date": "2026-04-10", "value": 13.8},
                {"date": "2026-07-08", "value": 12.1},
                {"date": "2026-10-02", "value": 10.4}
            ]
        }
    ]
    t_review = triage(patient_id=2, insights=review_insights)
    print(f"\n[Review Case Result]: {t_review}")
    assert t_review["priority"] == "review", f"Expected 'review' but got {t_review['priority']}"
    assert "Hb fell" in t_review["reason"] or "falling" in t_review["reason"].lower() or "Hb" in t_review["reason"]
    print("  -> Review triage passed.")
    
    # 3. Stable test case (e.g. all parameters normal)
    stable_insights = [
        {
            "id": 103,
            "patient_id": 4,
            "test_code": "HB",
            "type": "trend",
            "direction": "stable",
            "severity": "info",
            "explanation": "Haemoglobin remained stable across 2 reports.",
            "evidence": [{"date": "2026-05-01", "value": 13.5}, {"date": "2026-10-01", "value": 13.6}]
        }
    ]
    t_stable = triage(patient_id=4, insights=stable_insights)
    print(f"\n[Stable Case Result]: {t_stable}")
    assert t_stable["priority"] == "stable", f"Expected 'stable' but got {t_stable['priority']}"
    print("  -> Stable triage passed.")
    
    print("\n=== Triage Tests Passed Successfully ===\n")
    return True


if __name__ == "__main__":
    success = run_triage_tests()
    exit(0 if success else 1)
