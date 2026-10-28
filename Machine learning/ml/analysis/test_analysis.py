"""
Test Suite for Analysis Engine (ML 2).
Validates reference rules, trend calculation, unusual change detection, and Insight schema.
"""

import os
import sys

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ml.analysis.analyzer import analyze_patient


def run_analysis_tests():
    print("=== Running Analysis Engine Evaluation ===")
    
    # Test case 1: Patient with falling Hemoglobin across 3 reports
    falling_hb_data = [
        {"patient_id": 7, "test_code": "HB", "test_name": "Haemoglobin", "value": 13.1, "unit": "g/dL", "date": "2026-04-10"},
        {"patient_id": 7, "test_code": "HB", "test_name": "Haemoglobin", "value": 12.0, "unit": "g/dL", "date": "2026-07-08"},
        {"patient_id": 7, "test_code": "HB", "test_name": "Haemoglobin", "value": 10.8, "unit": "g/dL", "date": "2026-10-02"},
    ]
    
    insights = analyze_patient(falling_hb_data)
    print(f"Generated {len(insights)} insights for falling Hb:")
    for ins in insights:
        print(f"  [{ins['type'].upper()} | {ins['severity'].upper()}] {ins['explanation']}")
        print(f"   Evidence: {ins['evidence']}")
        
    trend_ins = [i for i in insights if i["type"] == "trend" and i["test_code"] == "HB"]
    assert len(trend_ins) > 0, "Failed to identify trend in Hb!"
    assert trend_ins[0]["direction"] == "falling", "Expected direction 'falling'!"
    assert trend_ins[0]["severity"] == "review", "Expected severity 'review' for -18% fall!"
    print("  -> Trend detection passed.")
    
    # Test case 2: Patient with critical low platelets
    critical_plt_data = [
        {"patient_id": 1, "test_code": "PLT", "test_name": "Platelet Count", "value": 210.0, "unit": "10^3/uL", "date": "2026-08-01"},
        {"patient_id": 1, "test_code": "PLT", "test_name": "Platelet Count", "value": 35.0, "unit": "10^3/uL", "date": "2026-10-15"},
    ]
    crit_insights = analyze_patient(critical_plt_data)
    print(f"\nGenerated {len(crit_insights)} insights for critical Platelets:")
    for ins in crit_insights:
        print(f"  [{ins['type'].upper()} | {ins['severity'].upper()}] {ins['explanation']}")
        
    crit_findings = [i for i in crit_insights if i["severity"] == "critical"]
    assert len(crit_findings) > 0, "Failed to flag critical severity on platelets < 50!"
    print("  -> Critical alert detection passed.")
    
    # Test case 3: Single report (no trend, only out-of-range or stable)
    single_data = [
        {"patient_id": 5, "test_code": "WBC", "test_name": "Total Leukocyte Count", "value": 6.5, "unit": "10^3/uL", "date": "2026-10-01"}
    ]
    single_insights = analyze_patient(single_data)
    trend_single = [i for i in single_insights if i["type"] == "trend"]
    assert len(trend_single) == 0, "Trend should not be computed for 1 report!"
    print("  -> Single report edge case passed.")
    
    print("\n=== Analysis Engine Tests Passed Successfully ===\n")
    return True


if __name__ == "__main__":
    success = run_analysis_tests()
    exit(0 if success else 1)
