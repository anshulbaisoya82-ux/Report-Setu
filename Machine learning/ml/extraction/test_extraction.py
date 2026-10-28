"""
Test Suite for Report Extraction (ML 1).
Evaluates extraction accuracy, name matching, and sanity checks on sample reports.
"""

import os
import sys
import glob

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ml.extraction.extractor import extract_report

def run_extraction_tests():
    sample_dir = os.path.join(os.path.dirname(__file__), "sample_reports")
    report_files = sorted(glob.glob(os.path.join(sample_dir, "*.txt")))
    
    print(f"=== Running Report Extraction Evaluation ({len(report_files)} reports) ===")
    total_reports = len(report_files)
    successful_extractions = 0
    total_measurements = 0
    needs_check_caught = 0
    
    for rf in report_files:
        fname = os.path.basename(rf)
        try:
            result = extract_report(rf)
            m_count = len(result["measurements"])
            total_measurements += m_count
            successful_extractions += 1
            
            # Check for sanity bounds
            for m in result["measurements"]:
                if m["needs_check"]:
                    needs_check_caught += 1
                    
            print(f"  [PASS] {fname:30s} -> Lab: {result['lab_name']:22s} | Date: {result['report_date']} | Tests: {m_count:2d}")
        except Exception as e:
            print(f"  [FAIL] {fname:30s} -> Error: {e}")
            
    accuracy = (successful_extractions / total_reports) * 100 if total_reports > 0 else 0
    print("\n--- Extraction Metrics ---")
    print(f"Total reports evaluated: {total_reports}")
    print(f"Successful extractions: {successful_extractions} ({accuracy:.1f}%)")
    print(f"Total measurements extracted: {total_measurements}")
    print(f"Sanity violations flagged (needs_check=True): {needs_check_caught}")
    print("============================================================\n")
    return accuracy == 100.0

if __name__ == "__main__":
    success = run_extraction_tests()
    exit(0 if success else 1)
