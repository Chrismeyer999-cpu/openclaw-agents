from __future__ import annotations

import hashlib
import json
import os
import re
import html
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

import httpx
from dotenv import load_dotenv

WORKSPACE = Path(__file__).resolve().parents[1]
CONFIG_PATH = WORKSPACE / "agents" / "nieuwsmonitor" / "feeds.config.json"
TABLE_CANDIDATES = ["nieuws", "nieuws_items", "news_items"]


def _norm_text(value: str | None) -> str:
    return (value or "").strip()


def _host_from_url(url: str) -> str | None:
    try:
        return urlparse(url).netloc.lower() or None
    except Exception:
        return None


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)
    except Exception:
        return None


def _safe_find_text(node: ET.Element, paths: list[str]) -> str | None:
    for p in paths:
        found = node.findtext(p)
        if found and found.strip():
            return found.strip()
    return None


def _clean_summary_text(value: str | None) -> str:
    text = _norm_text(value)
    if not text:
        return ""
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _agent_fit(agent: str, title: str, summary: str) -> tuple[bool, str]:
    text = f"{title} {summary}".lower()

    kavel_terms = [
        "kavel",
        "kaveluitgifte",
        "bouwkavel",
        "gebiedsontwikkeling",
        "bestemmingsplan",
        "omgevingsplan",
        "locatieontwikkeling",
    ]
    brikx_terms = [
        "omgevingswet",
        "wkb",
        "vergunning",
        "bouwbesluit",
        "bouwkosten",
        "renovatie",
        "verduurzaming",
        "nieuwbouw",
    ]
    zwijsen_terms = [
        "architect",
        "architectuur",
        "ontwerp",
        "villa",
        "interieur",
        "ai",
        "artificial intelligence",
        "generative",
        "bim",
        "computational design",
    ]

    if agent == "kavel-agent":
        hit = [t for t in kavel_terms if t in text]
        if hit:
            return True, f"match op {', '.join(hit[:2])}"
        return False, "geen duidelijke kavel/gebiedsontwikkeling match"

    if agent == "brikx-agent":
        hit = [t for t in brikx_terms if t in text]
        if hit:
            return True, f"match op {', '.join(hit[:2])}"
        return False, "geen duidelijke regelgeving/kosten match"

    if agent == "zwijsen-agent":
        hit = [t for t in zwijsen_terms if t in text]
        if hit:
            return True, f"match op {', '.join(hit[:2])}"
        return False, "geen duidelijke architectuur/AI match"

    return True, "algemene match"


def _is_project_showcase(title: str, summary: str, source_name: str) -> bool:
    text = f"{title} {summary}".lower()
    source = source_name.lower()

    # Typical showcase patterns from architecture mags
    if " / " in title and ("archdaily" in source or "dezeen" in source):
        return True
    if re.search(r"\b(studio|architects?)\b", text) and re.search(r"\b(house|center|museum|tower|residence|villa)\b", text):
        return True
    if re.search(r"\b(/|project)\b", title.lower()) and re.search(r"\b(atelier|studio|architect)\b", title.lower()):
        return True
    return False


def _reason_line(agent: str, source_name: str, relevance: float, why_hit: str) -> str:
    if agent == "zwijsen-agent":
        why = "relevant voor AI-impact op ontwerp, workflow of positionering van architecten"
    elif agent == "brikx-agent":
        why = "relevant voor regelgeving, kosten of praktische bouwbeslissingen van particulieren"
    elif agent == "kavel-agent":
        why = "relevant voor kavelaanbod, gebiedsontwikkeling of vroege locatiekansen"
    else:
        why = "relevant voor de nieuwsstroom"
    return f"Waarom plaatsen: {why} ({why_hit}). Bron: {source_name}. Score: {relevance:.2f}."


