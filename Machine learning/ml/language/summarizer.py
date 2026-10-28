"""
Patient Summary Generator Module for ReportSetu (ML 1).
Generates plain-language, non-alarmist patient summaries in English and Hindi.

STRICT CONSTRAINTS (Section 3 & 5):
- Never names a disease (no 'diabetes', 'anemia', 'infection', 'cancer', etc.)
- Never names a medicine (no 'metformin', 'insulin', 'antibiotics', etc.)
- Short plain text, at most 120 words.
"""

from typing import List, Dict, Any, Optional

# Prohibited disease keywords
FORBIDDEN_DISEASES = [
    "diabetes", "diabetic", "anemia", "anaemia", "cancer", "leukemia",
    "infection", "thrombocytopenia", "polycythemia", "illness", "disorder",
    "syndrome", "pathology", "malignancy", "sepsis"
]

# Prohibited medicine keywords
FORBIDDEN_MEDICINES = [
    "metformin", "insulin", "aspirin", "antibiotic", "medicine", "medication",
    "drug", "paracetamol", "atorvastatin", "glimepiride", "pill", "tablet", "dose"
]


def sanitize_text(text: str) -> str:
    """Ensure no prohibited disease or medicine names exist in generated text."""
    words = text.split()
    cleaned_words = []
    for w in words:
        w_lower = w.lower().strip(".,!?:;()")
        if w_lower in FORBIDDEN_DISEASES or w_lower in FORBIDDEN_MEDICINES:
            continue
        cleaned_words.append(w)
    return " ".join(cleaned_words)


def draft_summary(
    measurements: List[Dict[str, Any]],
    insights: List[Dict[str, Any]],
    lang: str = "en"
) -> str:
    """
    Drafts a patient-friendly summary from verified values and insights.
    
    Inputs:
        measurements: list of Measurement dicts
        insights: list of Insight dicts
        lang: 'en' for English or 'hi' for Hindi
        
    Output:
        Plain text string, at most 120 words, strictly devoid of disease/medicine names.
    """
    # Extract key parameter statuses
    m_dict = {m.get("test_code"): m for m in measurements if isinstance(m, dict)}
    
    hb = m_dict.get("HB")
    plt = m_dict.get("PLT")
    wbc = m_dict.get("WBC")
    a1c = m_dict.get("HBA1C")
    
    # Check abnormal flags
    critical_flags = [m for m in measurements if m.get("flag") in ("critical_low", "critical_high")]
    high_flags = [m for m in measurements if m.get("flag") == "high"]
    low_flags = [m for m in measurements if m.get("flag") == "low"]
    
    # Check insights
    falling_trends = [i for i in insights if i.get("direction") == "falling" and i.get("severity") in ("critical", "review")]
    rising_trends = [i for i in insights if i.get("direction") == "rising" and i.get("severity") in ("critical", "review")]
    
    if lang.lower() == "hi":
        # Hindi summary draft
        parts = ["आपकी हालिया लैब जांच रिपोर्ट तैयार है।"]
        
        if critical_flags:
            test_names = ", ".join([c.get("test_name", "जांच") for c in critical_flags])
            parts.append(f"{test_names} के स्तर में विशेष बदलाव देखा गया है, जिस पर डॉक्टर का ध्यान आवश्यक है।")
        elif high_flags or low_flags:
            parts.append("कुछ मापदंड सामान्य सीमा से थोड़े भिन्न पाए गए हैं।")
        else:
            parts.append("आपके सभी मुख्य रक्त मापदंड सामान्य दायरे में हैं।")
            
        if a1c:
            val = a1c.get("value")
            if val and val > 6.0:
                parts.append(f"तीन महीने के औसत शर्करा सूचकांक का स्तर {val}% दर्ज किया गया है।")
            else:
                parts.append(f"शर्करा सूचकांक का स्तर {val}% स्थिर बना हुआ है।")
                
        if hb:
            val = hb.get("value")
            parts.append(f"हीमोग्लोबिन का स्तर {val} g/dL है।")
            
        parts.append("कृपया अपने डॉक्टर से आगामी परामर्श के दौरान इन नतीजों पर विस्तार से चर्चा करें।")
        raw_summary = " ".join(parts)
    else:
        # English summary draft
        parts = ["Here is a plain-language summary of your latest lab report."]
        
        if critical_flags:
            names = ", ".join([c.get("test_name", "parameter") for c in critical_flags])
            parts.append(f"A significant shift was noted in your {names}, which your doctor will carefully evaluate.")
        elif falling_trends:
            test_name = falling_trends[0].get("test_code", "count")
            parts.append(f"Your {test_name} values show a downward trend compared to prior reports.")
        elif rising_trends:
            test_name = rising_trends[0].get("test_code", "count")
            parts.append(f"Your {test_name} values show an upward trend compared to your earlier tests.")
        elif high_flags or low_flags:
            parts.append("A few parameters are slightly outside the standard reference brackets.")
        else:
            parts.append("Your blood cell counts and key indicators are steady and within healthy reference ranges.")
            
        if a1c:
            parts.append(f"Your three-month sugar indicator is currently at {a1c.get('value')}%.")
        if hb:
            parts.append(f"Your haemoglobin level is recorded at {hb.get('value')} g/dL.")
        if plt and not critical_flags:
            parts.append(f"Your platelet count stands at {plt.get('value')} 10^3/uL.")
            
        parts.append("Please review these results with your doctor during your next scheduled appointment.")
        raw_summary = " ".join(parts)
        
    cleaned = sanitize_text(raw_summary)
    
    # Enforce word limit (at most 120 words)
    words = cleaned.split()
    if len(words) > 120:
        cleaned = " ".join(words[:120]) + "."
        
    return cleaned
