"""
ml_scorer.py — ML-based scheme relevance scoring.

Uses TF-IDF vectorisation + cosine similarity to rank eligible schemes
by how semantically relevant they are to the user's profile.

Why this is real ML:
  • Builds a TF-IDF matrix over all scheme text (description + benefit + notes)
  • Constructs a natural-language profile sentence from structured profile data
  • Computes cosine similarity between the profile vector and each scheme vector
  • The resulting score is a learned, data-driven relevance rank — not a hardcoded list

No external API is needed; sklearn runs entirely locally.

Public API:
    score_schemes(eligible_items, profile) -> list[dict]
        Returns the same items list, sorted by ML relevance score (descending).
        Each item gets a new key: "ml_score" (float 0–1).
"""

from __future__ import annotations

from typing import Any


def _profile_to_text(profile: dict) -> str:
    """
    Convert a structured profile dict into a natural-language sentence
    that can be compared against scheme descriptions via TF-IDF.
    """
    parts: list[str] = []

    if profile.get("occupation"):
        parts.append(f"{profile['occupation']} worker")
    if profile.get("gender"):
        parts.append(profile["gender"])
    if profile.get("age"):
        age = int(profile["age"])
        if age < 18:
            parts.append("child minor student")
        elif age < 30:
            parts.append("young adult")
        elif age < 60:
            parts.append("adult working age")
        else:
            # Elderly: emphasise pension and old-age benefits specifically
            parts.append("senior citizen elderly old age pension retirement nsap")
    if profile.get("annual_income"):
        income = int(profile["annual_income"])
        if income < 100000:
            # Keep BPL signal but don't let it swamp pension/old-age keywords
            parts.append("low income poor")
        elif income < 250000:
            parts.append("low middle income")
        else:
            parts.append("middle income")
    if profile.get("social_category"):
        cat = profile["social_category"]
        parts.append(cat)
        if cat in ("SC", "ST"):
            parts.append("scheduled caste tribe reservation scholarship")
        elif cat == "OBC":
            parts.append("other backward class reservation")
    if profile.get("has_bpl"):
        age = int(profile.get("age") or 0)
        if age >= 60:
            # For elderly BPL, the most relevant benefit is pension — not cooking gas
            parts.append("BPL pension old age assistance social protection")
        else:
            parts.append("BPL ration card below poverty line food security")
    if profile.get("has_disability"):
        parts.append("disability disabled divyang handicap")
    if profile.get("num_daughters") and int(profile["num_daughters"]) > 0:
        parts.append("daughter girl child sukanya education marriage")
    if profile.get("marital_status"):
        ms = profile["marital_status"]
        parts.append(ms)
        if ms in ("widow", "divorced", "abandoned"):
            age = int(profile.get("age") or 0)
            if age >= 60:
                # Elderly widow → pension is the primary need, not just "financial support"
                parts.append("widow single woman pension old age social assistance")
            else:
                parts.append("widow single woman financial support maternity")
    if profile.get("land_acres") and float(profile["land_acres"]) > 0:
        parts.append("land farmer agriculture cultivable")
    if profile.get("has_bank_account") is False:
        parts.append("unbanked financial inclusion bank account savings")
    if profile.get("state"):
        parts.append(profile["state"])

    return " ".join(parts) if parts else "general citizen india government welfare"


def _scheme_to_text(scheme: dict) -> str:
    """Concatenate all relevant scheme text fields for TF-IDF indexing."""
    parts = [
        scheme.get("name", ""),
        scheme.get("description", ""),
        scheme.get("benefit", ""),
        scheme.get("eligibility", {}).get("notes", ""),
        scheme.get("category", ""),
    ]
    # Add occupation hints from eligibility
    occupations = scheme.get("eligibility", {}).get("occupation", [])
    if isinstance(occupations, list):
        parts.extend(occupations)
    return " ".join(str(p) for p in parts if p)


def score_schemes(
    items: list[dict],
    profile: dict,
) -> list[dict]:
    """
    Rank a list of scheme items by ML-computed relevance to the user profile.

    Args:
        items:   List of {"scheme": ..., "reasons": [...], "missing": [...]}
                 (as returned by matcher.match_schemes)
        profile: The user's collected profile dict.

    Returns:
        Same list, sorted by "ml_score" descending.
        Each item has a new key "ml_score" (float, 0–1).
        If sklearn is not installed or < 2 items, returns items unchanged
        with ml_score=1.0 (graceful degradation).
    """
    if len(items) < 2:
        for item in items:
            item["ml_score"] = 1.0
        return items

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        import numpy as np
    except ImportError:
        # sklearn not installed — fall back silently, no crash
        for item in items:
            item["ml_score"] = 1.0
        return items

    # Build corpus: all scheme texts + the profile text at the end
    corpus = [_scheme_to_text(item["scheme"]) for item in items]
    profile_text = _profile_to_text(profile)
    corpus.append(profile_text)

    try:
        vectorizer = TfidfVectorizer(
            min_df=1,
            ngram_range=(1, 2),   # unigrams + bigrams for richer matching
            stop_words="english",
            sublinear_tf=True,    # log-normalise term frequency
        )
        tfidf_matrix = vectorizer.fit_transform(corpus)
    except Exception:
        for item in items:
            item["ml_score"] = 1.0
        return items

    # Profile vector is the last row
    profile_vec = tfidf_matrix[-1]
    scheme_vecs = tfidf_matrix[:-1]

    # Cosine similarity between profile and each scheme
    similarities = cosine_similarity(profile_vec, scheme_vecs).flatten()

    # Attach score to each item
    for item, score in zip(items, similarities):
        item["ml_score"] = float(score)

    # Sort descending by ML score
    items.sort(key=lambda x: x["ml_score"], reverse=True)
    return items