def _parse_feed_items(xml_text: str, feed_name: str, feed_weight: float, agent_name: str) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_text)
    items: list[dict[str, Any]] = []

    # RSS
    for item in root.findall("./channel/item"):
        title = _safe_find_text(item, ["title"])
        link = _safe_find_text(item, ["link"])
        summary = _safe_find_text(item, ["description"])
        pub = _safe_find_text(item, ["pubDate"])
        items.append(
            {
                "title": title,
                "source_url": link,
                "summary": summary,
                "published_at_src": pub,
                "source_name": feed_name,
                "agent": agent_name,
                "weight": feed_weight,
            }
        )

    # Atom fallback
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    for entry in root.findall("./atom:entry", ns):
        title = _safe_find_text(entry, ["atom:title"])
        link_elem = entry.find("atom:link", ns)
        link = link_elem.get("href") if link_elem is not None else None
        summary = _safe_find_text(entry, ["atom:summary", "atom:content"])
        pub = _safe_find_text(entry, ["atom:updated", "atom:published"])
        items.append(
            {
                "title": title,
                "source_url": link,
                "summary": summary,
                "published_at_src": pub,
                "source_name": feed_name,
                "agent": agent_name,
                "weight": feed_weight,
            }
        )

    return items


def _compute_relevance(weight: float, pub_dt: datetime | None, now: datetime, max_age_days: int) -> float:
    age_score = 0.6
    if pub_dt:
        age_days = max((now - pub_dt).total_seconds() / 86400, 0)
        age_score = max(0.2, 1.0 - (age_days / max(max_age_days, 1)))
    score = 0.55 * weight + 0.45 * age_score
    return max(0.7, min(0.98, round(score, 3)))


def _pick_table(client: httpx.Client, headers: dict[str, str]) -> str:
    for table in TABLE_CANDIDATES:
        r = client.get(f"/rest/v1/{table}", params={"select": "*", "limit": 1}, headers=headers)
        if r.status_code < 300:
            return table
    raise RuntimeError("Geen nieuws-tabel gevonden (nieuws/nieuws_items/news_items)")


