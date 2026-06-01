import unittest

from scripts.etl import PriceBar, pct_return, validate_bars


class EtlQualityTests(unittest.TestCase):
    def test_pct_return_uses_window_start(self):
        bars = [PriceBar(date=f"2026-01-{day:02d}", close=100 + day, volume=1000) for day in range(1, 12)]
        self.assertEqual(pct_return(bars, 5), round((111 / 106 - 1) * 100, 1))

    def test_validation_catches_duplicates_and_bad_close(self):
        bars = [
            PriceBar(date="2026-01-01", close=10, volume=1000),
            PriceBar(date="2026-01-01", close=-1, volume=1000),
        ]
        errors = validate_bars(bars)
        self.assertIn("duplicate_dates", errors)
        self.assertIn("non_positive_close", errors)


if __name__ == "__main__":
    unittest.main()
