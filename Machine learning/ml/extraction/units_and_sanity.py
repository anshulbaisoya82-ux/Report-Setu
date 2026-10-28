"""
Units and Sanity Checks Module for ReportSetu.
Standardizes laboratory units and validates physiological sanity bounds,
setting the `needs_check` flag for impossible or suspect values.
"""

import re
from typing import Tuple, Optional
from .name_matching import TEST_METADATA


def normalize_unit_and_value(test_code: str, raw_value: float, raw_unit: Optional[str]) -> Tuple[float, str]:
    """
    Standardize measurements into canonical clinical units.
    Returns: (normalized_value, standardized_unit)
    """
    meta = TEST_METADATA.get(test_code, {})
    canonical_unit = meta.get("standard_unit", "")
    unit_str = (raw_unit or "").lower().strip()
    value = float(raw_value)
    
    if test_code == "PLT":
        # Platelets canonical: 10^3/uL (thousands per microliter)
        # e.g., 250,000 /uL -> 250.0; 2.5 Lakhs -> 250.0; 240 10^3/uL -> 240.0
        if "10^" in unit_str or "k/" in unit_str or "thousand" in unit_str:
            return round(value, 1), canonical_unit
        if "lakh" in unit_str or "lac" in unit_str or (value < 10.0 and value > 0.5):
            value = value * 100.0
        elif value > 1000.0:
            value = value / 1000.0
        return round(value, 1), canonical_unit
        
    elif test_code == "WBC":
        # WBC canonical: 10^3/uL (thousands per microliter)
        # e.g., 6800 /cumm -> 6.8; 7.2 10^3/uL -> 7.2
        if "10^" in unit_str or "k/" in unit_str or "thousand" in unit_str:
            return round(value, 2), canonical_unit
        if value > 100.0:
            value = value / 1000.0
        return round(value, 2), canonical_unit
        
    elif test_code == "RBC":
        # RBC canonical: 10^6/uL (millions per microliter)
        # e.g., 4,800,000 -> 4.8; 4.5 10^6/uL -> 4.5
        if "10^" in unit_str or "m/" in unit_str or "million" in unit_str:
            return round(value, 2), canonical_unit
        if value > 100000.0:
            value = value / 1000000.0
        return round(value, 2), canonical_unit
        
    elif test_code == "HB":
        # Hemoglobin canonical: g/dL
        # If in g/L (e.g. 135 g/L -> 13.5 g/dL)
        if "g/l" in unit_str or value > 35.0:
            value = value / 10.0
        elif "mmol/l" in unit_str:
            value = value * 1.611
        return round(value, 1), canonical_unit
        
    elif test_code == "HBA1C":
        # HbA1c canonical: %
        # If in mmol/mol (IFCC) e.g., 53 mmol/mol -> 7.0 %
        if "mmol/mol" in unit_str or value > 25.0:
            value = (0.09148 * value) + 2.152
        return round(value, 2), canonical_unit
        
    return round(value, 2), canonical_unit or (raw_unit or "")


def check_sanity(test_code: str, value: float) -> bool:
    """
    Returns True if the value is suspicious / physiologically impossible
    (i.e., needs_check = True for patient verification highlighting).
    """
    if value < 0:
        return True
        
    meta = TEST_METADATA.get(test_code)
    if not meta:
        return False
        
    sanity_min = meta.get("sanity_min")
    sanity_max = meta.get("sanity_max")
    
    if sanity_min is not None and value < sanity_min:
        return True
    if sanity_max is not None and value > sanity_max:
        return True
        
    return False


def determine_flag(
    test_code: str,
    value: float,
    ref_low: Optional[float] = None,
    ref_high: Optional[float] = None
) -> str:
    """
    Determines clinical flag:
    "critical_low", "low", "normal", "high", "critical_high", "missing"
    """
    if value is None:
        return "missing"
        
    meta = TEST_METADATA.get(test_code, {})
    critical_low = meta.get("critical_low")
    critical_high = meta.get("critical_high")
    
    # Priority 1: Critical boundaries
    if critical_low is not None and value < critical_low:
        return "critical_low"
    if critical_high is not None and value > critical_high:
        return "critical_high"
        
    # Priority 2: Lab printed range or clinical standard
    r_low = ref_low if ref_low is not None else meta.get("ref_low")
    r_high = ref_high if ref_high is not None else meta.get("ref_high")
    
    if r_low is not None and value < r_low:
        return "low"
    if r_high is not None and value > r_high:
        return "high"
        
    return "normal"
