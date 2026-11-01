"""
Drug Information Service client (HealthPilot.ai / drugdb.in).
Integrates with the drugdb.in service to extract clinical indications for medicines
and provide clean medicine name autocomplete suggestions.

Resolves multiple manufacturer/strength duplicate entries and discards company names.
"""

import re
import logging
from collections import Counter
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


def suggest_medicine_names(query: str, limit: int = 10) -> List[str]:
    """
    Suggests clean medicine names (brands and active generic substances) matching the query.
    Completely discards manufacturer / company names (e.g. Cipla Limited, Adcco Limited),
    deduplicates duplicate formulations, and ranks prefix and popular matches first.
    
    Example:
        suggest_medicine_names("para") -> ["Paracetamol", "Paracip", "Parafast", "Para-HL", ...]
        suggest_medicine_names("dolo") -> ["Dolo", "Dolotram", "Doloswift", "Dolonex", ...]
    """
    if not query or not query.strip():
        return []

    raw_query = query.strip()
    q = raw_query.lower()

    counts = Counter()
    canonical_names = {}

    # 1. Fetch from medicine index (brand names)
    try:
        med_results = _query_api(raw_query, search_type="medicine", limit=50)
        for item in med_results:
            brand = (item.get("brand.brandName") or "").strip()
            if brand:
                key = brand.lower()
                counts[key] += 3
                if key not in canonical_names:
                    canonical_names[key] = brand
    except Exception as e:
        logger.warning(f"Error fetching medicine suggestions: {e}")

    # 2. Fetch from generic index (active generic names)
    try:
        gen_results = _query_api(raw_query, search_type="generic", limit=30)
        for item in gen_results:
            gname = item.get("name") or ""
            # Strip dosage numbers & forms: e.g. 'Paracetamol 500 mg oral tablet' -> 'Paracetamol'
            base_gen = re.split(r'\s+\d+', gname)[0].strip()
            base_gen = re.sub(
                r'\b(oral|tablet|tablets|capsule|capsules|syrup|injection|suspension|solution|granules)\b',
                '',
                base_gen,
                flags=re.I
            ).strip()
            if base_gen and len(base_gen) >= 2:
                key = base_gen.lower()
                counts[key] += 4
                if key not in canonical_names:
                    canonical_names[key] = base_gen
    except Exception as e:
        logger.warning(f"Error fetching generic suggestions: {e}")

    # 3. Categorize and rank: exact match -> starts with -> contains
    exact = []
    starts = []
    contains = []

    for key, name in canonical_names.items():
        score = counts[key]
        if key == q:
            exact.append((score, len(name), name))
        elif key.startswith(q):
            starts.append((score, len(name), name))
        elif q in key:
            contains.append((score, len(name), name))

    exact.sort(key=lambda x: (-x[0], x[1], x[2]))
    starts.sort(key=lambda x: (-x[0], x[1], x[2]))
    contains.sort(key=lambda x: (-x[0], x[1], x[2]))

    results = [x[2] for x in exact] + [x[2] for x in starts] + [x[2] for x in contains]
    return results[:limit]
