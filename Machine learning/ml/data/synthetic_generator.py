"""
Synthetic Longitudinal Patient Dataset Generator for ReportSetu (ML 2).
Generates ~200 longitudinal patients (3–6 reports each) with clinically realistic CBC and HbA1c values,
splits by patient for train and test (80/20), and saves as JSON files.
"""

import json
import os
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any
import numpy as np

# Seed for reproducibility
random.seed(42)
np.random.seed(42)


def generate_synthetic_dataset(num_patients: int = 200) -> List[Dict[str, Any]]:
    """
    Generates realistic longitudinal patient trajectories.
    """
    patients: List[Dict[str, Any]] = []
    
    first_names_male = ["Rohan", "Vikram", "Sunil", "Rajesh", "Karan", "Suresh", "Arjun", "Aditya", "Manish", "Deepak"]
    first_names_female = ["Ananya", "Pooja", "Sunita", "Meera", "Kavita", "Ritu", "Neha", "Divya", "Shalini", "Priya"]
    last_names = ["Kumar", "Sharma", "Verma", "Singh", "Gupta", "Mehta", "Iyer", "Patel", "Reddy", "Joshi"]
    
    labs = ["Dr Lal PathLabs", "Apollo Diagnostics", "SRL Diagnostics", "Metropolis Healthcare", "Quest Diagnostics"]
    
    start_base_date = datetime(2025, 1, 15)
    
    for i in range(1, num_patients + 1):
        patient_id = 100 + i
        gender = "Male" if random.random() < 0.5 else "Female"
        fname = random.choice(first_names_male if gender == "Male" else first_names_female)
        lname = random.choice(last_names)
        name = f"{fname} {lname}"
        age = random.randint(22, 76)
        
        # Clinical trajectory profile:
        # 75% Stable, 10% Falling Hb (anemia), 10% Rising HbA1c (diabetes progression), 5% Acute Anomaly
        r_type = random.random()
        if r_type < 0.75:
            cohort = "stable"
        elif r_type < 0.85:
            cohort = "falling_hb"
        elif r_type < 0.95:
            cohort = "rising_hba1c"
        else:
            cohort = "acute_anomaly"
            
        # Baseline parameter means
        base_hb = random.gauss(15.0, 1.0) if gender == "Male" else random.gauss(13.2, 0.9)
        base_wbc = random.gauss(7.0, 1.2)
        base_plt = random.gauss(260.0, 45.0)
        
        # Baseline HbA1c
        if cohort == "rising_hba1c":
            base_a1c = random.gauss(6.2, 0.4)
        else:
            base_a1c = random.gauss(5.3, 0.3)
            
        n_reports = random.randint(3, 6)
        reports = []
        cur_date = start_base_date + timedelta(days=random.randint(0, 45))
        
        curr_hb = base_hb
        curr_wbc = base_wbc
        curr_plt = base_plt
        curr_a1c = base_a1c
        
        for r_idx in range(n_reports):
            # Advance date by 60 to 110 days
            cur_date += timedelta(days=random.randint(60, 110))
            d_str = cur_date.strftime("%Y-%m-%d")
            lab = random.choice(labs)
            
            # Trajectory modifications
            if cohort == "stable":
                hb_val = round(curr_hb + random.gauss(0, 0.3), 1)
                wbc_val = round(curr_wbc + random.gauss(0, 0.4), 2)
                plt_val = round(curr_plt + random.gauss(0, 15.0), 1)
                a1c_val = round(curr_a1c + random.gauss(0, 0.1), 1)
            elif cohort == "falling_hb":
                # Drops 0.6 - 1.2 g/dL per visit
                curr_hb -= random.uniform(0.6, 1.1)
                hb_val = round(max(7.2, curr_hb), 1)
                wbc_val = round(curr_wbc + random.gauss(0, 0.3), 2)
                plt_val = round(curr_plt + random.gauss(0, 15.0), 1)
                a1c_val = round(curr_a1c + random.gauss(0, 0.1), 1)
            elif cohort == "rising_hba1c":
                # Rises 0.3 - 0.7 % per visit
                curr_a1c += random.uniform(0.3, 0.6)
                a1c_val = round(min(12.5, curr_a1c), 1)
                hb_val = round(curr_hb + random.gauss(0, 0.3), 1)
                wbc_val = round(curr_wbc + random.gauss(0, 0.3), 2)
                plt_val = round(curr_plt + random.gauss(0, 15.0), 1)
            else: # acute anomaly in the last report
                if r_idx == n_reports - 1:
                    # Acute drop in platelets or acute drop in Hb
                    plt_val = round(random.uniform(25.0, 48.0), 1) # critical low
                    hb_val = round(curr_hb, 1)
                    wbc_val = round(curr_wbc, 2)
                    a1c_val = round(curr_a1c, 1)
                else:
                    hb_val = round(curr_hb + random.gauss(0, 0.3), 1)
                    wbc_val = round(curr_wbc + random.gauss(0, 0.4), 2)
                    plt_val = round(curr_plt + random.gauss(0, 15.0), 1)
                    a1c_val = round(curr_a1c + random.gauss(0, 0.1), 1)
                    
            # Compute flags
            hb_flag = "critical_low" if hb_val < 7.0 else ("low" if hb_val < 12.0 else "normal")
            plt_flag = "critical_low" if plt_val < 50.0 else ("low" if plt_val < 150.0 else "normal")
            wbc_flag = "high" if wbc_val > 11.0 else ("low" if wbc_val < 4.0 else "normal")
            a1c_flag = "high" if a1c_val > 5.7 else "normal"
            
            measurements = [
                {"report_id": patient_id * 100 + r_idx, "test_code": "HB", "test_name": "Haemoglobin", "value": hb_val, "unit": "g/dL", "ref_low": 12.0, "ref_high": 17.5, "date": d_str, "flag": hb_flag, "needs_check": False},
                {"report_id": patient_id * 100 + r_idx, "test_code": "WBC", "test_name": "Total Leukocyte Count (WBC)", "value": wbc_val, "unit": "10^3/uL", "ref_low": 4.0, "ref_high": 11.0, "date": d_str, "flag": wbc_flag, "needs_check": False},
                {"report_id": patient_id * 100 + r_idx, "test_code": "PLT", "test_name": "Platelet Count", "value": plt_val, "unit": "10^3/uL", "ref_low": 150.0, "ref_high": 450.0, "date": d_str, "flag": plt_flag, "needs_check": False},
                {"report_id": patient_id * 100 + r_idx, "test_code": "HBA1C", "test_name": "HbA1c", "value": a1c_val, "unit": "%", "ref_low": 4.0, "ref_high": 5.7, "date": d_str, "flag": a1c_flag, "needs_check": False},
            ]
            
            reports.append({
                "report_id": patient_id * 100 + r_idx,
                "date": d_str,
                "lab_name": lab,
                "measurements": measurements
            })
            
        patients.append({
            "id": patient_id,
            "patient_code": f"SYN-{patient_id}",
            "name": name,
            "age": age,
            "gender": gender,
            "cohort": cohort,
            "reports": reports
        })
        
    return patients


def generate_and_save_split_datasets(num_patients: int = 200, train_ratio: float = 0.8):
    """Generates synthetic dataset, performs patient-level 80/20 split, and saves JSONs."""
    patients = generate_synthetic_dataset(num_patients)
    
    # Shuffle patients
    random.shuffle(patients)
    split_idx = int(len(patients) * train_ratio)
    
    train_patients = patients[:split_idx]
    test_patients = patients[split_idx:]
    
    data_dir = os.path.dirname(__file__)
    train_path = os.path.join(data_dir, "synthetic_train.json")
    test_path = os.path.join(data_dir, "synthetic_test.json")
    
    with open(train_path, "w", encoding="utf-8") as f:
        json.dump(train_patients, f, indent=2)
        
    with open(test_path, "w", encoding="utf-8") as f:
        json.dump(test_patients, f, indent=2)
        
    print(f"Generated {len(patients)} synthetic patients:")
    print(f"  - Train Set: {len(train_patients)} patients saved to {train_path}")
    print(f"  - Test Set:  {len(test_patients)} patients saved to {test_path}")
    return train_path, test_path


if __name__ == "__main__":
    generate_and_save_split_datasets(200)
