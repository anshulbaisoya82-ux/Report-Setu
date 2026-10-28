"""
Report Extraction Module for ReportSetu (ML 1).
Extracts CBC parameters and HbA1c measurements from PDF and image files,
returning structured JSON conforming to Section 5 contracts.
"""

import os
import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from .name_matching import match_test_name, TEST_METADATA
from .units_and_sanity import normalize_unit_and_value, check_sanity, determine_flag


def parse_date(text: str) -> str:
    """Extract report collection or generation date from raw text."""
    date_patterns = [
        r'(?:date|collected|reported|dated)[\s:]*([0-9]{4}-[0-9]{2}-[0-9]{2})',
        r'(?:date|collected|reported|dated)[\s:]*([0-9]{1,2}[-/\.][0-9]{1,2}[-/\.][0-9]{4})',
        r'([0-9]{4}-[0-9]{2}-[0-9]{2})',
        r'([0-9]{1,2}[-/\.][0-9]{1,2}[-/\.][0-9]{4})',
        r'([0-9]{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+[0-9]{4})'
    ]
    
    for pat in date_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            raw_d = match.group(1).strip()
            # Try formatting to YYYY-MM-DD
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%m/%d/%Y", "%d %b %Y", "%d %B %Y"):
                try:
                    dt = datetime.strptime(raw_d, fmt)
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    pass
                    
    # Default to today's date if not found in report
    return datetime.now().strftime("%Y-%m-%d")


def parse_lab_name(text: str) -> str:
    """Identify diagnostic laboratory name."""
    known_labs = [
        "Dr Lal PathLabs",
        "Apollo Diagnostics",
        "SRL Diagnostics",
        "Metropolis Healthcare",
        "Thyrocare",
        "Quest Diagnostics",
        "Max Lab",
        "Suburban Diagnostics",
        "Tata 1mg Diagnostics",
        "Pathkind Labs"
    ]
    for lab in known_labs:
        if re.search(r'\b' + re.escape(lab) + r'\b', text, re.IGNORECASE):
            return lab
            
    # Try looking for "Laboratory" or "Diagnostics" in header lines
    lines = text.split("\n")[:10]
    for line in lines:
        line_clean = line.strip()
        if any(kw in line_clean.lower() for kw in ["diagnostic", "pathology", "hospital", "laboratory", "labs", "clinic"]):
            if len(line_clean) < 60:
                return line_clean
                
    return "City Diagnostics Laboratory"


def parse_reference_range(ref_str: str) -> Tuple[Optional[float], Optional[float]]:
    """Parse reference bounds like '13.0 - 17.0', '< 5.7', '4.0 to 11.0'."""
    if not ref_str:
        return None, None
        
    s = ref_str.strip()
    # Mask exponent units like 10^3, 10^6
    s_clean = re.sub(r'10\^[0-9]+', '', s)
    
    # '< 5.7' or '<= 5.7'
    m_less = re.search(r'<\s*=?\s*([0-9]+(?:\.[0-9]+)?)', s_clean)
    if m_less:
        return 0.0, float(m_less.group(1))
        
    # '> 4.0'
    m_more = re.search(r'>\s*=?\s*([0-9]+(?:\.[0-9]+)?)', s_clean)
    if m_more:
        return float(m_more.group(1)), None
        
    # Range inside parentheses e.g. (12.0 - 15.5) or (12.0 to 15.5)
    paren_match = re.search(r'\(([^)]+)\)', s_clean)
    if paren_match:
        m_range = re.findall(r'([0-9]+(?:\.[0-9]+)?)', paren_match.group(1))
        if len(m_range) >= 2:
            return float(m_range[0]), float(m_range[1])
            
    # Range '4.0 - 10.0' or '4.0 to 10.0'
    m_range = re.findall(r'([0-9]+(?:\.[0-9]+)?)', s_clean)
    if len(m_range) >= 2:
        return float(m_range[-2]), float(m_range[-1])
        
    return None, None


