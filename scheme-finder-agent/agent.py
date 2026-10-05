"""
agent.py — Conversation agent: orchestrates the LLM, profile collection,
matching, and explanation.

Public API (used by app.py):
    load_schemes()                          → list of scheme dicts
    get_system_prompt(language)             → str
    extract_profile_updates(text, profile)  → dict of new fields
    decide_next_question(profile, language) → str  (next question to ask)
    run_match(profile)                      → dict (eligible / possibly / not)
    format_match_results(results, profile, language) → str  (markdown)
    answer_followup(question, profile, results, language) → str

All LLM calls are funnelled through llm.chat_completion.
The eligibility decision is ALWAYS made by matcher.match_schemes — never the LLM.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from llm import chat_completion
from matcher import match_schemes

# ──────────────────────────────────────────────────────────────────────────────
# Scheme data
# ──────────────────────────────────────────────────────────────────────────────

_SCHEMES_PATH = Path(__file__).parent / "data" / "schemes.json"


def load_schemes() -> list[dict]:
    with open(_SCHEMES_PATH, encoding="utf-8") as fh:
        return json.load(fh)


# ──────────────────────────────────────────────────────────────────────────────
# Profile field definitions (for missing-field tracking)
# ──────────────────────────────────────────────────────────────────────────────

PROFILE_FIELDS = [
    "age",
    "gender",
    "state",
    "occupation",
    "annual_income",
    "social_category",
    "marital_status",
    "land_acres",
    "has_bpl",
    "has_disability",
    "num_daughters",
    "has_bank_account",
]

# Fields that are only relevant for certain occupations / conditions
_CONDITIONAL_FIELDS: dict[str, str] = {
    "land_acres": "farmer",  # only ask if occupation is farmer
}

# ──────────────────────────────────────────────────────────────────────────────
# System prompt
# ──────────────────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT_EN = """You are a helpful, friendly government scheme assistant for low-income Indian citizens.
Your job is to help users discover which government welfare schemes they are eligible for.

STRICT RULES — follow these without exception:
1. Answer questions about schemes ONLY using the scheme information you are given. Do NOT invent benefits, amounts, or eligibility criteria.
2. If a user asks about a scheme not in your knowledge base, say: "I don't have that information. Please check myScheme.gov.in or your nearest government office."
3. You NEVER decide eligibility yourself. Eligibility is computed by a separate rules engine; you only explain the results.
4. Do NOT ask for or encourage users to share Aadhaar numbers, bank account numbers, phone numbers, or any other sensitive personal data.
5. Use simple, respectful language. Many users may have limited literacy. Be warm and patient.
6. Respond in {language}.

When extracting profile information from user messages, return ONLY a JSON object (no extra text) with any of these fields you can determine:
  age (integer), gender (male/female/other), state (string), occupation (string),
  annual_income (integer, INR), social_category (General/OBC/SC/ST),
  marital_status (married/unmarried/widow/divorced/abandoned),
  land_acres (float), has_bpl (true/false), has_disability (true/false),
  num_daughters (integer), has_bank_account (true/false)

If the user has not provided a value for a field, omit that field from the JSON.
"""

_SYSTEM_PROMPT_HI = """आप एक सहायक और मित्रवत सरकारी योजना सहायक हैं जो भारत के कम आय वाले नागरिकों की मदद करते हैं।
आपका काम उपयोगकर्ताओं को यह जानने में मदद करना है कि वे किन सरकारी कल्याण योजनाओं के लिए पात्र हैं।

