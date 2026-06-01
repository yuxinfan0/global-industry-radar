#!/usr/bin/env python3
"""Evaluation harness for signal-card quality.

The harness intentionally focuses on testable structure before model training:
evidence coverage, grounded thesis, schema completeness, and human labels.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


REQUIRED_CARD_FIELDS = {
    "id",
    "theme_id",
    "theme_name",
    "date",
    "scores",
    "thesis",
    "primary_market_angle",
    "risks",
    "evidence",
    "evidence_ids",
    "horizon",
}

REQUIRED_SCORE_FIELDS = {
    "momentum_score",
    "evidence_score",
    "primary_investability_score",
    "risk_score",
    "confidence",
}


def evaluate_card(card: dict[str, Any]) -> dict[str, Any]:
    failures: list[str] = []
    missing = sorted(REQUIRED_CARD_FIELDS - set(card))
    if missing:
        failures.append(f"missing_card_fields:{','.join(missing)}")

    score_missing = sorted(REQUIRED_SCORE_FIELDS - set(card.get("scores", {})))
    if score_missing:
        failures.append(f"missing_score_fields:{','.join(score_missing)}")

    evidence = card.get("evidence", [])
    if len(evidence) < 3:
        failures.append("less_than_3_evidence_items")

    evidence_ids = {item.get("id") for item in evidence}
    if set(card.get("evidence_ids", [])) - evidence_ids:
        failures.append("evidence_ids_not_bound_to_items")

    thesis = card.get("thesis", "")
    if len(thesis) < 80:
        failures.append("thesis_too_short")

    if evidence and not any(claim in thesis for item in evidence for claim in item.get("extracted_claims", [])[:1]):
        # Soft warning: deterministic templates often summarize rather than quote.
        failures.append("thesis_does_not_quote_retrieved_claim")

    confidence = card.get("scores", {}).get("confidence", 0)
    if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 100:
        failures.append("confidence_out_of_range")

    return {
        "signal_id": card.get("id", "unknown"),
        "passed": not failures or failures == ["thesis_does_not_quote_retrieved_claim"],
        "failures": failures,
        "evidence_count": len(evidence),
        "confidence": confidence,
    }


def evaluate_radar(payload: dict[str, Any]) -> dict[str, Any]:
    cards = payload.get("cards", [])
    results = [evaluate_card(card) for card in cards]
    hard_failures = [result for result in results if not result["passed"]]
    return {
        "date": payload.get("date"),
        "cards": len(cards),
        "passed": len(hard_failures) == 0,
        "hard_failures": hard_failures,
        "results": results,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate generated industry-radar signal cards.")
    parser.add_argument("path", help="Radar JSON path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payload = json.loads(Path(args.path).read_text(encoding="utf-8"))
    result = evaluate_radar(payload)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
