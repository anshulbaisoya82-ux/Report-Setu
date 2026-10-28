"""
Test Suite for HbA1c Forecaster (ML 2).
Validates 90-day linear regression forecast, uncertainty interval,
and insufficient reading fallback behavior.
"""

import os
import sys

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ml.forecast.hba1c_forecaster import forecast_hba1c


def run_forecast_tests():
    print("=== Running HbA1c Forecaster Evaluation ===")
    
    # 1. Test case: Patient with 4 rising readings (e.g. Patient C)
    rising_readings = [
        {"test_code": "HBA1C", "value": 5.8, "date": "2025-10-01"},
        {"test_code": "HBA1C", "value": 6.3, "date": "2026-01-15"},
        {"test_code": "HBA1C", "value": 6.7, "date": "2026-04-20"},
        {"test_code": "HBA1C", "value": 7.2, "date": "2026-07-30"},
    ]
    
    res = forecast_hba1c(rising_readings)
    print(f"Forecast for 4 rising readings: {res}")
    assert res["estimate"] is not None, "Estimate should not be None for 4 readings!"
    assert res["warning"] is None, "Warning should be None for 4 readings!"
    assert res["low"] <= res["estimate"] <= res["high"], "Invalid prediction interval bounds!"
    assert res["baseline_estimate"] == 7.2, "Baseline estimate should match latest reading!"
    assert res["estimate"] > 7.2, "Expected upward trend estimate to exceed latest reading!"
    print("  -> Longitudinal forecast with prediction interval passed.")
    
    # 2. Test case: Only 1 reading (Patient E case)
    single_reading = [
        {"test_code": "HBA1C", "value": 6.2, "date": "2026-10-01"}
    ]
    res_single = forecast_hba1c(single_reading)
    print(f"\nForecast for 1 reading: {res_single}")
    assert res_single["estimate"] is None, "Estimate must be None for 1 reading!"
    assert res_single["warning"] == "Not enough readings to forecast", "Expected insufficient data warning!"
    print("  -> Single reading fallback passed.")
    
    # 3. Test case: 2 readings (still < 3)
    two_readings = [
        {"test_code": "HBA1C", "value": 6.0, "date": "2026-05-01"},
        {"test_code": "HBA1C", "value": 6.4, "date": "2026-08-01"},
    ]
    res_two = forecast_hba1c(two_readings)
    print(f"\nForecast for 2 readings: {res_two}")
    assert res_two["estimate"] is None, "Estimate must be None for 2 readings!"
    assert res_two["warning"] == "Not enough readings to forecast"
    print("  -> Two readings fallback passed.")
    
    print("\n=== Forecast Tests Passed Successfully ===\n")
    return True


if __name__ == "__main__":
    success = run_forecast_tests()
    exit(0 if success else 1)