सख्त नियम — इन्हें बिना किसी अपवाद के पालन करें:
1. योजनाओं के बारे में केवल उस जानकारी का उपयोग करके उत्तर दें जो आपको दी गई है। लाभ, राशि या पात्रता मानदंड का आविष्कार न करें।
2. यदि उपयोगकर्ता किसी ऐसी योजना के बारे में पूछे जो आपके ज्ञान में नहीं है, तो कहें: "मेरे पास यह जानकारी नहीं है। कृपया myScheme.gov.in या अपने नज़दीकी सरकारी कार्यालय में जाँच करें।"
3. आप स्वयं कभी पात्रता का निर्णय नहीं लेते। पात्रता एक अलग नियम इंजन द्वारा की जाती है; आप केवल परिणामों की व्याख्या करते हैं।
4. उपयोगकर्ताओं से आधार नंबर, बैंक खाता संख्या, फ़ोन नंबर या कोई अन्य संवेदनशील व्यक्तिगत डेटा साझा करने के लिए न कहें या प्रोत्साहित न करें।
5. सरल, सम्मानजनक भाषा का उपयोग करें। कई उपयोगकर्ताओं की साक्षरता सीमित हो सकती है। गर्म और धैर्यवान रहें।
6. {language} में उत्तर दें।
"""


def get_system_prompt(language: str = "English") -> str:
    base = _SYSTEM_PROMPT_HI if language == "Hindi" else _SYSTEM_PROMPT_EN
    return base.replace("{language}", language)


# ──────────────────────────────────────────────────────────────────────────────
# Profile extraction (LLM-powered)
# ──────────────────────────────────────────────────────────────────────────────

_EXTRACT_PROMPT = """From the user message below, extract any profile fields that are mentioned.
Return ONLY a valid JSON object with the fields you can determine. If nothing relevant is mentioned, return {{}}.

Available fields:
  age (integer), gender (male/female/other), state (string),
  occupation (string: farmer/student/daily-wage worker/homemaker/unemployed/self-employed/etc.),
  annual_income (integer INR), social_category (General/OBC/SC/ST),
  marital_status (married/unmarried/widow/divorced/abandoned),
  land_acres (float), has_bpl (true/false), has_disability (true/false),
  num_daughters (integer), has_bank_account (true/false)

User message: {message}

JSON only, no explanation:"""

# Used only when regex finds nothing for a specific field and we need
# Groq to decide: is this a valid value, and if so, what is the canonical form?
_VALIDATE_PROMPT = """You are a strict data-validation assistant for an Indian government scheme eligibility tool.

The user was asked for their "{field}" and replied: "{value}"

Your job: decide if the reply is a legitimate answer for the field.

STRICT rules:
- Reply ONLY with a JSON object. No explanation, no extra text.
- If VALID:   {{"valid": true, "canonical": <normalised value>}}
- If INVALID: {{"valid": false}}

Field-specific validation rules:
  occupation  → Must be a recognisable real-world job or profession that a person can hold.
                Examples of VALID: farmer, teacher, entrepreneur, plumber, army officer, nurse, shopkeeper.
                Examples of INVALID: random letters, numbers, nonsense words, things that are not jobs.
                If it is a real job/profession (even uncommon), it is valid.

  state       → Must be the name of a real Indian state or union territory.
                Examples of VALID: Jharkhand, Delhi, Puducherry, Chandigarh.
                Anything that is not a real Indian state/UT is INVALID.

  gender      → Must be exactly "male", "female", or "other". Anything else is INVALID.

  social_category → Must be one of: General, OBC, SC, ST. Anything else is INVALID.

  marital_status  → Must be one of: married, unmarried, widow, divorced, abandoned. Anything else is INVALID.

  age         → Must be an integer between 5 and 120. Anything else is INVALID.

  annual_income → Must be a number representing INR, between 1000 and 100000000. Anything else is INVALID.

  has_bpl / has_disability / has_bank_account → Must clearly mean yes (true) or no (false). Anything ambiguous is INVALID.

  num_daughters → Must be a non-negative integer. Anything else is INVALID.

  land_acres  → Must be a non-negative number. Anything else is INVALID.

