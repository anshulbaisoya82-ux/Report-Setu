"""
Name Matching Module for ReportSetu.
Maps diverse laboratory nomenclature and synonyms to canonical test codes
for CBC parameters and HbA1c.
"""

import re
from typing import Optional, Tuple, Dict, Any

# Canonical metadata for supported parameters
TEST_METADATA: Dict[str, Dict[str, Any]] = {
    "HB": {
        "name": "Haemoglobin",
        "standard_unit": "g/dL",
        "ref_low": 12.0,
        "ref_high": 17.5,
        "critical_low": 7.0,
        "critical_high": 20.0,
        "sanity_min": 2.0,
        "sanity_max": 26.0,
    },
    "RBC": {
        "name": "RBC Count",
        "standard_unit": "10^6/uL",
        "ref_low": 4.0,
        "ref_high": 5.9,
        "critical_low": 2.0,
        "critical_high": 7.5,
        "sanity_min": 1.0,
        "sanity_max": 10.0,
    },
    "WBC": {
        "name": "Total Leukocyte Count (WBC)",
        "standard_unit": "10^3/uL",
        "ref_low": 4.0,
        "ref_high": 11.0,
        "critical_low": 2.0,
        "critical_high": 30.0,
        "sanity_min": 0.2,
        "sanity_max": 200.0,
    },
    "PLT": {
        "name": "Platelet Count",
        "standard_unit": "10^3/uL",
        "ref_low": 150.0,
        "ref_high": 450.0,
        "critical_low": 50.0,
        "critical_high": 1000.0,
        "sanity_min": 2.0,
        "sanity_max": 2500.0,
    },
    "HCT": {
        "name": "Packed Cell Volume (PCV/HCT)",
        "standard_unit": "%",
        "ref_low": 36.0,
        "ref_high": 50.0,
        "critical_low": 20.0,
        "critical_high": 60.0,
        "sanity_min": 10.0,
        "sanity_max": 75.0,
    },
    "MCV": {
        "name": "Mean Corpuscular Volume (MCV)",
        "standard_unit": "fL",
        "ref_low": 80.0,
        "ref_high": 100.0,
        "critical_low": 55.0,
        "critical_high": 130.0,
        "sanity_min": 40.0,
        "sanity_max": 150.0,
    },
    "MCH": {
        "name": "Mean Corpuscular Hemoglobin (MCH)",
        "standard_unit": "pg",
        "ref_low": 27.0,
        "ref_high": 33.0,
        "critical_low": 15.0,
        "critical_high": 45.0,
        "sanity_min": 12.0,
        "sanity_max": 55.0,
    },
    "MCHC": {
        "name": "MCHC",
        "standard_unit": "g/dL",
        "ref_low": 32.0,
        "ref_high": 36.0,
        "critical_low": 25.0,
        "critical_high": 40.0,
        "sanity_min": 20.0,
        "sanity_max": 45.0,
    },
    "RDW": {
        "name": "Red Cell Distribution Width (RDW)",
        "standard_unit": "%",
        "ref_low": 11.5,
        "ref_high": 14.5,
        "critical_low": 9.0,
        "critical_high": 25.0,
        "sanity_min": 8.0,
        "sanity_max": 35.0,
    },
    "NEUT": {
        "name": "Neutrophils",
        "standard_unit": "%",
        "ref_low": 40.0,
        "ref_high": 75.0,
        "critical_low": 15.0,
        "critical_high": 90.0,
        "sanity_min": 0.0,
        "sanity_max": 100.0,
    },
    "LYMPH": {
        "name": "Lymphocytes",
        "standard_unit": "%",
        "ref_low": 20.0,
        "ref_high": 45.0,
        "critical_low": 5.0,
        "critical_high": 80.0,
        "sanity_min": 0.0,
        "sanity_max": 100.0,
    },
    "MONO": {
        "name": "Monocytes",
        "standard_unit": "%",
        "ref_low": 2.0,
        "ref_high": 10.0,
        "critical_low": 0.0,
        "critical_high": 25.0,
        "sanity_min": 0.0,
        "sanity_max": 100.0,
    },
    "EOS": {
        "name": "Eosinophils",
        "standard_unit": "%",
        "ref_low": 1.0,
        "ref_high": 6.0,
        "critical_low": 0.0,
        "critical_high": 30.0,
        "sanity_min": 0.0,
        "sanity_max": 100.0,
    },
    "BASO": {
        "name": "Basophils",
        "standard_unit": "%",
        "ref_low": 0.0,
        "ref_high": 2.0,
        "critical_low": 0.0,
        "critical_high": 15.0,
        "sanity_min": 0.0,
        "sanity_max": 100.0,
    },
    "HBA1C": {
        "name": "HbA1c",
        "standard_unit": "%",
        "ref_low": 4.0,
        "ref_high": 5.7,
        "critical_low": 3.0,
        "critical_high": 10.0,
        "sanity_min": 3.0,
        "sanity_max": 20.0,
    },
}

