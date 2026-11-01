"""
Indian medicine catalogue: name suggestions and basic product details.

Data: ml/drugs/data/indian_medicines.json.gz (~252,000 products; same file as
backend/data/medicines, MIT licence, see LICENSE-dataset.txt). Each row is
[name, composition, pack, manufacturer, discontinued(0|1)].

Ranking (same as the backend): names starting with the exact word(s) typed,
then names starting with the text, then names containing every word, then
products found through their ingredients; discontinued products last.
"""
from __future__ import annotations

import gzip
import json
import os
import re
from functools import lru_cache
from typing import Dict, List, Optional

_DATA_FILE = os.environ.get(
    "MEDICINE_DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "indian_medicines.json.gz"),
)

_NORM_RE = re.compile(r"[^a-z0-9.%/+ ]+")
_SPACE_RE = re.compile(r"\s+")
_NUM_RE = re.compile(r"(\d+(?:\.\d+)?)")


def _norm(text: str) -> str:
    return _SPACE_RE.sub(" ", _NORM_RE.sub(" ", text.lower())).strip()


def _natural_key(name: str):
    return [float(p) if i % 2 else p.lower() for i, p in enumerate(_NUM_RE.split(name))]


@lru_cache(maxsize=1)
def _load():
    with gzip.open(_DATA_FILE, "rt", encoding="utf-8") as fh:
        rows = json.load(fh)
    names = [" " + _norm(r[0]) for r in rows]
    comps = [" " + _norm(r[1]) for r in rows]
    return rows, names, comps


def search_medicines(query: str, limit: int = 10, offset: int = 0) -> Dict[str, object]:
    """Returns {"total": int, "items": [{name, composition, pack, manufacturer, discontinued, match}]}."""
    q = _norm(query or "")
    if len(q) < 2:
        return {"total": 0, "items": []}
    rows, names, comps = _load()
    words = q.split(" ")
    start = " " + q
    hits = []
    for i, row in enumerate(rows):
        name, comp = names[i], comps[i]
        in_name = True
        ok = True
        for w in words:
            needle = " " + w
            n = needle in name
            if not n:
                in_name = False
                if needle not in comp:
                    ok = False
                    break
        if not ok:
            continue
        if name.startswith(start):
            nxt = name[len(start):len(start) + 1]
            score = 1 if nxt and nxt.isalnum() else 0
        elif in_name:
            score = 2
        else:
            score = 3
        if row[4]:
            score += 10
        hits.append((score, _natural_key(row[0]), i))
    hits.sort()
    seen = set()
    unique = []
    for score, _key, i in hits:
        k = rows[i][0].lower()
        if k in seen:
            continue
        seen.add(k)
        unique.append((score, i))
    items = []
    for score, i in unique[offset:offset + max(1, min(limit, 100))]:
        r = rows[i]
        items.append({
            "name": r[0],
            "composition": r[1],
            "pack": r[2],
            "manufacturer": r[3],
            "discontinued": bool(r[4]),
            "match": "name" if score % 10 <= 2 else "composition",
        })
    return {"total": len(unique), "items": items}


def suggest_medicine_names(query: str, limit: int = 10) -> List[str]:
    """Clean medicine / brand names for the typed text (no company names)."""
    return [item["name"] for item in search_medicines(query, limit=limit)["items"]]


def get_drug_info(medicine_name: str) -> Optional[Dict[str, object]]:
    """Composition, pack and maker of the best-matching product, or None. Facts from the catalogue only."""
    result = search_medicines(medicine_name, limit=1)
    return result["items"][0] if result["items"] else None


def get_drug_indication(medicine_name: str) -> Optional[str]:
    """
    Clinical indication text for a medicine.

    No indication source is bundled with this repository, so this returns None and the
    API answers {"indication": null}. It never makes up an indication.
    To enable it, replace the body with a call to your drug-information service
    (the original ReportSetu ML build used HealthPilot.ai / drugdb.in).
    """
    return None