Be STRICT. When in doubt, return {{"valid": false}}."""


# ──────────────────────────────────────────────────────────────────────────────
# Regex-based fallback extractor (no LLM needed)
# ──────────────────────────────────────────────────────────────────────────────

_INDIAN_STATES = {
    # States
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh",
    "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka",
    "kerala", "madhya pradesh", "mp", "maharashtra", "manipur", "meghalaya",
    "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim",
    "tamil nadu", "telangana", "tripura", "uttar pradesh", "up", "uttarakhand",
    "west bengal",
    # Union Territories
    "delhi", "new delhi", "jammu and kashmir", "jammu and kashna", "ladakh",
    "chandigarh", "puducherry", "pondicherry", "dadra and nagar haveli",
    "daman and diu", "lakshadweep", "andaman and nicobar", "andaman and nicobar islands",
}

_STATE_NORMALIZE = {"mp": "Madhya Pradesh", "up": "Uttar Pradesh"}

_STATE_TITLE = {
    "madhya pradesh": "Madhya Pradesh", "uttar pradesh": "Uttar Pradesh",
    "west bengal": "West Bengal", "andhra pradesh": "Andhra Pradesh",
    "arunachal pradesh": "Arunachal Pradesh", "himachal pradesh": "Himachal Pradesh",
    "tamil nadu": "Tamil Nadu", "jammu and kashmir": "Jammu and Kashmir",
    "jammu and kashna": "Jammu and Kashmir",
    "new delhi": "Delhi",
    "pondicherry": "Puducherry",
    "andaman and nicobar": "Andaman and Nicobar Islands",
    "andaman and nicobar islands": "Andaman and Nicobar Islands",
    "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
    "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
}


def _normalize_state(state: str) -> str:
    return _STATE_TITLE.get(state, _STATE_NORMALIZE.get(state, state.title()))

_OCCUPATIONS = [
    "farmer", "student", "daily-wage worker", "daily wage worker",
    "homemaker", "unemployed", "self-employed", "construction worker",
    "domestic worker", "street vendor", "agricultural labourer",
    "labourer", "labor", "labour",
    "entrepreneur", "business owner", "shopkeeper", "trader",
    "driver", "teacher", "nurse", "doctor", "government employee",
    "private employee", "salaried", "retired",
]

_CATEGORY_MAP = {
    "general": "General", "gen": "General",
    "obc": "OBC",
    "sc": "SC", "scheduled caste": "SC",
    "st": "ST", "scheduled tribe": "ST",
}

_MARITAL_MAP = {
    "married": "married", "unmarried": "unmarried", "single": "unmarried",
    "widow": "widow", "widower": "widow", "widowed": "widow",
    "divorced": "divorced", "abandoned": "abandoned", "separated": "divorced",
}


def _regex_extract(text: str, context_field: str | None = None) -> dict:
    """
    Fast regex heuristics to extract profile fields from plain text.
    Works without any LLM — used as primary extractor or fallback.

    context_field: the profile field that was just asked (from decide_next_question).
    When set, a bare / ambiguous answer is interpreted in that context.
    """
    t = text.strip()
    tl = t.lower()
    updates: dict = {}

    # ── Context-aware bare-answer handling ───────────────────────────────────
    # If the last question asked for a specific field, try to parse the answer
    # directly before running the general patterns.
    bare = tl.strip()

    if context_field == "age":
        m = re.fullmatch(r"\d{1,3}", bare)
        if m:
            v = int(m.group())
            if 5 <= v <= 120:
                updates["age"] = v
                return updates  # nothing else to extract from a bare number

    elif context_field == "annual_income":
        # Accept bare numbers and "X lakh / X thousand / Xk"
        m = re.fullmatch(r"(\d[\d,\.]*)\s*(lakh|thousand|k)?", bare)
        if m:
            try:
                amount = float(m.group(1).replace(",", ""))
                suffix = (m.group(2) or "").lower()
                if suffix == "lakh":
                    amount *= 100000
                elif suffix in ("thousand", "k"):
                    amount *= 1000
                income = int(amount)
                if 1000 <= income <= 100_000_000:
                    updates["annual_income"] = income
                    return updates
            except (ValueError, TypeError):
                pass

    elif context_field == "land_acres":
        m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(acre|acres|bigha|bighas|hectare)?", bare)
        if m:
            try:
                updates["land_acres"] = float(m.group(1))
                return updates
            except (ValueError, TypeError):
                pass

    elif context_field == "num_daughters":
        m = re.fullmatch(r"\d+", bare)
        if m:
            updates["num_daughters"] = int(m.group())
            return updates

    elif context_field == "gender":
        if bare in ("male", "man", "boy", "m", "पुरुष"):
            updates["gender"] = "male"
            return updates
        if bare in ("female", "woman", "girl", "f", "lady", "महिला"):
            updates["gender"] = "female"
            return updates

    elif context_field == "occupation":
        if bare:
            # Only confirm hardcoded/known occupations here.
            # Unknown values are intentionally NOT set — they fall through to
            # Tier 2 (Groq validation) so garbage is rejected and novel jobs
            # like "army officer" or "electrician" are accepted via the LLM.
            # Tier 3 (no API key) will accept them as-is downstream.
            for occ in sorted(_OCCUPATIONS, key=len, reverse=True):
                if bare == occ or bare == occ.replace("-", " "):
                    updates["occupation"] = occ if occ not in ("labourer", "labor", "labour", "daily wage worker") else "daily-wage worker"
                    return updates
            # Not in hardcoded list — return nothing; let Tier 2/3 decide.

    elif context_field == "social_category":
        for key, val in _CATEGORY_MAP.items():
            if bare == key:
                updates["social_category"] = val
                return updates

    elif context_field == "marital_status":
        for key, val in _MARITAL_MAP.items():
            if bare == key:
                updates["marital_status"] = val
                return updates

    elif context_field == "state":
        # Single-word or multi-word state name
        for state in sorted(_INDIAN_STATES, key=len, reverse=True):
            if bare == state:
                updates["state"] = _normalize_state(state)
                return updates

    elif context_field in ("has_bpl", "has_disability", "has_bank_account"):
        _YES = {"yes", "haan", "ha", "हाँ", "हां", "y", "ji", "ji haan", "haa"}
        _NO  = {"no", "nahi", "nahin", "नहीं", "n", "nope", "nahi hai"}
        if bare in _YES:
            updates[context_field] = True
            return updates
        if bare in _NO:
            updates[context_field] = False
            return updates

    # ── Age — contextual patterns (no bare number here) ──────────────────────
    age_m = re.search(
        r"\b(?:i\s+am|age\s*[:\-]?|aged?)\s*(\d{1,3})\b"
        r"|\b(\d{1,3})\s*(?:years?\s*old|yr|yrs|साल)\b",
        tl,
    )
    if age_m:
        raw_age = int(age_m.group(1) or age_m.group(2))
        if 5 <= raw_age <= 120:
            updates["age"] = raw_age

    # State — match known state names in the message
    for state in sorted(_INDIAN_STATES, key=len, reverse=True):
        if re.search(r"\b" + re.escape(state) + r"\b", tl):
            updates["state"] = _normalize_state(state)
            break

    # Occupation
    for occ in sorted(_OCCUPATIONS, key=len, reverse=True):
        if re.search(r"\b" + re.escape(occ) + r"\b", tl):
            # Normalise variants
            if occ in ("labourer", "labor", "labour", "daily wage worker"):
                updates["occupation"] = "daily-wage worker"
            else:
                updates["occupation"] = occ
            break

    # Gender
    if re.search(r"\b(i am a? ?(male|man|boy)|i'?m a? ?(male|man|boy))\b", tl):
        updates["gender"] = "male"
    elif re.search(r"\b(i am a? ?(female|woman|girl|lady)|i'?m a? ?(female|woman|girl|lady))\b", tl):
        updates["gender"] = "female"
    elif tl.strip() in ("male", "man", "female", "woman", "girl", "boy"):
        updates["gender"] = "male" if tl.strip() in ("male", "man", "boy") else "female"

    # Social category
    for key, val in _CATEGORY_MAP.items():
        if re.search(r"\b" + re.escape(key) + r"\b", tl):
            updates["social_category"] = val
            break

    # Marital status
    for key, val in _MARITAL_MAP.items():
        if re.search(r"\b" + re.escape(key) + r"\b", tl):
            updates["marital_status"] = val
            break

    # Annual income — "80000", "80,000", "80 thousand", "80k", "1.5 lakh"
    income_m = re.search(
        r"(?:income|salary|earn(?:ing)?s?|rs\.?\s*|rupees?\s*)"
        r"(\d[\d,\.]*)\s*(lakh|thousand|k)?",
        tl,
    )
    if not income_m:
        # bare number after context words like "around", "about", "approximately"
        income_m = re.search(
            r"(?:around|about|approximately|nearly|roughly)\s*"
            r"(?:rs\.?\s*)?(\d[\d,\.]*)\s*(lakh|thousand|k)?",
            tl,
        )
    if not income_m:
        # standalone number that looks like an income (5 digits+)
        income_m = re.search(r"\b(\d{4,7})\b", tl)
    if income_m:
        raw = income_m.group(1).replace(",", "")
        try:
            amount = float(raw)
            suffix = (income_m.group(2) or "").lower() if income_m.lastindex and income_m.lastindex >= 2 else ""
            if suffix in ("lakh",):
                amount *= 100000
            elif suffix in ("thousand", "k"):
                amount *= 1000
            income = int(amount)
            if 1000 <= income <= 100_000_000:
                updates["annual_income"] = income
        except (ValueError, TypeError):
            pass

    # Land acres — "2 acres", "2 acre", "2 bigha" (rough), "no land", "0 acres"
    no_land = re.search(r"\b(no land|don'?t own|no agricultural|landless)\b", tl)
    if no_land:
        updates["land_acres"] = 0.0
    else:
        land_m = re.search(r"(\d+(?:\.\d+)?)\s*(acre|acres|bigha|bighas|hectare)", tl)
        if land_m:
            updates["land_acres"] = float(land_m.group(1))

    # BPL card
    if re.search(r"\b(bpl|below poverty|ration card)\b", tl):
        if re.search(r"\b(no|don'?t have|nahi|नहीं)\b", tl):
            updates["has_bpl"] = False
        else:
            updates["has_bpl"] = True
    elif tl.strip() in ("yes", "haan", "ha", "हाँ", "हां"):
        pass  # too ambiguous without context
    elif tl.strip() in ("no", "nahi", "नहीं"):
        pass  # too ambiguous

    # Disability
    if re.search(r"\b(disabled|disability|divyang|handicap)\b", tl):
        if re.search(r"\b(no|not|don'?t)\b", tl):
            updates["has_disability"] = False
        else:
            updates["has_disability"] = True

    # Number of daughters
    daughters_m = re.search(r"(\d+)\s*(daughter|beti|बेटी)", tl)
    if daughters_m:
        updates["num_daughters"] = int(daughters_m.group(1))
    elif re.search(r"\b(no daughter|0 daughter|no beti)\b", tl):
        updates["num_daughters"] = 0

    # Bank account
    if re.search(r"\bbank\s*account\b", tl):
        if re.search(r"\b(no|don'?t|nahi)\b", tl):
            updates["has_bank_account"] = False
        else:
            updates["has_bank_account"] = True

    return updates


def _llm_validate_field(field: str, raw_value: str) -> tuple[bool, object]:
    """
    Ask the LLM whether `raw_value` is a valid answer for `field`.

    Returns:
        (True,  canonical_value)  — valid, use canonical_value in the profile
        (False, None)             — invalid, ask the user to re-enter
    Raises RuntimeError on API failure.
    """
    # Quick pre-filter: if the value has no real letter sequences (e.g. pure
    # symbols, digits-only for a text field, or a string with no vowels that
    # looks like keyboard mashing), reject it immediately without an API call.
    # This saves LLM quota and avoids inconsistent model behaviour on gibberish.
    #
    # NOTE: social_category is excluded — its valid values include "SC" and "ST"
    # which are legitimate abbreviations with no vowels.
    _text_fields = {"occupation", "state", "gender", "marital_status"}
    if field in _text_fields:
        letters_only = re.sub(r"[^a-zA-Z]", "", raw_value)
        # Must have at least 2 letters and at least one vowel
        if len(letters_only) < 2 or not re.search(r"[aeiouAEIOU]", letters_only):
            return False, None

    prompt = _VALIDATE_PROMPT.format(field=field, value=raw_value)
    try:
        raw = chat_completion(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="",
            temperature=0.0,
            max_tokens=100,
        )
    except Exception as exc:
        raise RuntimeError(f"Groq validation failed: {exc}") from exc

    raw = re.sub(r"```(?:json)?", "", raw).strip().strip("`").strip()
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        # LLM gave unparseable output — treat as invalid to be safe
        return False, None
    try:
        obj = json.loads(m.group())
    except json.JSONDecodeError:
        return False, None

    if not obj.get("valid", False):
        return False, None

    canonical = obj.get("canonical", raw_value)

    # Type-coerce canonical to match the expected field type
    try:
        if field in ("age", "num_daughters"):
            canonical = int(canonical)
        elif field == "annual_income":
            canonical = int(float(str(canonical).replace(",", "")))
        elif field == "land_acres":
            canonical = float(canonical)
        elif field in ("has_bpl", "has_disability", "has_bank_account"):
            if isinstance(canonical, str):
                canonical = canonical.lower() in ("true", "yes", "1", "हाँ", "हां")
            else:
                canonical = bool(canonical)
    except (ValueError, TypeError):
        return False, None

    return True, canonical


def extract_profile_updates(
    user_message: str,
    current_profile: dict,
    context_field: str | None = None,
) -> dict:
    """
    Extract structured profile fields from a free-text message.

    Three-tier strategy
    -------------------
    Tier 1 — Regex (always runs, no API cost):
        Handles all known/hardcoded values for every field.
        If regex finds a value for context_field → done, return immediately.

    Tier 2 — Groq validation (only when regex finds NOTHING for context_field
              AND an LLM_API_KEY is configured):
        Ask the LLM: "is this a valid value for field X?"
        • LLM says YES  → store the canonical value it returns.
        • LLM says NO   → return {"__invalid__": True} so the UI can re-ask.

    Tier 3 — No API key and regex found nothing:
        Accept the raw input as-is (graceful degradation, same as before).

    The special key "__invalid__" is a signal to the caller (app.py) to
    re-ask the same question with a friendly validation error message.
    """
    has_api_key = bool(os.getenv("LLM_API_KEY", "").strip())

    # ── Tier 1: regex ─────────────────────────────────────────────────────────
    regex_updates = _regex_extract(user_message, context_field)

    # If regex already found a value for the field currently being asked,
    # we're done — no LLM needed.
    if context_field and context_field in regex_updates:
        return regex_updates

    # ── Tier 2: LLM validation for unknown input ──────────────────────────────
    # Only triggered when:
    #   • we know which field was being asked (context_field is set)
    #   • regex found nothing for that field
    #   • the user actually typed something (not empty)
    #   • an API key is configured
    raw_input = user_message.strip()
    if context_field and raw_input and has_api_key:
        is_valid, canonical = _llm_validate_field(context_field, raw_input)
        if is_valid:
            # Merge: start with whatever regex found for other fields, then
            # add the LLM-validated value for context_field.
            return {**regex_updates, context_field: canonical}
        else:
            # The LLM says the input is wrong for this field.
            # Signal the UI to re-ask the question with a validation error.
            return {"__invalid__": True}

    # ── Tier 3: no API key, regex found nothing for context_field ────────────
    # Graceful degradation: accept the raw input as the field value so the
    # conversation can still progress (no validation, but no infinite loop).
    if context_field and raw_input and context_field not in regex_updates:
        regex_updates[context_field] = user_message.strip()
    return regex_updates


# ──────────────────────────────────────────────────────────────────────────────
# Next question logic
# ──────────────────────────────────────────────────────────────────────────────

_NEXT_QUESTION_PRIORITY = [
    "state",
    "age",
    "gender",
    "occupation",
    "annual_income",
    "social_category",
    "marital_status",
    "has_bpl",
    "has_disability",
    "num_daughters",
    "land_acres",
    "has_bank_account",
]

_QUESTIONS_EN = {
    "state": "Which state do you live in? (Default is Madhya Pradesh if you're not sure.)",
    "age": "How old are you?",
    "gender": "Are you male or female?",
    "occupation": "What is your main occupation? For example: farmer, student, daily-wage worker, homemaker, self-employed, unemployed?",
    "annual_income": "What is your family's total annual income? (Approximate amount in rupees is fine.)",
    "social_category": "What is your social category? General, OBC, SC, or ST?",
    "marital_status": "Are you married, unmarried, widowed, or divorced?",
    "has_bpl": "Do you have a BPL (Below Poverty Line) ration card? (Yes/No)",
    "has_disability": "Do you have any disability? (Yes/No)",
    "num_daughters": "How many daughters do you have?",
    "land_acres": "How many acres of agricultural land do you own? (Enter 0 if none.)",
    "has_bank_account": "Do you have a bank account? (Yes/No)",
}

_QUESTIONS_HI = {
    "state": "आप किस राज्य में रहते हैं? (अगर आप निश्चित नहीं हैं तो मध्य प्रदेश डिफ़ॉल्ट है।)",
    "age": "आपकी उम्र क्या है?",
    "gender": "आप पुरुष हैं या महिला?",
    "occupation": "आपका मुख्य व्यवसाय क्या है? जैसे: किसान, छात्र, दिहाड़ी मजदूर, गृहिणी, स्व-रोजगार, बेरोजगार?",
    "annual_income": "आपके परिवार की कुल वार्षिक आय कितनी है? (लगभग राशि रुपये में बताएं।)",
    "social_category": "आप किस सामाजिक श्रेणी से हैं? सामान्य, ओबीसी, एससी, या एसटी?",
    "marital_status": "आप विवाहित हैं, अविवाहित, विधवा/विधुर, या तलाकशुदा?",
    "has_bpl": "क्या आपके पास BPL (गरीबी रेखा से नीचे) राशन कार्ड है? (हाँ/नहीं)",
    "has_disability": "क्या आपको कोई विकलांगता है? (हाँ/नहीं)",
    "num_daughters": "आपकी कितनी बेटियाँ हैं?",
    "land_acres": "आपके पास कितने एकड़ कृषि भूमि है? (अगर कोई नहीं तो 0 लिखें।)",
    "has_bank_account": "क्या आपके पास बैंक खाता है? (हाँ/नहीं)",
}


def decide_next_question(
    profile: dict, language: str = "English"
) -> tuple[str | None, str | None]:
    """
    Returns (question_text, field_key) for the next most useful question,
    or (None, None) if the profile is sufficiently complete.
    """
    questions = _QUESTIONS_HI if language == "Hindi" else _QUESTIONS_EN
    occ = _norm_str(profile.get("occupation"))

    for field in _NEXT_QUESTION_PRIORITY:
        val = profile.get(field)
        is_missing = val is None or (isinstance(val, str) and val.strip() == "")

        if not is_missing:
            continue

        # Skip land_acres unless occupation is farmer
        if field == "land_acres":
            if occ and occ not in ("farmer", "agricultural labourer"):
                continue

        # Skip num_daughters unless gender is female
        if field == "num_daughters":
            gender = _norm_str(profile.get("gender"))
            if gender and gender != "female":
                continue

        return questions.get(field), field

    return None, None  # Profile is sufficiently complete


def _norm_str(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).strip().lower()
    return s if s else None


# ──────────────────────────────────────────────────────────────────────────────
# Matching
# ──────────────────────────────────────────────────────────────────────────────

def run_match(profile: dict) -> dict:
    """Run the eligibility engine and return categorised results."""
    schemes = load_schemes()
    return match_schemes(profile, schemes)


# ──────────────────────────────────────────────────────────────────────────────
# Result formatting
# ──────────────────────────────────────────────────────────────────────────────

def _scheme_display_name(scheme: dict, language: str) -> str:
    if language == "Hindi" and scheme.get("name_hi"):
        return f"{scheme['name']} ({scheme['name_hi']})"
    return scheme["name"]


def format_match_results(results: dict, profile: dict, language: str = "English") -> str:
    """
    Convert match results into a markdown string for display.
    The LLM is NOT used here; this is pure formatting.
    """
    eligible = results.get("eligible", [])
    possibly = results.get("possibly_eligible", [])

    if not eligible and not possibly:
        if language == "Hindi":
            return (
                "दुर्भाग्य से, आपके प्रोफ़ाइल के अनुसार अभी कोई योजना नहीं मिली। "
                "कृपया अधिक जानकारी के लिए **myScheme.gov.in** देखें।"
            )
        return (
            "Unfortunately, no schemes were found matching your profile at this time. "
            "Please visit **myScheme.gov.in** for more options."
        )

    lines = []

    if eligible:
        if language == "Hindi":
            lines.append(f"## ✅ आप इन {len(eligible)} योजनाओं के लिए पात्र हैं\n")
        else:
            lines.append(f"## ✅ You are eligible for {len(eligible)} scheme(s)\n")

        for item in eligible:
            s = item["scheme"]
            name = _scheme_display_name(s, language)
            lines.append(f"### {name}")
            lines.append(f"**{s.get('description', '')}**\n")
            lines.append(f"**Benefit:** {s.get('benefit', 'To be verified')}\n")
            if item["reasons"]:
                if language == "Hindi":
                    lines.append("**आप क्यों योग्य हैं:**")
                else:
                    lines.append("**Why you qualify:**")
                for r in item["reasons"]:
                    lines.append(f"- {r}")
            lines.append("")
            docs = s.get("documents", [])
            if docs:
                if language == "Hindi":
                    lines.append("**आवश्यक दस्तावेज़:**")
                else:
                    lines.append("**Documents required:**")
                for d in docs:
                    lines.append(f"- {d}")
            lines.append("")
            if language == "Hindi":
                lines.append(f"**कैसे आवेदन करें:** {s.get('how_to_apply', '')}")
                lines.append(f"**आधिकारिक लिंक:** {s.get('official_link', '')}")
            else:
                lines.append(f"**How to apply:** {s.get('how_to_apply', '')}")
                lines.append(f"**Official link:** {s.get('official_link', '')}")
            lines.append("\n---\n")

    if possibly:
        if language == "Hindi":
            lines.append(
                f"\n## 🔍 संभावित रूप से पात्र — अधिक जानकारी आवश्यक ({len(possibly)} योजनाएं)\n"
            )
        else:
            lines.append(
                f"\n## 🔍 Possibly eligible — need more information ({len(possibly)} scheme(s))\n"
            )

        for item in possibly:
            s = item["scheme"]
            name = _scheme_display_name(s, language)
            lines.append(f"### {name}")
            lines.append(f"{s.get('description', '')}\n")
            lines.append(f"**Benefit:** {s.get('benefit', 'To be verified')}\n")
            if item["missing"]:
                if language == "Hindi":
                    lines.append("**जानकारी जो अभी भी चाहिए:**")
                    field_labels_hi = {
                        "age": "आयु", "gender": "लिंग", "state": "राज्य",
                        "occupation": "व्यवसाय", "annual_income": "वार्षिक आय",
                        "social_category": "सामाजिक श्रेणी", "marital_status": "वैवाहिक स्थिति",
                        "land_acres": "भूमि (एकड़)", "has_bpl": "बीपीएल कार्ड",
                        "has_disability": "विकलांगता", "num_daughters": "बेटियों की संख्या",
                        "has_bank_account": "बैंक खाता",
                    }
                    for f in item["missing"]:
                        lines.append(f"- {field_labels_hi.get(f, f)}")
                else:
                    lines.append("**Still need to know:**")
                    for f in item["missing"]:
                        lines.append(f"- {f.replace('_', ' ').title()}")
            lines.append("\n---\n")

    return "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# Follow-up Q&A
# ──────────────────────────────────────────────────────────────────────────────

def answer_followup(
    question: str,
    profile: dict,
    results: dict,
    language: str = "English",
    conversation_history: list[dict] | None = None,
) -> str:
    """
    Answer a follow-up question about schemes using only the scheme data.
    """
    schemes = load_schemes()
    # Compact scheme data for context (omit verbose fields)
    scheme_summaries = []
    for s in schemes:
        scheme_summaries.append({
            "id": s["id"],
            "name": s["name"],
            "name_hi": s.get("name_hi", ""),
            "benefit": s.get("benefit", ""),
            "documents": s.get("documents", []),
            "how_to_apply": s.get("how_to_apply", ""),
            "official_link": s.get("official_link", ""),
            "eligibility_notes": s.get("eligibility", {}).get("notes", ""),
        })

    system = get_system_prompt(language)
    context = (
        f"Scheme database (JSON):\n{json.dumps(scheme_summaries, ensure_ascii=False, indent=2)}\n\n"
        f"User profile: {json.dumps(profile, ensure_ascii=False)}\n\n"
        "Answer the user's question using ONLY the information above. "
        "If you cannot find the answer in the scheme data, say so and direct to myScheme.gov.in."
    )

    messages = list(conversation_history or [])
    messages.append({"role": "user", "content": question})

    return chat_completion(
        messages=messages,
        system_prompt=system + "\n\n" + context,
        temperature=0.2,
        max_tokens=800,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Greeting
# ──────────────────────────────────────────────────────────────────────────────

GREETING_EN = (
    "Namaste! 🙏 I am the **Scheme Finder** — here to help you find government "
    "welfare schemes you may be eligible for.\n\n"
    "I will ask you a few simple questions to understand your situation. "
    "Based on your answers, I will match you with the best schemes for you.\n\n"
    "**Important:** Please do NOT share your Aadhaar number, bank account number, "
    "or phone number with me. I don't need them.\n\n"
    "Would you like to continue in **English** or **Hindi (हिंदी)**?"
)

GREETING_HI = (
    "नमस्ते! 🙏 मैं **Scheme Finder** हूँ — आपको सरकारी कल्याण योजनाएं खोजने में मदद करने के लिए।\n\n"
    "मैं आपसे कुछ सरल प्रश्न पूछूँगा। आपके उत्तरों के आधार पर, मैं आपके लिए सबसे अच्छी योजनाएं ढूंढूँगा।\n\n"
    "**महत्वपूर्ण:** कृपया अपना आधार नंबर, बैंक खाता नंबर या फ़ोन नंबर मेरे साथ साझा न करें।\n\n"
    "क्या आप **Hindi** या **English** में जारी रखना चाहेंगे?"
)
