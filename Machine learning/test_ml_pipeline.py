"""
Comprehensive End-to-End Pipeline Test for ReportSetu ML.
Tests:
- Patient A (Critical): Platelets drop acutely
- Patient B (Review): Haemoglobin falling across 3 reports
- Patient C (Review): HbA1c rising across 4 reports + forecast
- Patient D (Stable): Slightly high value, otherwise stable
- Patient E (Stable): 1 report, forecast warning
- draft_summary (English & Hindi)
- patient_chat (safe inquiry vs escalation)
- extract_report (sample reports)
"""

import os
import sys
import json

# Ensure stdout handles UTF-8 for Devanagari Hindi text on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from ml import (
    extract_report,
    draft_summary,
    patient_chat,
    analyze_patient,
    forecast_hba1c,
    triage,
)
from ml.data.demo_patients import get_demo_patients, save_demo_patients_json
from ml.data.synthetic_generator import generate_and_save_split_datasets
from ml.data.evaluate_models import run_evaluation


def test_end_to_end_demo_patients():
    print("\n=======================================================")
    print("  REPORTSETU ML: END-TO-END DEMO PATIENT VERIFICATION")
    print("=======================================================\n")
    
    demo_patients = get_demo_patients()
    assert len(demo_patients) == 5, "Expected exactly 5 demo patients!"
    
    for p in demo_patients:
        pid = p["id"]
        p_name = p["name"]
        expected_priority = p["expected_priority"]
        story = p["story"]
        
        print(f"--- Testing {p_name} ({p['patient_code']}) ---")
        print(f"Story: {story}")
        print(f"Expected Priority: {expected_priority.upper()}")
        
        # Flatten all measurements across all chronological reports
        all_measurements = []
        for r in p["reports"]:
            for m in r["measurements"]:
                m_copy = dict(m)
                m_copy["patient_id"] = pid
                m_copy["date"] = r["date"]
                all_measurements.append(m_copy)
                
        # 1. Run Analysis Engine
        insights = analyze_patient(all_measurements)
        print(f"  Analysis Engine: Generated {len(insights)} insight(s)")
        for ins in insights:
            print(f"    - [{ins['type'].upper()} | {ins['severity'].upper()}] {ins['explanation']}")
            
        # 2. Run LangGraph Triage Agent
        triage_res = triage(pid, insights)
        print(f"  Triage Agent: Priority = {triage_res['priority'].upper()} | Reason = \"{triage_res['reason']}\"")
        assert triage_res["priority"] == expected_priority, (
            f"Triage mismatch for {p_name}: expected {expected_priority}, got {triage_res['priority']}"
        )
        
        # 3. Run HbA1c Forecaster
        fc = forecast_hba1c(all_measurements)
        if pid == 3: # Patient C (4 readings)
            print(f"  Forecast (Patient C): Estimate={fc['estimate']}%, Interval=[{fc['low']} - {fc['high']}]%, Warning={fc['warning']}")
            assert fc["estimate"] is not None, "Patient C must have a valid estimate!"
            assert fc["warning"] is None, "Patient C must have no forecast warning!"
        elif pid == 5: # Patient E (1 reading)
            print(f"  Forecast (Patient E): Estimate={fc['estimate']}, Warning=\"{fc['warning']}\"")
            assert fc["estimate"] is None, "Patient E must return estimate: null!"
            assert fc["warning"] == "Not enough readings to forecast", "Patient E must display insufficient reading warning!"
            
        # 4. Run Summary Generator (Latest report)
        latest_report_measurements = p["reports"][-1]["measurements"]
        summary_en = draft_summary(latest_report_measurements, insights, lang="en")
        summary_hi = draft_summary(latest_report_measurements, insights, lang="hi")
        print(f"  AI Summary (EN): \"{summary_en}\" ({len(summary_en.split())} words)")
        try:
            print(f"  AI Summary (HI): \"{summary_hi}\" ({len(summary_hi.split())} words)")
        except UnicodeEncodeError:
            print(f"  AI Summary (HI): [Devanagari text generated successfully: {len(summary_hi.split())} words]")
        assert len(summary_en.split()) <= 120, "Summary exceeds 120 words!"
        assert len(summary_hi.split()) <= 120, "Hindi summary exceeds 120 words!"
        
        # 5. Run Patient Chat (P1)
        safe_chat = patient_chat("What does my report summary say?", approved_summary=summary_en)
        escalate_chat = patient_chat("What medicine should I take for this?", approved_summary=summary_en)
        assert safe_chat["escalate"] is False, "Safe question was escalated!"
        assert escalate_chat["escalate"] is True, "Medical question was not escalated!"
        
        print(f"  [PASS] All checks passed for {p_name}!\n")


def test_extraction_pipeline():
    print("\n=======================================================")
    print("  REPORTSETU ML: EXTRACTION MODULE VERIFICATION")
    print("=======================================================\n")
    sample_path = os.path.join(os.path.dirname(__file__), "ml", "extraction", "sample_reports", "report_01_lalpathlabs.txt")
    res = extract_report(sample_path)
    print(f"Extracted from {os.path.basename(sample_path)}:")
    print(f"  Lab Name:    {res['lab_name']}")
    print(f"  Report Date: {res['report_date']}")
    print(f"  Test Count:  {len(res['measurements'])}")
    for m in res["measurements"]:
        print(f"    {m['test_code']:6s} ({m['test_name']:28s}): {m['value']:6.1f} {m['unit']:10s} [Flag: {m['flag']:12s} | Check: {m['needs_check']}]")
    assert len(res["measurements"]) >= 5, "Expected at least 5 extracted parameters!"
    print("  [PASS] Extraction pipeline verified successfully!")


if __name__ == "__main__":
    # Generate seed demo file and synthetic data
    print("Step 1: Generating Demo Patients Seed File...")
    save_demo_patients_json()
    
    print("\nStep 2: Generating Synthetic Dataset and Split...")
    generate_and_save_split_datasets(200)
    
    print("\nStep 3: Running Model Evaluation and Generating Metrics Report...")
    run_evaluation()
    
    print("\nStep 4: Running Extraction Verification...")
    test_extraction_pipeline()
    
    print("\nStep 5: Running End-to-End Demo Patients Verification...")
    test_end_to_end_demo_patients()
    
    print("\n=======================================================")
    print("  ALL ML MODULES VERIFIED & WORKING 100% END-TO-END!")
    print("=======================================================\n")
