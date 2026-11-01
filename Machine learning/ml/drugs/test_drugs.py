from ml.drugs import get_drug_indication, get_drug_info, suggest_medicine_names
from ml.drugs.catalog import search_medicines


def test_suggest_lists_brands_first():
    names = suggest_medicine_names("dolo", limit=10)
    assert names and names[0].lower().startswith("dolo ")
    assert any(n.startswith("Dolo 650") for n in suggest_medicine_names("dolo 650", limit=10))


def test_ingredient_search_and_paging():
    first = search_medicines("paracetamol", limit=30)
    second = search_medicines("paracetamol", limit=30, offset=30)
    assert first["total"] > 1000
    assert {i["name"] for i in first["items"]}.isdisjoint({i["name"] for i in second["items"]})


def test_short_query_and_info():
    assert suggest_medicine_names("p") == []
    info = get_drug_info("Dolo 650 Tablet")
    assert info and "Paracetamol" in info["composition"]


def test_indication_is_never_invented():
    assert get_drug_indication("Paracetamol") is None
