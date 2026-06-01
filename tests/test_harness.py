import unittest

from scripts.harness import evaluate_card


class HarnessTests(unittest.TestCase):
    def test_good_card_passes_with_soft_quote_warning(self):
        evidence = [
            {"id": f"e{i}", "extracted_claims": [f"claim {i}"]} for i in range(3)
        ]
        card = {
            "id": "theme-2026-06-01",
            "theme_id": "theme",
            "theme_name": "Theme",
            "date": "2026-06-01",
            "horizon": "6-24 months",
            "scores": {
                "momentum_score": 70,
                "evidence_score": 80,
                "primary_investability_score": 75,
                "risk_score": 30,
                "confidence": 78,
            },
            "thesis": "This is a long enough thesis that explains why public market momentum should be tested against a private investment angle.",
            "primary_market_angle": "Screen private companies.",
            "risks": ["risk"],
            "evidence": evidence,
            "evidence_ids": ["e0", "e1", "e2"],
        }
        result = evaluate_card(card)
        self.assertTrue(result["passed"])

    def test_missing_evidence_fails(self):
        result = evaluate_card({"id": "bad", "scores": {"confidence": 50}, "evidence": []})
        self.assertFalse(result["passed"])
        self.assertIn("less_than_3_evidence_items", result["failures"])


if __name__ == "__main__":
    unittest.main()
