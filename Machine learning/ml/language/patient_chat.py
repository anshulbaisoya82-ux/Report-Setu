"""
Patient Chat Module for ReportSetu (ML 1 - P1).
Provides patient Q&A grounded strictly in the approved summary and trusted MedlinePlus info,
with safety guardrails that escalate questions about medicine, dosage, diagnosis, or emergencies.
"""

import re
from typing import Dict, Any, List, Optional

# Trusted Medical Knowledge Base (MedlinePlus / NIH definitions)
TRUSTED_TEST_KNOWLEDGE = {
    "hb": (
        "Haemoglobin (Hb) is a protein in red blood cells that carries oxygen from your lungs "
        "to the rest of your body. Normal adult ranges are typically 12.0–17.5 g/dL depending on age and gender."
    ),
    "hba1c": (
        "HbA1c measures your average blood sugar level over the past 2 to 3 months by checking the percentage "
        "of haemoglobin coated with sugar. A normal level is below 5.7%. Levels between 5.7% and 6.4% indicate "
        "prediabetes, and 6.5% or higher on two separate tests indicates diabetes."
    ),
    "plt": (
        "Platelets are tiny blood cells that help your body form clots to stop bleeding. "
        "A typical healthy range is 150 to 450 (thousand per microliter)."
    ),
    "wbc": (
        "White Blood Cells (WBC) are an essential part of the immune system that helps defend your body "
        "against infections and foreign substances. A normal adult count is roughly 4.0 to 11.0 (thousand per microliter)."
    ),
    "rbc": (
        "Red Blood Cells (RBC) carry oxygen to tissues and organs. A typical adult count is between 4.0 and 5.9 million cells/uL."
    ),
    "hct": (
        "Hematocrit (Packed Cell Volume) measures the percentage of your blood made up of red blood cells."
    ),
    "mcv": (
        "Mean Corpuscular Volume (MCV) reflects the average size of your red blood cells."
    )
}

# Guardrail triggers: diagnosis, medicine, dosage, emergencies
ESCALATION_KEYWORDS = [
    # Diagnosis
    "diagnos", "do i have", "am i sick", "what disease", "is it cancer", "is it leukemia",
    "do i have diabetes", "am i anemic", "is this serious", "will i die", "what illness",
    
    # Medicine & Dosage
    "medicine", "medication", "pill", "tablet", "drug", "dose", "dosage", "prescribe",
    "prescription", "metformin", "insulin", "aspirin", "antibiotic", "paracetamol",
    "take a pill", "stop taking", "increase dose", "decrease dose", "how many tablets",
    
    # Emergencies
    "emergency", "chest pain", "severe pain", "bleeding", "faint", "fainted", "unconscious",
    "cannot breathe", "short of breath", "choking", "seizure", "collapsed", "urgent"
]


def check_guardrails(question: str) -> bool:
    """Returns True if the question should be escalated to the doctor."""
    q_lower = question.lower()
    for kw in ESCALATION_KEYWORDS:
        if re.search(r'\b' + re.escape(kw), q_lower):
            return True
    return False


def patient_chat(
    question: str,
    approved_summary: str,
    history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Answers patient questions grounded only in the approved summary and trusted test info.
    Escalates medical advice or diagnosis to doctor.
    
    Inputs:
        question: Patient's input text
        approved_summary: Doctor-approved summary text
        history: Optional conversation history
        
    Output:
        {"answer": str, "escalate": bool}
    """
    q_clean = question.strip()
    if not q_clean:
        return {
            "answer": "How can I help you understand your doctor-approved report today?",
            "escalate": False
        }
        
    # Safety Guardrail Check
    if check_guardrails(q_clean):
        return {
            "answer": (
                "Your question involves medical advice, diagnosis, medications, or important health symptoms. "
                "For your safety, I cannot provide medical guidance. I have escalated this directly to your "
                "doctor's priority inbox. Your doctor will review your inquiry and get back to you."
            ),
            "escalate": True
        }
        
    q_lower = q_clean.lower()
    
    # Check for general test explanations (MedlinePlus)
    matched_knowledge = []
    if any(k in q_lower for k in ["hba1c", "a1c", "glycated", "sugar"]):
        matched_knowledge.append(TRUSTED_TEST_KNOWLEDGE["hba1c"])
    if any(k in q_lower for k in ["haemoglobin", "hemoglobin", "hb"]):
        matched_knowledge.append(TRUSTED_TEST_KNOWLEDGE["hb"])
    if any(k in q_lower for k in ["platelet", "plt", "clot"]):
        matched_knowledge.append(TRUSTED_TEST_KNOWLEDGE["plt"])
    if any(k in q_lower for k in ["wbc", "white blood", "leukocyte", "tlc"]):
        matched_knowledge.append(TRUSTED_TEST_KNOWLEDGE["wbc"])
    if any(k in q_lower for k in ["rbc", "red blood", "erythrocyte"]):
        matched_knowledge.append(TRUSTED_TEST_KNOWLEDGE["rbc"])
        
    # Inquire about approved summary
    if any(k in q_lower for k in ["summary", "doctor say", "report say", "my report", "status", "result"]):
        if approved_summary:
            response = f"According to your doctor-approved summary:\n\"{approved_summary}\""
            if matched_knowledge:
                response += "\n\nAdditional background information:\n" + "\n".join(matched_knowledge)
            return {"answer": response, "escalate": False}
            
    if matched_knowledge:
        resp = "\n\n".join(matched_knowledge)
        if approved_summary:
            resp += f"\n\nIn your latest approved report, your doctor noted: \"{approved_summary}\""
        return {"answer": resp, "escalate": False}
        
    # Safe general answer referencing the approved summary
    if approved_summary:
        return {
            "answer": (
                f"Based on your approved summary: \"{approved_summary}\"\n\n"
                "If you need specific interpretations beyond this summary, feel free to use the 'Ask My Doctor' button."
            ),
            "escalate": False
        }
        
    return {
        "answer": (
            "I can assist you with understanding laboratory parameters like CBC and HbA1c, "
            "or summarize doctor-approved findings. If you have specific medical concerns, please consult your doctor."
        ),
        "escalate": False
    }