# Synonyms dictionary mapping lowercase string patterns to canonical code
NAME_SYNONYMS = {
    # Hemoglobin
    "haemoglobin": "HB",
    "hemoglobin": "HB",
    "hb": "HB",
    "hgb": "HB",
    "haemoglobin (hb)": "HB",
    "hemoglobin (hgb)": "HB",
    "total hemoglobin": "HB",
    
    # RBC
    "rbc": "RBC",
    "rbc count": "RBC",
    "total rbc": "RBC",
    "total red blood cell count": "RBC",
    "red blood cells": "RBC",
    "erythrocyte count": "RBC",
    "red cell count": "RBC",
    "erythrocytes": "RBC",
    
    # WBC
    "wbc": "WBC",
    "wbc count": "WBC",
    "white blood cells": "WBC",
    "white blood cell count": "WBC",
    "total wbc count": "WBC",
    "total leukocyte count": "WBC",
    "total leucocyte count": "WBC",
    "tlc": "WBC",
    "leukocyte count": "WBC",
    "leukocytes": "WBC",
    
    # Platelets
    "platelet count": "PLT",
    "platelets": "PLT",
    "total platelet count": "PLT",
    "plt": "PLT",
    "thrombocytes": "PLT",
    "thrombocyte count": "PLT",
    "platelet": "PLT",
    
    # Hematocrit / PCV
    "hematocrit": "HCT",
    "haematocrit": "HCT",
    "packed cell volume": "HCT",
    "pcv": "HCT",
    "hct": "HCT",
    "packed cell volume (pcv)": "HCT",
    "pcv / hematocrit": "HCT",
    
    # MCV
    "mean corpuscular volume": "MCV",
    "mcv": "MCV",
    "mean cell volume": "MCV",
    
    # MCH
    "mean corpuscular hemoglobin": "MCH",
    "mean corpuscular haemoglobin": "MCH",
    "mch": "MCH",
    "mean cell hemoglobin": "MCH",
    
    # MCHC
    "mean corpuscular hemoglobin concentration": "MCHC",
    "mean corpuscular haemoglobin concentration": "MCHC",
    "mchc": "MCHC",
    "mean cell hemoglobin concentration": "MCHC",
    
    # RDW
    "red cell distribution width": "RDW",
    "rdw": "RDW",
    "rdw-cv": "RDW",
    "rdw cv": "RDW",
    "rdw-sd": "RDW",
    "rdw sd": "RDW",
    
    # Neutrophils
    "neutrophils": "NEUT",
    "neutrophil": "NEUT",
    "neutrophil percentage": "NEUT",
    "polymorphs": "NEUT",
    "segs": "NEUT",
    "segmented neutrophils": "NEUT",
    
    # Lymphocytes
    "lymphocytes": "LYMPH",
    "lymphocyte": "LYMPH",
    "lymphocyte percentage": "LYMPH",
    "lymphs": "LYMPH",
    
    # Monocytes
    "monocytes": "MONO",
    "monocyte": "MONO",
    "monocyte percentage": "MONO",
    
    # Eosinophils
    "eosinophils": "EOS",
    "eosinophil": "EOS",
    "eosinophil percentage": "EOS",
    
    # Basophils
    "basophils": "BASO",
    "basophil": "BASO",
    "basophil percentage": "BASO",
    
    # HbA1c
    "hba1c": "HBA1C",
    "hb a1c": "HBA1C",
    "glycated hemoglobin": "HBA1C",
    "glycated haemoglobin": "HBA1C",
    "glycosylated hemoglobin": "HBA1C",
    "glycosylated haemoglobin": "HBA1C",
    "hemoglobin a1c": "HBA1C",
    "haemoglobin a1c": "HBA1C",
    "glycohemoglobin": "HBA1C",
    "a1c": "HBA1C",
    "blood glucose glycated": "HBA1C",
}