def main() -> None:
    load_dotenv(WORKSPACE / ".env")

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        raise RuntimeError("SUPABASE_URL en SUPABASE_SERVICE_KEY zijn verplicht in .env")

    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    defaults = cfg.get("defaults", {})
    max_items = int(defaults.get("max_items_per_run", 20))
    freshness = defaults.get("freshness", {})
    max_age_days = int(freshness.get("max_age_days", 21))
    dedupe_window_days = int(defaults.get("dedupe", {}).get("window_days", 14))

    now = datetime.now(UTC)
    cutoff = now - timedelta(days=max_age_days)

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    with httpx.Client(base_url=supabase_url.rstrip("/"), timeout=25.0, follow_redirects=True) as client:
        table = _pick_table(client, headers)

        # existing urls/titles for dedupe
        seen_urls: set[str] = set()
        seen_titles: set[str] = set()
        existing = client.get(
            f"/rest/v1/{table}",
            params={"select": "*", "limit": 5000},
            headers=headers,
        )
        if existing.status_code < 300:
            payload = existing.json()
            rows = payload if isinstance(payload, list) else []
            for r in rows:
                if not isinstance(r, dict):
                    continue
                url_val = r.get("source_url") or r.get("url") or r.get("link")
                title_val = r.get("title") or r.get("kop")
                if url_val:
                    seen_urls.add(_norm_text(str(url_val)).lower())
                if title_val:
                    seen_titles.add(_norm_text(str(title_val)).lower())

        candidates: list[dict[str, Any]] = []
        in_batch_urls: set[str] = set()
        in_batch_titles: set[str] = set()
        source_counts: dict[str, int] = {}

        for agent_name, agent_cfg in cfg.get("agents", {}).items():
            for feed in agent_cfg.get("feeds", []):
                url = feed.get("url")
                if not url:
                    continue
                try:
                    resp = client.get(url)
                    resp.raise_for_status()
                    parsed = _parse_feed_items(
                        resp.text,
                        feed_name=feed.get("name") or _host_from_url(url) or "unknown",
                        feed_weight=float(feed.get("weight", 0.8)),
                        agent_name=agent_name,
                    )
                except Exception:
                    continue

                for item in parsed:
                    title = _norm_text(item.get("title"))
                    source_url = _norm_text(item.get("source_url"))
                    if not title or not source_url:
                        continue

                    title_key = title.lower()
                    url_key = source_url.lower()
                    if (
                        url_key in seen_urls
                        or title_key in seen_titles
                        or url_key in in_batch_urls
                        or title_key in in_batch_titles
                    ):
                        continue

                    pub_dt = _parse_dt(item.get("published_at_src"))
                    if pub_dt and pub_dt < cutoff:
                        continue

                    relevance = _compute_relevance(float(item.get("weight", 0.8)), pub_dt, now, max_age_days)
                    source_name = str(item.get('source_name') or '')
                    topic = f"{item.get('agent')}|{source_name}"

                    # Source rules:
                    # - ArchDaily/Dezeen only for zwijsen-agent
                    # - Keep analysis/trend items, drop pure project showcases
                    lower_source = source_name.lower()
                    if ("archdaily" in lower_source or "dezeen" in lower_source) and str(item.get('agent')) != 'zwijsen-agent':
                        continue

                    source_key = lower_source or 'unknown'
                    source_cap = 5 if ("archdaily" in source_key or "dezeen" in source_key) else 8
                    if source_counts.get(source_key, 0) >= source_cap:
                        continue

                    clean_summary = _clean_summary_text(item.get("summary"))

                    # For Zwijsen: reject external project showcases, keep strategy/trend analysis
                    if str(item.get("agent")) == "zwijsen-agent" and _is_project_showcase(title, clean_summary, source_name):
                        continue

                    is_fit, why_hit = _agent_fit(str(item.get("agent")), title, clean_summary)
                    if not is_fit:
                        continue
                    reason = _reason_line(str(item.get("agent")), str(item.get("source_name")), relevance, why_hit)
                    if clean_summary:
                        merged_summary = f"{clean_summary[:420]}\n\n{reason}"
                    else:
                        merged_summary = reason

                    candidates.append(
                        {
                            "title": title[:500],
                            "summary": merged_summary[:3000],
                            "body": merged_summary[:5000],
                            "source_url": source_url,
                            "source_name": item.get("source_name"),
                            "topic": topic,
                            "review_status": "pending",
                            "relevance": relevance,
                            "tags": [item.get("agent")],
                            "published_at": pub_dt.isoformat() if pub_dt else None,
                        }
                    )
                    in_batch_urls.add(url_key)
                    in_batch_titles.add(title_key)
                    source_counts[source_key] = source_counts.get(source_key, 0) + 1

        # best N by relevance and recency (published_at desc)
        def sort_key(x: dict[str, Any]) -> tuple[float, str]:
            return (float(x.get("relevance") or 0.0), x.get("published_at") or "")

        top = sorted(candidates, key=sort_key, reverse=True)[:max_items]
        if not top:
            print("Geen nieuwe items om te inserten.")
            return

        payload_rows = [dict(x) for x in top]
        for _ in range(8):
            insert = client.post(f"/rest/v1/{table}", headers=headers, json=payload_rows)
            if insert.status_code < 300:
                created = insert.json() if isinstance(insert.json(), list) else []
                print(f"Inserted {len(created)} items into {table}.")
                return

            msg = insert.text
            m = re.search(r"'([^']+)' column", msg)
            if not m:
                raise RuntimeError(f"Insert failed {insert.status_code}: {msg[:1200]}")
            missing_col = m.group(1)
            for row in payload_rows:
                row.pop(missing_col, None)

        raise RuntimeError(f"Insert failed after schema adaptation: {insert.text[:1200]}")


if __name__ == "__main__":
    main()