def extract_text_from_file(file_path: str) -> str:
    """Extract raw text from PDF or image using available engines."""
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
            
    if ext == ".pdf":
        try:
            import pypdfium2 as pdfium
            pdf = pdfium.PdfDocument(file_path)
            extracted_pages = []
            for page in pdf:
                textpage = page.get_textpage()
                extracted_pages.append(textpage.get_text_range())
            full_text = "\n".join(extracted_pages).strip()
            if len(full_text) > 40:
                return full_text
        except Exception:
            pass

    # Image or scanned PDF fallback
    try:
        from PIL import Image
        import pytesseract
        img = Image.open(file_path)
        return pytesseract.image_to_string(img)
    except Exception:
        pass
        
    # Fallback with EasyOCR
    try:
        import easyocr
        reader = easyocr.Reader(['en'], gpu=False)
        result = reader.readtext(file_path, detail=0)
        return "\n".join(result)
    except Exception:
        pass

    return ""


def parse_measurements_from_text(raw_text: str, report_date: str) -> List[Dict[str, Any]]:
    """Parse laboratory measurements from plain or OCR text."""
    measurements: List[Dict[str, Any]] = []
    seen_codes = set()
    
    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
    
    for line in lines:
        # Check if line has a separator like ':'
        matched_result = None
        target_val = None
        rest_of_line = ""
        
        if ":" in line:
            parts = line.split(":", 1)
            matched = match_test_name(parts[0].strip())
            if matched:
                matched_result = matched
                rest_of_line = parts[1].strip()
                # Mask out exponent units in rest_of_line when finding target value
                rest_masked = re.sub(r'10\^[0-9]+', 'UNIT_EXP', rest_of_line)
                num_matches = list(re.finditer(r'([0-9]+(?:\.[0-9]+)?)', rest_masked))
                if num_matches:
                    target_val = float(num_matches[0].group(1))
                    
        if not matched_result or target_val is None:
            # Mask out exponent units before search
            line_masked = re.sub(r'10\^[0-9]+', 'UNIT_EXP', line)
            matches = list(re.finditer(r'([0-9]+(?:\.[0-9]+)?)', line_masked))
            if not matches:
                continue
                
            for m in matches:
                prefix = line[:m.start()].strip(" :-\t|")
                matched = match_test_name(prefix)
                if matched:
                    matched_result = matched
                    target_val = float(m.group(1))
                    rest_of_line = line[m.end():]
                    break
                    
        if not matched_result or target_val is None:
            continue
            
        test_code, test_name = matched_result
        if test_code in seen_codes:
            continue
            
        # Extract unit from rest of line
        unit_match = re.search(r'(g/dl|g/l|%|10\^3/ul|10\^6/ul|/ul|/cumm|fl|pg|cells/cumm|lakhs?|mmol/mol)', rest_of_line, re.IGNORECASE)
        raw_unit = unit_match.group(1) if unit_match else None
        
        # Reference bounds
        ref_low, ref_high = parse_reference_range(rest_of_line)
        meta = TEST_METADATA.get(test_code, {})
        if ref_low is None:
            ref_low = meta.get("ref_low")
        if ref_high is None:
            ref_high = meta.get("ref_high")
            
        # Standardize units and values
        norm_val, std_unit = normalize_unit_and_value(test_code, target_val, raw_unit)
        needs_check = check_sanity(test_code, norm_val)
        flag = determine_flag(test_code, norm_val, ref_low, ref_high)
        
        measurements.append({
            "report_id": None,
            "test_code": test_code,
            "test_name": test_name,
            "value": norm_val,
            "unit": std_unit,
            "ref_low": ref_low,
            "ref_high": ref_high,
            "date": report_date,
            "flag": flag,
            "needs_check": needs_check
        })
        seen_codes.add(test_code)
        
    return measurements


def extract_report(file_path: str) -> Dict[str, Any]:
    """
    Extracts laboratory measurements from a given report file (PDF, Image, or Text).
    
    Conforms strictly to Section 5:
    Input: file_path (PDF or image)
    Output: {
        "report_date": "YYYY-MM-DD",
        "lab_name": str,
        "measurements": [Measurement]
    }
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Report file not found: {file_path}")
        
    text = extract_text_from_file(file_path)
    report_date = parse_date(text)
    lab_name = parse_lab_name(text)
    measurements = parse_measurements_from_text(text, report_date)
    
    return {
        "report_date": report_date,
        "lab_name": lab_name,
        "measurements": measurements
    }
