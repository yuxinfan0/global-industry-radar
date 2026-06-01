#!/usr/bin/env python3
"""Daily industry-radar ETL using free public data.

The script is dependency-free on purpose. It can run in GitHub Actions, Vercel
build hooks, or a local cron without installing pandas.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
import os
import statistics
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
ONTOLOGY_PATH = ROOT / "data" / "theme_ontology.json"


@dataclass(frozen=True)
class PriceBar:
    date: str
    close: float
    volume: float


def load_ontology(path: Path = ONTOLOGY_PATH) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def stooq_symbol(symbol: str) -> str:
    if symbol.endswith(".US"):
        return symbol.removesuffix(".US").lower()
    if symbol.endswith(".F"):
        return symbol.removesuffix(".F").lower() + ".f"
    return symbol.lower()


def fetch_url(url: str, timeout: int = 20) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "industry-radar-mvp/0.1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_stooq_daily(symbol: str) -> list[PriceBar]:
    query_symbol = urllib.parse.quote(stooq_symbol(symbol))
    url = f"https://stooq.com/q/d/l/?s={query_symbol}&i=d"
    raw = fetch_url(url)
    rows = list(csv.DictReader(raw.splitlines()))
    bars: list[PriceBar] = []
    for row in rows:
        try:
            close = float(row["Close"])
            volume = float(row.get("Volume") or 0)
        except (KeyError, TypeError, ValueError):
            continue
        if close > 0:
            bars.append(PriceBar(date=row["Date"], close=close, volume=volume))
    return bars


def generate_fallback_bars(symbol: str, end_date: str, days: int = 180) -> list[PriceBar]:
    seed = sum(ord(char) for char in symbol)
    end = dt.date.fromisoformat(end_date)
    price = 50 + seed % 80
    bars: list[PriceBar] = []
    for index in range(days):
        current = end - dt.timedelta(days=days - index - 1)
        drift = math.sin((index + seed) / 11) * 0.012 + ((seed % 17) - 8) / 5000
        price = max(1, price * (1 + drift))
        volume = 800_000 + (seed % 1000) * 900 + index * 1100
        bars.append(PriceBar(date=current.isoformat(), close=round(price, 4), volume=round(volume, 2)))
    return bars


def validate_bars(bars: list[PriceBar]) -> list[str]:
    errors: list[str] = []
    if len(bars) < 30:
        errors.append("less_than_30_bars")
    dates = [bar.date for bar in bars]
    if len(dates) != len(set(dates)):
        errors.append("duplicate_dates")
    if dates != sorted(dates):
        errors.append("dates_not_sorted")
    if any(bar.close <= 0 for bar in bars):
        errors.append("non_positive_close")
    if len(bars) >= 2:
        jumps = [abs(bars[i].close / bars[i - 1].close - 1) for i in range(1, len(bars)) if bars[i - 1].close > 0]
        if any(jump > 0.75 for jump in jumps):
            errors.append("possible_split_or_bad_tick")
    return errors


def pct_return(bars: list[PriceBar], window: int) -> float:
    if len(bars) <= window:
        return 0.0
    start = bars[-window - 1].close
    end = bars[-1].close
    return round((end / start - 1) * 100, 1)


def average(values: Iterable[float]) -> float:
    values = list(values)
    return statistics.mean(values) if values else 0.0


def build_theme_signal(theme: dict[str, Any], date: str, dry_run: bool) -> dict[str, Any]:
    instrument_metrics = []
    quality_errors: dict[str, list[str]] = {}

    for instrument in theme["instruments"]:
        symbol = instrument["symbol"]
        try:
            bars = generate_fallback_bars(symbol, date) if dry_run else fetch_stooq_daily(symbol)
        except (urllib.error.URLError, TimeoutError, ValueError):
            bars = generate_fallback_bars(symbol, date)
            quality_errors[symbol] = ["remote_fetch_failed_fallback_used"]

        errors = validate_bars(bars)
        if errors:
            quality_errors.setdefault(symbol, []).extend(errors)

        instrument_metrics.append(
            {
                "symbol": symbol,
                "r5": pct_return(bars, 5),
                "r20": pct_return(bars, 20),
                "r60": pct_return(bars, 60),
                "r120": pct_return(bars, 120),
                "volume_expansion": round((average(bar.volume for bar in bars[-20:]) + 1) / (average(bar.volume for bar in bars[-120:-20]) + 1), 2),
            }
        )

    windows = {
        "d5": round(average(item["r5"] for item in instrument_metrics), 1),
        "d20": round(average(item["r20"] for item in instrument_metrics), 1),
        "d60": round(average(item["r60"] for item in instrument_metrics), 1),
        "d120": round(average(item["r120"] for item in instrument_metrics), 1),
    }
    breadth = round(sum(1 for item in instrument_metrics if item["r20"] > 0) / max(1, len(instrument_metrics)) * 100)
    momentum_score = min(100, max(0, round(windows["d20"] * 2.2 + windows["d60"] * 1.25 + breadth * 0.22)))
    evidence_score = 72
    investability = min(100, 52 + len(theme["private_segments"]) * 4)
    risk_score = min(100, 28 + len(theme["counter_indicators"]) * 6)
    confidence = min(100, max(0, round(momentum_score * 0.34 + evidence_score * 0.24 + investability * 0.28 - risk_score * 0.12 + 18)))

    evidence = build_evidence(theme, date)
    signal_id = f"{theme['id']}-{date}"

    first_claim = evidence[0]["extracted_claims"][0]

    return {
        "id": signal_id,
        "theme_id": theme["id"],
        "theme_name": theme["name"],
        "date": date,
        "rank": 999,
        "horizon": "6-24 months",
        "scores": {
            "momentum_score": momentum_score,
            "evidence_score": evidence_score,
            "primary_investability_score": investability,
            "risk_score": risk_score,
            "confidence": confidence,
        },
        "momentum_windows": windows,
        "volume_expansion": round(average(item["volume_expansion"] for item in instrument_metrics), 2),
        "breadth": breadth,
        "drawdown_repair": min(100, max(0, 35 + breadth // 2)),
        "diffusion": min(100, max(0, 30 + breadth // 2)),
        "thesis": (
            f"{theme['name']} is flagged by {windows['d20']}% 20d and {windows['d60']}% 60d theme momentum. "
            f"{first_claim} Test whether {theme['core_variables'][0]} is becoming a 6-24 month demand driver, not a single headline."
        ),
        "primary_market_angle": f"Screen private companies in {', '.join(theme['private_segments'][:3])}.",
        "risks": theme["counter_indicators"][:4],
        "evidence_ids": [item["id"] for item in evidence],
        "evidence": evidence,
        "counter_indicators": theme["counter_indicators"],
        "instruments": theme["instruments"],
        "mode": "etl",
        "quality_errors": quality_errors,
        "instrument_metrics": instrument_metrics,
    }


def build_evidence(theme: dict[str, Any], date: str) -> list[dict[str, Any]]:
    sources = ["gdelt", "sec", "stooq", "arxiv"]
    evidence = []
    for index, source in enumerate(sources):
        keyword = theme["keywords"][index % len(theme["keywords"])]
        evidence.append(
            {
                "id": f"{theme['id']}-{source}-{date}-{index}",
                "source": source,
                "title": f"{source.upper()} retrieval anchor for {keyword}",
                "url": source_url(source, keyword),
                "published_at": f"{date}T08:00:00.000Z",
                "theme_id": theme["id"],
                "extracted_claims": [
                    f"Monitor {theme['core_variables'][index % len(theme['core_variables'])]} as the validation variable.",
                    f"Map validated pressure to {theme['private_segments'][index % len(theme['private_segments'])]}.",
                    "Production extraction should replace this anchor with live claims.",
                ],
                "relevance_score": round(0.74 + index * 0.05, 2),
            }
        )
    return evidence


def source_url(source: str, keyword: str) -> str:
    encoded = urllib.parse.quote(keyword)
    return {
        "gdelt": f"https://api.gdeltproject.org/api/v2/doc/doc?query={encoded}&mode=artlist&format=json",
        "sec": "https://www.sec.gov/edgar/search/",
        "stooq": "https://stooq.com/db/h/",
        "arxiv": f"https://export.arxiv.org/api/query?search_query=all:{encoded}",
    }.get(source, "https://example.com")


def build_radar(date: str, dry_run: bool) -> dict[str, Any]:
    cards = [build_theme_signal(theme, date, dry_run) for theme in load_ontology()]
    cards.sort(key=lambda item: item["scores"]["confidence"], reverse=True)
    for rank, card in enumerate(cards, start=1):
        card["rank"] = rank
    return {
        "date": date,
        "generated_at": dt.datetime.now(dt.UTC).isoformat(),
        "mode": "etl",
        "horizon": "6-24 months",
        "cards": cards[: int(os.getenv("MAX_AI_THEMES", "20"))],
    }


def upsert_supabase(radar: dict[str, Any]) -> None:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        return
    rows = [
        {
            "id": card["id"],
            "theme_id": card["theme_id"],
            "date": card["date"],
            "rank": card["rank"],
            "confidence": card["scores"]["confidence"],
            "signal_json": card,
        }
        for card in radar["cards"]
    ]
    request = urllib.request.Request(
        f"{url}/rest/v1/signal_cards?on_conflict=id",
        data=json.dumps(rows).encode("utf-8"),
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        response.read()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a daily global industry radar file.")
    parser.add_argument("--date", default=dt.date.today().isoformat(), help="YYYY-MM-DD date for the signal run")
    parser.add_argument("--out", default="", help="Optional JSON output path")
    parser.add_argument("--dry-run", action="store_true", help="Use deterministic fallback bars instead of network fetches")
    parser.add_argument("--supabase", action="store_true", help="Upsert generated cards to Supabase when env vars are present")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    radar = build_radar(args.date, args.dry_run)
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(radar, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        print(json.dumps(radar, ensure_ascii=False, indent=2))
    if args.supabase:
        upsert_supabase(radar)
    return 0


if __name__ == "__main__":
    sys.exit(main())
