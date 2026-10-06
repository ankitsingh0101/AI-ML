"""
web_search.py — Search for new Indian government scheme information.

Strategy (in order):
  1. Wikipedia Search API  — finds the exact Wikipedia article title for the scheme
  2. Wikipedia REST Summary — fetches the article summary (200-300 words, always clean)
  3. DuckDuckGo Lite HTML  — fallback if Wikipedia has no article

No API key required for any of these. Wikipedia never bot-blocks.

Called by agent.answer_followup when the user asks about schemes not in
the local database.
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request


_HEADERS = {
    "User-Agent": "SchemeFinder/1.0 (https://github.com/scheme-finder-agent; educational)",
    "Accept-Language": "en-IN,en;q=0.9",
}

_WIKI_SEARCH_URL  = "https://en.wikipedia.org/w/api.php"
_WIKI_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary"
_DDG_LITE_URL     = "https://lite.duckduckgo.com/lite/"


# ──────────────────────────────────────────────────────────────────────────────
# Wikipedia helpers
# ──────────────────────────────────────────────────────────────────────────────

def _wiki_search(query: str, limit: int = 3) -> list[str]:
    """Return up to `limit` Wikipedia article titles matching the query."""
    params = urllib.parse.urlencode({
        "action": "query",
        "list": "search",
        "srsearch": query,
        "format": "json",
        "srlimit": limit,
        "srprop": "snippet",
    })
    url = f"{_WIKI_SEARCH_URL}?{params}"
    try:
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return [r["title"] for r in data.get("query", {}).get("search", [])]
    except Exception:
        return []


def _wiki_summary(title: str) -> dict | None:
    """
    Fetch the Wikipedia REST summary for an article.
    Returns dict with 'title', 'extract', 'url' or None on failure.
    """
    url = f"{_WIKI_SUMMARY_URL}/{urllib.parse.quote(title)}"
    try:
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        extract = data.get("extract", "").strip()
        page_url = (
            data.get("content_urls", {}).get("desktop", {}).get("page", "")
            or f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title)}"
        )
        if extract:
            return {"title": data.get("title", title), "extract": extract, "url": page_url}
    except Exception:
        pass
    return None


# ──────────────────────────────────────────────────────────────────────────────
# DuckDuckGo Lite fallback
# ──────────────────────────────────────────────────────────────────────────────

def _ddg_search(query: str, max_results: int = 4) -> list[dict]:
    """
    Attempt DuckDuckGo Lite HTML scraping.
    Returns list of {title, snippet, url} or [] on failure/bot-block.
    """
    full_query = f"{query} India government scheme"
    params = urllib.parse.urlencode({"q": full_query, "kl": "in-en"})
    url = f"{_DDG_LITE_URL}?{params}"
    try:
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except Exception:
        return []

    # Bot-challenge detection — DDG returns anomaly/challenge pages when blocked
    if "anomaly" in html or "challenge-form" in html or len(html) < 5000:
        return []

    title_pat = re.compile(
        r"class=['\"]result-link['\"][^>]*href=['\"]([^'\"]+)['\"][^>]*>(.*?)</a>",
        re.DOTALL | re.IGNORECASE,
    )
    snippet_pat = re.compile(
        r"class=['\"]result-snippet['\"][^>]*>(.*?)</td>",
        re.DOTALL | re.IGNORECASE,
    )

    titles   = title_pat.findall(html)
    snippets = [m.group(1) for m in snippet_pat.finditer(html)]

    results = []
    for i, (href, title_html) in enumerate(titles[:max_results]):
        title = re.sub(r"<[^>]+>", "", title_html).strip()
        snippet_raw = snippets[i] if i < len(snippets) else ""
        snippet = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", snippet_raw)).strip()

        real_url = href
        uddg_m = re.search(r"uddg=([^&]+)", href)
        if uddg_m:
            real_url = urllib.parse.unquote(uddg_m.group(1))
        if real_url.startswith("//"):
            real_url = "https:" + real_url

        if title and real_url:
            results.append({"title": title, "snippet": snippet, "url": real_url})

    return results


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def search_schemes(query: str, max_results: int = 5) -> list[dict]:
    """
    Search for Indian government scheme information.

    Strategy:
      1. Wikipedia Search API to find the article title
      2. Wikipedia REST Summary to get the content
      3. DuckDuckGo Lite as fallback

    Args:
        query:       The user's question / scheme name.
        max_results: Max results to return.

    Returns:
        List of dicts with keys: title, snippet, url
        Empty list on complete failure.
    """
    # ── Pre-process query — strip conversational preamble words ──────────────
    # Wikipedia search works best with key terms, not full sentences.
    # Remove phrases like "tell me about", "what is", "explain", etc.
    import re as _re
    clean_query = _re.sub(
        r"^(tell me about|what is|what are|explain|describe|"
        r"how does|give me info on|i want to know about|"
        r"any|is there a|are there any)\s+",
        "",
        query.strip(),
        flags=_re.IGNORECASE,
    ).strip()
    # Use clean_query for Wikipedia; use original query for DDG
    search_query = clean_query if clean_query else query

    results: list[dict] = []

    # ── Wikipedia articles to skip — these are generic index pages, not useful ─
    _SKIP_TITLES = {
        "list of schemes of the government of india",
        "list of government schemes of india",
        "poverty in india",
        "india",
        "government of india",
    }

    # ── Step 1: Wikipedia search ──────────────────────────────────────────────
    # Try two queries: (a) with "India government scheme" scope, (b) raw query.
    # This handles cases like "PM Surya Ghar" which finds no results with the
    # scoped query but succeeds with the bare scheme name.
    candidate_titles: list[str] = []
    for wiki_query in [f"{search_query} India government scheme", search_query]:
        found = _wiki_search(wiki_query, limit=min(max_results, 3))
        for t in found:
            if t not in candidate_titles:
                candidate_titles.append(t)
        if len(candidate_titles) >= max_results:
            break

    for title in candidate_titles:
        # Skip generic list/index articles
        if title.lower() in _SKIP_TITLES:
            continue
        summary = _wiki_summary(title)
        if summary:
            results.append({
                "title": summary["title"],
                "snippet": summary["extract"],
                "url": summary["url"],
            })
        if len(results) >= max_results:
            break

    if results:
        return results

    # ── Step 2: DuckDuckGo Lite fallback ─────────────────────────────────────
    ddg = _ddg_search(query, max_results=max_results)
    if ddg:
        return ddg

    return []


def format_search_results(results: list[dict], language: str = "English") -> str:
    """Format search results as a markdown string."""
    if not results:
        if language == "Hindi":
            return "खोज से कोई परिणाम नहीं मिला। कृपया myScheme.gov.in देखें।"
        return "No search results found. Please check myScheme.gov.in directly."

    lines = []
    if language == "Hindi":
        lines.append("**इंटरनेट से मिली जानकारी (myScheme.gov.in पर पुष्टि करें):**\n")
    else:
        lines.append("**From web search (please verify on myScheme.gov.in):**\n")

    for r in results:
        lines.append(f"**{r['title']}**")
        if r["snippet"]:
            lines.append(r["snippet"])
        if r["url"]:
            lines.append(f"[Read more]({r['url']})")
        lines.append("")

    if language == "Hindi":
        lines.append("⚠️ *यह जानकारी Wikipedia/इंटरनेट से है। आधिकारिक वेबसाइट पर पुष्टि करें।*")
    else:
        lines.append("⚠️ *Information from Wikipedia — always verify on the official government website.*")

    return "\n".join(lines)