def clean_name(raw_name: str) -> str:
    """Normalize raw string for dictionary matching."""
    s = raw_name.lower().strip()
    s = re.sub(r'[^a-z0-9\s\(\)\/\-]', '', s)
    s = re.sub(r'\s+', ' ', s)
    return s


def match_test_name(raw_name: str) -> Optional[Tuple[str, str]]:
    """
    Given an arbitrary lab test string, returns (test_code, canonical_name)
    or None if not a recognized CBC or HbA1c parameter.
    """
    cleaned = clean_name(raw_name)
    
    # Exact synonym match
    if cleaned in NAME_SYNONYMS:
        code = NAME_SYNONYMS[cleaned]
        return code, TEST_METADATA[code]["name"]
        
    # Partial matching for common patterns
    if "hba1c" in cleaned or "glycated" in cleaned or "glycosylated" in cleaned:
        return "HBA1C", TEST_METADATA["HBA1C"]["name"]
    if "haemoglobin" in cleaned or "hemoglobin" in cleaned:
        if "mchc" in cleaned or "concentration" in cleaned:
            return "MCHC", TEST_METADATA["MCHC"]["name"]
        if "mch" in cleaned:
            return "MCH", TEST_METADATA["MCH"]["name"]
        return "HB", TEST_METADATA["HB"]["name"]
    if "platelet" in cleaned or "thrombocyte" in cleaned:
        return "PLT", TEST_METADATA["PLT"]["name"]
    if "leukocyte" in cleaned or "leucocyte" in cleaned or "wbc" in cleaned or "tlc" in cleaned:
        return "WBC", TEST_METADATA["WBC"]["name"]
    if "red blood" in cleaned or "erythrocyte" in cleaned or "rbc" in cleaned:
        if "distribution" in cleaned or "rdw" in cleaned:
            return "RDW", TEST_METADATA["RDW"]["name"]
        return "RBC", TEST_METADATA["RBC"]["name"]
    if "packed cell" in cleaned or "hematocrit" in cleaned or "haematocrit" in cleaned or "pcv" in cleaned:
        return "HCT", TEST_METADATA["HCT"]["name"]
    if "mean corpuscular" in cleaned or "mean cell" in cleaned:
        if "volume" in cleaned:
            return "MCV", TEST_METADATA["MCV"]["name"]
        if "concentration" in cleaned:
            return "MCHC", TEST_METADATA["MCHC"]["name"]
        return "MCH", TEST_METADATA["MCH"]["name"]
    if "neutrophil" in cleaned:
        return "NEUT", TEST_METADATA["NEUT"]["name"]
    if "lymphocyte" in cleaned:
        return "LYMPH", TEST_METADATA["LYMPH"]["name"]
    if "monocyte" in cleaned:
        return "MONO", TEST_METADATA["MONO"]["name"]
    if "eosinophil" in cleaned:
        return "EOS", TEST_METADATA["EOS"]["name"]
    if "basophil" in cleaned:
        return "BASO", TEST_METADATA["BASO"]["name"]
        
    return None
