"""
Drug Information Service client (HealthPilot.ai / drugdb.in).
Integrates with the drugdb.in service to extract clinical indications for medicines.

Resolves multiple manufacturer/strength duplicate entries and extracts only the
clinical indication text.
"""

import re
import logging
from typing import Optional, Dict, Any, List
import requests

logger = logging.getLogger(__name__)

DRUGDB_SEARCH_URL = "https://drugdb.in/search"
DEFAULT_TIMEOUT = 10  # seconds
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ReportSetu/1.0",
    "Accept": "application/json"
}


def _normalize_query(query: str) -> str:
    """Normalize input by inserting spaces between letters, digits and units (e.g. 500mg -> 500 mg, drug500 -> drug 500)."""
    clean = re.sub(r'([a-zA-Z]+)(\d+)', r'\1 \2', query)
    clean = re.sub(r'(\d+)([a-zA-Z]+)', r'\1 \2', clean)
    return re.sub(r'\s+', ' ', clean).strip()


def _strip_dosage(query: str) -> str:
    """Removes dosage numbers, units, and dosage forms to leave base drug name."""
    clean = re.sub(r'\b\d+(\.\d+)?\s*(?:mg|g|ml|mcg|tablets?|capsules?|syrup)?\b', '', query, flags=re.I)
    clean = re.sub(r'\b(oral|tablet|tablets|capsule|capsules|syrup|suspension|injection|solution)\b', '', clean, flags=re.I)
    return re.sub(r'\s+', ' ', clean).strip()


def _query_api(term: str, search_type: str = "medicine", limit: int = 25) -> List[Dict[str, Any]]:
    """Helper to query drugdb.in with detail=full."""
    params = {
        "type": search_type,
        "q": term,
        "detail": "full",
        "limit": limit
    }
    try:
        resp = requests.get(DRUGDB_SEARCH_URL, params=params, headers=HEADERS, timeout=DEFAULT_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("results", [])
    except Exception as e:
        logger.warning(f"Error querying drugdb.in ({search_type}={term}): {e}")
    return []


def get_drug_indication(medicine_name: str) -> Optional[str]:
    """
    Given a medicine name (brand or generic), queries the drugdb.in API,
    handles multiple manufacturer/formulation duplicates, and returns
    ONLY the clinical indication string.
    
    Returns:
        str: Clinical indication text if found, or None if no indication available.
    """
    if not medicine_name or not medicine_name.strip():
        return None

    raw_query = medicine_name.strip()
    norm_query = _normalize_query(raw_query)
    base_name = _strip_dosage(norm_query)

    search_terms = [norm_query]
    if base_name and base_name.lower() != norm_query.lower() and len(base_name) >= 3:
        search_terms.append(base_name)

    # 1. Search in medicine index
    for term in search_terms:
        results = _query_api(term, search_type="medicine", limit=25)
        if not results:
            continue

        # Look for the best indication matching the query
        # We prefer:
        # a) Single active ingredient matching the drug name
        # b) Non-empty indications in genericDetail
        candidates = []
        for item in results:
            gd = item.get("genericDetail") or {}
            indication = gd.get("indications") or item.get("indications")
            if not indication or not indication.strip():
                continue
            indication = indication.strip()

            score = 0
            brand = (item.get("brand.brandName") or "").lower()
            med_name = (item.get("medicineName") or "").lower()
            gen_name = (item.get("generic.genericName") or gd.get("name") or "").lower()
            q_lower = term.lower()

            if brand == q_lower or gen_name.startswith(q_lower):
                score += 50
            elif q_lower in brand or q_lower in med_name:
                score += 30

            if str(item.get("ingredients", "")) == "1":
                score += 20

            candidates.append((score, indication))

        if candidates:
            # Sort by highest match score
            candidates.sort(key=lambda x: x[0], reverse=True)
            return candidates[0][1]

    # 2. Fallback to generic index if medicine search yielded no indication
    for term in search_terms:
        gen_results = _query_api(term, search_type="generic", limit=15)
        for item in gen_results:
            indication = item.get("indications")
            if indication and indication.strip():
                return indication.strip()

    return None


def get_drug_info(medicine_name: str) -> Dict[str, Any]:
    """
    Returns structured indication details including the matched drug,
    generic name, dosage form, and indication.
    """
    if not medicine_name or not medicine_name.strip():
        return {"query": medicine_name, "found": False, "indication": None}

    raw_query = medicine_name.strip()
    norm_query = _normalize_query(raw_query)
    base_name = _strip_dosage(norm_query)

    search_terms = [norm_query]
    if base_name and base_name.lower() != norm_query.lower() and len(base_name) >= 3:
        search_terms.append(base_name)

    for term in search_terms:
        results = _query_api(term, search_type="medicine", limit=25)
        for item in results:
            gd = item.get("genericDetail") or {}
            indication = gd.get("indications") or item.get("indications")
            if indication and indication.strip():
                return {
                    "query": raw_query,
                    "found": True,
                    "matched_medicine": item.get("medicineName"),
                    "brand_name": item.get("brand.brandName"),
                    "generic_name": gd.get("name") or item.get("generic.genericName"),
                    "dose_form": gd.get("doseForm"),
                    "indication": indication.strip()
                }

    # Generic fallback
    for term in search_terms:
        gen_results = _query_api(term, search_type="generic", limit=15)
        for item in gen_results:
            indication = item.get("indications")
            if indication and indication.strip():
                return {
                    "query": raw_query,
                    "found": True,
                    "matched_medicine": item.get("name"),
                    "brand_name": None,
                    "generic_name": item.get("name"),
                    "dose_form": item.get("doseForm"),
                    "indication": indication.strip()
                }

    return {"query": raw_query, "found": False, "indication": None}
