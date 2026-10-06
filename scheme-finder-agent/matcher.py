"""
matcher.py — Rule-based eligibility engine.

Public API:
    match_schemes(profile: dict, schemes: list) -> dict

The returned dict has three keys:
    "eligible"          — schemes the user definitely qualifies for
    "possibly_eligible" — schemes blocked only by missing profile fields
    "not_eligible"      — schemes the user does not qualify for

Each item is a dict:
    {
        "scheme":   <scheme dict from schemes.json>,
        "reasons":  [<plain-English reason strings>],        # why eligible / why not
        "missing":  [<field names still needed>],            # only for possibly_eligible
    }

Profile fields (all optional; missing = None / empty string / empty list):
    age              int
    gender           str   "male" | "female" | "other"
    state            str   e.g. "Madhya Pradesh"
    occupation       str   e.g. "farmer", "student", "daily-wage worker", …
    annual_income    int   family income in INR
    social_category  str   "General" | "OBC" | "SC" | "ST"
    marital_status   str   "married" | "unmarried" | "widow" | "divorced" | "abandoned"
    land_acres       float land owned in acres (0 if none)
    has_bpl          bool
    has_disability   bool
    num_daughters    int
    has_bank_account bool
"""

from __future__ import annotations

from typing import Any

from ml_scorer import score_schemes as _ml_score

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

_UNORGANISED_OCCUPATIONS = {
    "farmer",
    "daily-wage worker",
    "self-employed",
    "homemaker",
    "street vendor",
    "construction worker",
    "domestic worker",
    "unemployed",
    "agricultural labourer",
}


def _norm_str(value: Any) -> str | None:
    """Return a lower-cased, stripped string or None if falsy."""
    if value is None:
        return None
    s = str(value).strip().lower()
    return s if s else None


def _norm_list(value: Any) -> list[str]:
    """Normalise a list of strings to lower-case; accept a bare string too."""
    if not value:
        return []
    if isinstance(value, str):
        return [value.strip().lower()]
    return [str(v).strip().lower() for v in value if v]


def _missing_key(profile: dict, key: str) -> bool:
    """True when a profile key is absent or its value is None / empty."""
    val = profile.get(key)
    if val is None:
        return True
    if isinstance(val, str) and val.strip() == "":
        return True
    return False


# ──────────────────────────────────────────────────────────────────────────────
# Core matching logic for a single scheme
# ──────────────────────────────────────────────────────────────────────────────

