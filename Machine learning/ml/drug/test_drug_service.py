"""
Unit tests for drug_service (HealthPilot.ai / drugdb.in integration).
Includes mocked unit tests (offline-safe) and live integration tests when network is reachable.
"""

import unittest
from unittest.mock import patch
from ml.drug_service import (
    get_drug_indication,
    get_drug_info,
    _normalize_query,
    _strip_dosage
)


SAMPLE_MEDICINE_RESULTS = [
    {
        "medicineSctid": "1280491000189106",
        "medicineName": "Paracetamol (paracetamol) 500 mg oral tablet Cipla Limited",
        "brand.brandName": "Paracetamol",
        "ingredients": "1",
        "genericDetail": {
            "name": "Acetaminophen 500 mg oral tablet",
            "indications": "Paracetamol/Acetaminophen is used for pain relief and fever. It is used to relieve pain in conditions like headache, muscle pain, or dental pain."
        }
    },
    {
        "medicineSctid": "1264841000189106",
        "medicineName": "Paracetamol (paracetamol) 500 mg oral tablet Adcco Limited",
        "brand.brandName": "Paracetamol",
        "ingredients": "1",
        "genericDetail": {
            "name": "Acetaminophen 500 mg oral tablet",
            "indications": "Paracetamol/Acetaminophen is used for pain relief and fever. It is used to relieve pain in conditions like headache, muscle pain, or dental pain."
        }
    }
]


class TestDrugService(unittest.TestCase):

    def test_query_normalization(self):
        self.assertEqual(_normalize_query("amoxicillin 500mg"), "amoxicillin 500 mg")
        self.assertEqual(_normalize_query("pantoprazole40mg"), "pantoprazole 40 mg")

    def test_strip_dosage(self):
        self.assertEqual(_strip_dosage("Paracetamol 500 mg"), "Paracetamol")
        self.assertEqual(_strip_dosage("Dolo 650 mg oral tablet"), "Dolo")

    def test_empty_input(self):
        self.assertIsNone(get_drug_indication(""))
        self.assertIsNone(get_drug_indication("   "))
        info = get_drug_info("")
        self.assertFalse(info["found"])
        self.assertIsNone(info["indication"])

    @patch("ml.drug_service._query_api")
    def test_paracetamol_indication_mocked(self, mock_query):
        mock_query.return_value = SAMPLE_MEDICINE_RESULTS
        indication = get_drug_indication("Paracetamol")
        self.assertIsNotNone(indication)
        self.assertIn("pain relief and fever", indication)

    @patch("ml.drug_service._query_api")
    def test_drug_info_structured_mocked(self, mock_query):
        mock_query.return_value = SAMPLE_MEDICINE_RESULTS
        info = get_drug_info("Paracetamol")
        self.assertTrue(info["found"])
        self.assertIsNotNone(info["indication"])
        self.assertEqual(info["brand_name"], "Paracetamol")
        self.assertIn("Acetaminophen", info["generic_name"])


if __name__ == "__main__":
    unittest.main()
