"""
Demo Patients Module for ReportSetu (ML 2).
Builds the 5 canonical synthetic demo patients specified in Section 7 of the build plan.
Saves data as `demo_patients.json` for backend database seeding.
"""

import json
import os
from typing import Dict, Any, List


def get_demo_patients() -> List[Dict[str, Any]]:
    """
    Returns the 5 canonical synthetic demo patients matching Section 7.
    
    Patient A: Platelets suddenly very low in latest report -> Expected: Critical
    Patient B: Haemoglobin falling across 3 reports -> Expected: Review
    Patient C: HbA1c rising across 4 reports; forecast above range -> Expected: Review
    Patient D: One slightly high value, otherwise stable -> Expected: Stable
    Patient E: Only 1 report, so no forecast and a warning shown -> Expected: Stable
    """
    return [
        {
            "id": 1,
            "patient_code": "PAT-A",
            "name": "Aarav Sharma (Patient A)",
            "age": 46,
            "gender": "Male",
            "story": "Platelets suddenly very low in the latest report",
            "expected_priority": "critical",
            "reports": [
                {
                    "report_id": 101,
                    "date": "2026-04-12",
                    "lab_name": "Apollo Diagnostics",
                    "measurements": [
                        {"test_code": "HB", "test_name": "Haemoglobin", "value": 14.5, "unit": "g/dL", "ref_low": 13.0, "ref_high": 17.0, "flag": "normal", "needs_check": False},
                        {"test_code": "WBC", "test_name": "Total Leukocyte Count", "value": 6.8, "unit": "10^3/uL", "ref_low": 4.0, "ref_high": 11.0, "flag": "normal", "needs_check": False},
                        {"test_code": "PLT", "test_name": "Platelet Count", "value": 220.0, "unit": "10^3/uL", "ref_low": 150.0, "ref_high": 450.0, "flag": "normal", "needs_check": False},
                        {"test_code": "HBA1C", "test_name": "HbA1c", "value": 5.4, "unit": "%", "ref_low": 4.0, "ref_high": 5.7, "flag": "normal", "needs_check": False},
                    ]
                },
                {
                    "report_id": 102,
                    "date": "2026-07-15",
                    "lab_name": "Apollo Diagnostics",
                    "measurements": [
                        {"test_code": "HB", "test_name": "Haemoglobin", "value": 14.1, "unit": "g/dL", "ref_low": 13.0, "ref_high": 17.0, "flag": "normal", "needs_check": False},
                        {"test_code": "WBC", "test_name": "Total Leukocyte Count", "value": 7.2, "unit": "10^3/uL", "ref_low": 4.0, "ref_high": 11.0, "flag": "normal", "needs_check": False},
                        {"test_code": "PLT", "test_name": "Platelet Count", "value": 195.0, "unit": "10^3/uL", "ref_low": 150.0, "ref_high": 450.0, "flag": "normal", "needs_check": False},
                    ]
                },
                {
                    "report_id": 103,
                    "date": "2026-10-15",
                    "lab_name": "Apollo Diagnostics",
                    "measurements": [
                        {"test_code": "HB", "test_name": "Haemoglobin", "value": 13.8, "unit": "g/dL", "ref_low": 13.0, "ref_high": 17.0, "flag": "normal", "needs_check": False},
                        {"test_code": "WBC", "test_name": "Total Leukocyte Count", "value": 7.5, "unit": "10^3/uL", "ref_low": 4.0, "ref_high": 11.0, "flag": "normal", "needs_check": False},
                        {"test_code": "PLT", "test_name": "Platelet Count", "value": 35.0, "unit": "10^3/uL", "ref_low": 150.0, "ref_high": 450.0, "flag": "critical_low", "needs_check": False},
                    ]
                }
            ]
        },
        {
            "id": 2,
            "patient_code": "PAT-B",
            "name": "Bhavna Patel (Patient B)",
            "age": 52,
            "gender": "Female",
            "story": "Haemoglobin falling across 3 reports",
            "expected_priority": "review",
            "reports": [
                {
                    "report_id": 201,
                    "date": "2026-04-10",
                    "lab_name": "Dr Lal PathLabs",
                    "measurements": [
                        {"test_code": "HB", "test_name": "Haemoglobin", "value": 13.8, "unit": "g/dL", "ref_low": 12.0, "ref_high": 15.5, "flag": "normal", "needs_check": False},
                        {"test_code": "WBC", "test_name": "Total Leukocyte Count", "value": 6.2, "unit": "10^3/uL", "ref_low": 4.0, "ref_high": 10.0, "flag": "normal", "needs_check": False},
                        {"test_code": "PLT", "test_name": "Platelet Count", "value": 240.0, "unit": "10^3/uL", "ref_low": 150.0, "ref_high": 450.0, "flag": "normal", "needs_check": False},
                        {"test_code": "HCT", "test_name": "Packed Cell Volume (PCV/HCT)", "value": 41.5, "unit": "%", "ref_low": 36.0, "ref_high": 46.0, "flag": "normal", "needs_check": False},
                    ]
                },
                {
                    "report_id": 202,
                    "date": "2026-07-08",
                    "lab_name": "Dr Lal PathLabs",
                    "measurements": [
                        {"test_code": "HB", "test_name": "Haemoglobin", "value": 12.1, "unit": "g/dL", "ref_low": 12.0, "ref_high": 15.5, "flag": "normal", "needs_check": False},
                        {"test_code": "WBC", "test_name": "Total Leukocyte Count", "value": 6.5, "unit": "10^3/uL", "ref_low": 4.0, "ref_high": 10.0, "flag": "normal", "needs_check": False},
                        {"test_code": "PLT", "test_name": "Platelet Count", "value": 230.0, "unit": "10^3/uL", "ref_low": 150.0, "ref_high": 450.0, "flag": "normal", "needs_check": False},
                    ]
                },
                {
                    "report_id": 203,
                    "date": "2026-10-02",
                    "lab_name": "Dr Lal PathLabs",
                    "measurements": [
                        {"test_code": "HB", "test_name": "Haemoglobin", "value": 10.4, "unit": "g/dL", "ref_low": 12.0, "ref_high": 15.5, "flag": "low", "needs_check": False},
                        {"test_code": "WBC", "test_name": "Total Leukocyte Count", "value": 6.9, "unit": "10^3/uL", "ref_low": 4.0, "ref_high": 10.0, "flag": "normal", "needs_check": False},
                        {"test_code": "PLT", "test_name": "Platelet Count", "value": 225.0, "unit": "10^3/uL", "ref_low": 150.0, "ref_high": 450.0, "flag": "normal", "needs_check": False},
                    ]
                }
            ]
        },
        {
            "id": 3,
            "patient_code": "PAT-C",
            "name": "Chetan Verma (Patient C)",
            "age": 58,
            "gender": "Male",
            "story": "HbA1c rising across 4 reports; forecast above range",
            "expected_priority": "review",
            "reports": [
                {
                    "report_id": 301,
                    "date": "2025-10-05",
                    "lab_name": "SRL Diagnostics",
                    "measurements": [
                        {"test_code": "HBA1C", "test_name": "HbA1c", "value": 5.8, "unit": "%", "ref_low": 4.0, "ref_high": 5.7, "flag": "high", "needs_check": False},
                        {"test_code": "HB", "test_name": "Haemoglobin", "value": 14.0, "unit": "g/dL", "ref_low": 13.0, "ref_high": 17.0, "flag": "normal", "needs_check": False},
                        {"test_code": "PLT", "test_name": "Platelet Count", "value": 210.0, "unit": "10^3/uL", "ref_low": 150.0, "ref_high": 450.0, "flag": "normal", "needs_check": False},
                    ]
                },
                {
                    "report_id": 302,
                    "date": "2026-01-18",
                    "lab_name": "SRL Diagnostics",
                    "measurements": [
                        {"test_code": "HBA1C", "test_name": "HbA1c", "value": 6.3, "unit": "%", "ref_low": 4.0, "ref_high": 5.7, "flag": "high", "needs_check": False},
                        {"test_code": "HB", "test_name": "Haemoglobin", "value": 13.9, "unit": "g/dL", "ref_low": 13.0, "ref_high": 17.0, "flag": "normal", "needs_check": False},
                    ]
                },
                {
                    "report_id": 303,
                    "date": "2026-04-22",
                    "lab_name": "SRL Diagnostics",
                    "measurements": [
                        {"test_code": "HBA1C", "test_name": "HbA1c", "value": 6.7, "unit": "%", "ref_low": 4.0, "ref_high": 5.7, "flag": "high", "needs_check": False},
                        {"test_code": "HB", "test_name": "Haemoglobin", "value": 13.8, "unit": "g/dL", "ref_low": 13.0, "ref_high": 17.0, "flag": "normal", "needs_check": False},
                    ]
                },
                {
                    "report_id": 304,
                    "date": "2026-08-01",
                    "lab_name": "SRL Diagnostics",
                    "measurements": [
                        {"test_code": "HBA1C", "test_name": "HbA1c", "value": 7.2, "unit": "%", "ref_low": 4.0, "ref_high": 5.7, "flag": "high", "needs_check": False},
                        {"test_code": "HB", "test_name": "Haemoglobin", "value": 13.7, "unit": "g/dL", "ref_low": 13.0, "ref_high": 17.0, "flag": "normal", "needs_check": False},
                        {"test_code": "PLT", "test_name": "Platelet Count", "value": 205.0, "unit": "10^3/uL", "ref_low": 150.0, "ref_high": 450.0, "flag": "normal", "needs_check": False},
                    ]
                }
            ]
        },
        {
            "id": 4,
            "patient_code": "PAT-D",
            "name": "Deepa Nair (Patient D)",
            "age": 39,
            "gender": "Female",
            "story": "One slightly high value, otherwise stable",
            "expected_priority": "stable",
            "reports": [
                {
                    "report_id": 401,
                    "date": "2026-05-10",
                    "lab_name": "Metropolis Healthcare",
                    "measurements": [
                        {"test_code": "HB", "test_name": "Haemoglobin", "value": 13.2, "unit": "g/dL", "ref_low": 12.0, "ref_high": 15.5, "flag": "normal", "needs_check": False},
                        {"test_code": "WBC", "test_name": "Total Leukocyte Count", "value": 7.1, "unit": "10^3/uL", "ref_low": 4.0, "ref_high": 10.0, "flag": "normal", "needs_check": False},
                        {"test_code": "PLT", "test_name": "Platelet Count", "value": 260.0, "unit": "10^3/uL", "ref_low": 150.0, "ref_high": 450.0, "flag": "normal", "needs_check": False},
                        {"test_code": "HBA1C", "test_name": "HbA1c", "value": 5.3, "unit": "%", "ref_low": 4.0, "ref_high": 5.7, "flag": "normal", "needs_check": False},
                    ]
                },
                {
                    "report_id": 402,
                    "date": "2026-10-05",
                    "lab_name": "Metropolis Healthcare",
                    "measurements": [
                        {"test_code": "HB", "test_name": "Haemoglobin", "value": 13.0, "unit": "g/dL", "ref_low": 12.0, "ref_high": 15.5, "flag": "normal", "needs_check": False},
                        {"test_code": "WBC", "test_name": "Total Leukocyte Count", "value": 11.2, "unit": "10^3/uL", "ref_low": 4.0, "ref_high": 10.0, "flag": "high", "needs_check": False},
                        {"test_code": "PLT", "test_name": "Platelet Count", "value": 255.0, "unit": "10^3/uL", "ref_low": 150.0, "ref_high": 450.0, "flag": "normal", "needs_check": False},
                        {"test_code": "HBA1C", "test_name": "HbA1c", "value": 5.4, "unit": "%", "ref_low": 4.0, "ref_high": 5.7, "flag": "normal", "needs_check": False},
                    ]
                }
            ]
        },
        {
            "id": 5,
            "patient_code": "PAT-E",
            "name": "Eshaan Mukherjee (Patient E)",
            "age": 31,
            "gender": "Male",
            "story": "Only 1 report, so no forecast and a warning shown",
            "expected_priority": "stable",
            "reports": [
                {
                    "report_id": 501,
                    "date": "2026-10-12",
                    "lab_name": "Max Lab Pathology",
                    "measurements": [
                        {"test_code": "HB", "test_name": "Haemoglobin", "value": 14.8, "unit": "g/dL", "ref_low": 13.0, "ref_high": 17.0, "flag": "normal", "needs_check": False},
                        {"test_code": "WBC", "test_name": "Total Leukocyte Count", "value": 6.4, "unit": "10^3/uL", "ref_low": 4.0, "ref_high": 11.0, "flag": "normal", "needs_check": False},
                        {"test_code": "PLT", "test_name": "Platelet Count", "value": 230.0, "unit": "10^3/uL", "ref_low": 150.0, "ref_high": 450.0, "flag": "normal", "needs_check": False},
                        {"test_code": "HBA1C", "test_name": "HbA1c", "value": 5.5, "unit": "%", "ref_low": 4.0, "ref_high": 5.7, "flag": "normal", "needs_check": False},
                    ]
                }
            ]
        }
    ]


def save_demo_patients_json():
    """Generates and writes demo_patients.json into ml/data/."""
    patients = get_demo_patients()
    data_dir = os.path.dirname(__file__)
    out_path = os.path.join(data_dir, "demo_patients.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(patients, f, indent=2)
    print(f"Saved {len(patients)} demo patients to {out_path}")
    return out_path


if __name__ == "__main__":
    save_demo_patients_json()