def _check_scheme(profile: dict, scheme: dict) -> tuple[str, list[str], list[str]]:
    """
    Returns:
        status   — "eligible" | "possibly_eligible" | "not_eligible"
        reasons  — human-readable pass/fail explanations
        missing  — list of profile fields that are unknown but required
    """
    elig = scheme.get("eligibility", {})
    reasons: list[str] = []
    missing: list[str] = []
    hard_fail = False  # True = definitely NOT eligible

    # ── State check ──────────────────────────────────────────────────────────
    scheme_state = (scheme.get("state") or "All").strip()
    if scheme_state not in ("All", "all", ""):
        user_state = _norm_str(profile.get("state"))
        if user_state is None:
            missing.append("state")
        elif user_state != scheme_state.lower():
            hard_fail = True
            reasons.append(
                f"This scheme is only for {scheme_state}; your state is {profile['state']}."
            )
        else:
            reasons.append(f"You are in {scheme_state}. ✓")

    # ── Age ──────────────────────────────────────────────────────────────────
    min_age = elig.get("min_age")
    max_age = elig.get("max_age")
    if min_age is not None or max_age is not None:
        if _missing_key(profile, "age"):
            missing.append("age")
        else:
            age = int(profile["age"])
            if min_age is not None and age < min_age:
                hard_fail = True
                reasons.append(f"Age {age} is below minimum age {min_age}.")
            elif max_age is not None and age > max_age:
                hard_fail = True
                reasons.append(f"Age {age} exceeds maximum age {max_age}.")
            else:
                age_desc = []
                if min_age is not None:
                    age_desc.append(f"≥{min_age}")
                if max_age is not None:
                    age_desc.append(f"≤{max_age}")
                reasons.append(f"Age {age} meets requirement ({', '.join(age_desc)}). ✓")

    # ── Gender ───────────────────────────────────────────────────────────────
    req_gender = _norm_str(elig.get("gender"))
    if req_gender:
        if _missing_key(profile, "gender"):
            missing.append("gender")
        else:
            user_gender = _norm_str(profile["gender"])
            if user_gender != req_gender:
                hard_fail = True
                reasons.append(
                    f"This scheme is for {req_gender}s only; your gender is {profile['gender']}."
                )
            else:
                reasons.append(f"Gender ({profile['gender']}) matches requirement. ✓")

    # ── Occupation ───────────────────────────────────────────────────────────
    req_occupations = _norm_list(elig.get("occupation"))
    if req_occupations:
        if _missing_key(profile, "occupation"):
            missing.append("occupation")
        else:
            user_occ = _norm_str(profile["occupation"])
            if user_occ not in req_occupations:
                # Check for partial / semantic match
                matched = any(r in user_occ for r in req_occupations) or \
                          any(user_occ in r for r in req_occupations)
                if not matched:
                    hard_fail = True
                    reasons.append(
                        f"Occupation '{profile['occupation']}' does not match "
                        f"required: {', '.join(req_occupations)}."
                    )
                else:
                    reasons.append(f"Occupation '{profile['occupation']}' qualifies. ✓")
            else:
                reasons.append(f"Occupation '{profile['occupation']}' qualifies. ✓")

    # ── Income ───────────────────────────────────────────────────────────────
    max_income = elig.get("max_income")
    if max_income is not None:
        if _missing_key(profile, "annual_income"):
            missing.append("annual_income")
        else:
            income = int(profile["annual_income"])
            if income > max_income:
                hard_fail = True
                reasons.append(
                    f"Family income Rs {income:,} exceeds maximum Rs {max_income:,}."
                )
            else:
                reasons.append(
                    f"Family income Rs {income:,} is within Rs {max_income:,} limit. ✓"
                )

    # ── Social category ──────────────────────────────────────────────────────
    req_categories = _norm_list(elig.get("social_category"))
    if req_categories:
        if _missing_key(profile, "social_category"):
            missing.append("social_category")
        else:
            user_cat = _norm_str(profile["social_category"])
            if user_cat not in req_categories:
                hard_fail = True
                reasons.append(
                    f"Social category '{profile['social_category']}' not in "
                    f"required: {', '.join(c.upper() for c in req_categories)}."
                )
            else:
                reasons.append(
                    f"Social category '{profile['social_category']}' qualifies. ✓"
                )

    # ── Land requirement ─────────────────────────────────────────────────────
    if elig.get("requires_land"):
        if _missing_key(profile, "land_acres"):
            missing.append("land_acres")
        else:
            land = float(profile.get("land_acres") or 0)
            if land <= 0:
                hard_fail = True
                reasons.append("You need to own cultivable land for this scheme.")
            else:
                reasons.append(f"You own {land} acres of land. ✓")

    # ── Max land (e.g. Ladli Behna) ──────────────────────────────────────────
    max_land = elig.get("max_land_acres")
    if max_land is not None:
        if not _missing_key(profile, "land_acres"):
            land = float(profile.get("land_acres") or 0)
            if land > max_land:
                hard_fail = True
                reasons.append(
                    f"Land holding {land} acres exceeds maximum {max_land} acres allowed."
                )
            else:
                reasons.append(f"Land holding {land} acres is within {max_land} acres. ✓")

    # ── BPL card ─────────────────────────────────────────────────────────────
    if elig.get("requires_bpl"):
        if _missing_key(profile, "has_bpl"):
            missing.append("has_bpl")
        else:
            if not profile["has_bpl"]:
                hard_fail = True
                reasons.append("This scheme requires a BPL / ration card.")
            else:
                reasons.append("You have a BPL card. ✓")

    # ── Marital status ───────────────────────────────────────────────────────
    req_marital = _norm_list(elig.get("marital_status"))
    if req_marital:
        if _missing_key(profile, "marital_status"):
            missing.append("marital_status")
        else:
            user_ms = _norm_str(profile["marital_status"])
            if user_ms not in req_marital:
                hard_fail = True
                reasons.append(
                    f"Marital status '{profile['marital_status']}' does not match "
                    f"required: {', '.join(req_marital)}."
                )
            else:
                reasons.append(f"Marital status '{profile['marital_status']}' qualifies. ✓")

    # ── Disability ───────────────────────────────────────────────────────────
    if elig.get("requires_disability"):
        if _missing_key(profile, "has_disability"):
            missing.append("has_disability")
        else:
            if not profile["has_disability"]:
                hard_fail = True
                reasons.append("This scheme is for persons with disability only.")
            else:
                reasons.append("Disability status qualifies. ✓")

    # ── Daughters / children ─────────────────────────────────────────────────
    min_daughters = elig.get("min_daughters")
    if min_daughters is not None:
        if _missing_key(profile, "num_daughters"):
            missing.append("num_daughters")
        else:
            nd = int(profile.get("num_daughters") or 0)
            if nd < min_daughters:
                hard_fail = True
                reasons.append(
                    f"This scheme requires at least {min_daughters} daughter(s); "
                    f"you have {nd}."
                )
            else:
                reasons.append(f"Number of daughters ({nd}) qualifies. ✓")

    # ── Ayushman Bharat: BPL families OR all citizens aged 70+ ───────────────
    if scheme.get("id") == "ayushman_bharat":
        age = profile.get("age")
        has_bpl = profile.get("has_bpl")
        age_known = age is not None
        bpl_known = has_bpl is not None

        if age_known and int(age) >= 70:
            # Sept 2024 expansion: all 70+ covered regardless of BPL
            reasons.append("You are 70 or older — covered under the 2024 Ayushman Bharat expansion for all senior citizens. ✓")
        elif bpl_known and has_bpl:
            reasons.append("BPL card holder — eligible for Ayushman Bharat. ✓")
        elif bpl_known and not has_bpl and (not age_known or int(age) < 70):
            hard_fail = True
            reasons.append(
                "Ayushman Bharat requires either a BPL card OR age 70+. "
                "You do not meet either condition based on your profile."
            )
        else:
            # age or BPL unknown — need more info
            if not age_known:
                missing.append("age")
            if not bpl_known:
                missing.append("has_bpl")

    # ── e-Shram: unorganised sector check ────────────────────────────────────
    if scheme.get("id") == "e_shram":
        if not _missing_key(profile, "occupation"):
            user_occ = _norm_str(profile["occupation"])
            is_unorganised = (
                user_occ in _UNORGANISED_OCCUPATIONS
                or any(k in user_occ for k in _UNORGANISED_OCCUPATIONS)
            )
            if not is_unorganised:
                hard_fail = True
                reasons.append(
                    f"Occupation '{profile['occupation']}' may not qualify as "
                    "unorganised sector. EPFO/ESIC members are excluded."
                )

    # ── Atal Pension Yojana: savings account ─────────────────────────────────
    if scheme.get("id") == "atal_pension_yojana":
        if _missing_key(profile, "has_bank_account"):
            missing.append("has_bank_account")
        else:
            if not profile.get("has_bank_account"):
                hard_fail = True
                reasons.append("You need a savings bank account to enrol in APY.")
            else:
                reasons.append("You have a bank account. ✓")

    # ── PM Jan Dhan: only for those WITHOUT an existing bank account ──────────
    if scheme.get("id") == "pm_jan_dhan":
        if _missing_key(profile, "has_bank_account"):
            missing.append("has_bank_account")
        elif profile.get("has_bank_account"):
            hard_fail = True
            reasons.append(
                "PM Jan Dhan Yojana is for people who do not yet have a bank account. "
                "You already have one, so you don't need to open a PMJDY account — "
                "but you can still benefit from RuPay insurance if your account is a Jan Dhan account."
            )

    # ── Determine final status ───────────────────────────────────────────────
    if hard_fail:
        return "not_eligible", reasons, []

    if missing:
        return "possibly_eligible", reasons, missing

    if not reasons:
        # No eligibility criteria → everyone qualifies (e.g. Jan Dhan)
        reasons.append("No restrictive eligibility criteria — open to all. ✓")

    return "eligible", reasons, []


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def match_schemes(profile: dict, schemes: list) -> dict:
    """
    Evaluate the user profile against every scheme.

    Returns:
        {
            "eligible":          [{"scheme": ..., "reasons": [...], "missing": []}],
            "possibly_eligible": [{"scheme": ..., "reasons": [...], "missing": [...]}],
            "not_eligible":      [{"scheme": ..., "reasons": [...], "missing": []}],
        }
    """
    result: dict[str, list] = {
        "eligible": [],
        "possibly_eligible": [],
        "not_eligible": [],
    }

    for scheme in schemes:
        status, reasons, missing = _check_scheme(profile, scheme)
        entry = {
            "scheme": scheme,
            "reasons": reasons,
            "missing": missing,
        }
        result[status].append(entry)

    # ── ML-based relevance ranking ────────────────────────────────────────────
    # TF-IDF + cosine similarity scores each eligible/possibly-eligible scheme
    # against the user's profile text. This replaces the old hardcoded benefit
    # heuristic with a data-driven ranking that adapts to the user's situation.
    result["eligible"] = _ml_score(result["eligible"], profile)
    result["possibly_eligible"] = _ml_score(result["possibly_eligible"], profile)

    return result
