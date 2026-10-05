"""
tests/test_e2e_validation.py
────────────────────────────────────────────────────────────────────────────────
End-to-end tests covering:

  1. LLM / Groq connectivity  — a real API call succeeds
  2. Field validation via Groq — invalid inputs are REJECTED (not stored),
                                  valid inputs are ACCEPTED (stored correctly)
  3. Profile accumulation      — only validated fields accumulate; a wrong
                                  answer at step N leaves steps 1…N-1 intact
  4. Regex fast-path           — known-good values bypass Groq entirely
  5. extract_profile_updates   — the full three-tier pipeline

Run with:  pytest tests/test_e2e_validation.py -v
Requires:  LLM_API_KEY set in .env  (skips Groq-dependent tests if missing)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv

# ── path setup ────────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv()

from agent import (
    _llm_validate_field,
    _regex_extract,
    extract_profile_updates,
    decide_next_question,
)

HAS_API_KEY = bool(os.getenv("LLM_API_KEY", "").strip())
needs_groq = pytest.mark.skipif(not HAS_API_KEY, reason="LLM_API_KEY not set")

# ══════════════════════════════════════════════════════════════════════════════
# 1. LLM / Groq connectivity
# ══════════════════════════════════════════════════════════════════════════════

@needs_groq
def test_groq_connectivity():
    """A minimal Groq call succeeds and returns non-empty text."""
    from llm import chat_completion
    result = chat_completion(
        messages=[{"role": "user", "content": "Reply with the single word: OK"}],
        system_prompt="",
        temperature=0.0,
        max_tokens=10,
    )
    assert isinstance(result, str)
    assert len(result.strip()) > 0, "Groq returned empty response"
    print(f"\n  ✅ Groq response: {result!r}")


# ══════════════════════════════════════════════════════════════════════════════
# 2. _llm_validate_field — invalid inputs REJECTED
# ══════════════════════════════════════════════════════════════════════════════

@needs_groq
class TestGroqRejectsInvalidInputs:
    """Every field: garbage / foreign / nonsense input must return (False, None)."""

    def test_state_nepal_rejected(self):
        valid, canonical = _llm_validate_field("state", "Nepal")
        assert valid is False, f"Nepal should be INVALID for state, got canonical={canonical}"

    def test_state_usa_rejected(self):
        valid, _ = _llm_validate_field("state", "California")
        assert valid is False

    def test_state_gibberish_rejected(self):
        valid, _ = _llm_validate_field("state", "xkqzpw")
        assert valid is False

    def test_gender_nonsense_rejected(self):
        valid, _ = _llm_validate_field("gender", "helicopter")
        assert valid is False

    def test_social_category_invalid_rejected(self):
        valid, _ = _llm_validate_field("social_category", "brahmin")
        assert valid is False

    def test_marital_status_invalid_rejected(self):
        valid, _ = _llm_validate_field("marital_status", "complicated")
        assert valid is False

    def test_age_string_rejected(self):
        valid, _ = _llm_validate_field("age", "old")
        assert valid is False

    def test_age_out_of_range_rejected(self):
        valid, _ = _llm_validate_field("age", "200")
        assert valid is False

    def test_income_nonsense_rejected(self):
        valid, _ = _llm_validate_field("annual_income", "lots")
        assert valid is False

    def test_occupation_nonsense_rejected(self):
        valid, _ = _llm_validate_field("occupation", "asdfghjkl")
        assert valid is False


# ══════════════════════════════════════════════════════════════════════════════
# 3. _llm_validate_field — valid inputs ACCEPTED with correct canonical form
# ══════════════════════════════════════════════════════════════════════════════

@needs_groq
class TestGroqAcceptsValidInputs:
    """Every field: correct real-world values must be accepted."""

    def test_state_rajasthan_accepted(self):
        valid, canonical = _llm_validate_field("state", "Rajasthan")
        assert valid is True, "Rajasthan should be VALID"
        assert canonical  # non-empty

    def test_state_delhi_accepted(self):
        valid, canonical = _llm_validate_field("state", "Delhi")
        assert valid is True

    def test_state_tamil_nadu_accepted(self):
        valid, canonical = _llm_validate_field("state", "Tamil Nadu")
        assert valid is True

    def test_gender_male_accepted(self):
        valid, canonical = _llm_validate_field("gender", "male")
        assert valid is True
        assert canonical == "male"

    def test_gender_female_accepted(self):
        valid, canonical = _llm_validate_field("gender", "female")
        assert valid is True
        assert canonical == "female"

    def test_social_category_obc_accepted(self):
        valid, canonical = _llm_validate_field("social_category", "OBC")
        assert valid is True

    def test_social_category_sc_accepted(self):
        valid, canonical = _llm_validate_field("social_category", "SC")
        assert valid is True

    def test_marital_married_accepted(self):
        valid, canonical = _llm_validate_field("marital_status", "married")
        assert valid is True
        assert canonical == "married"

    def test_marital_widow_accepted(self):
        valid, canonical = _llm_validate_field("marital_status", "widow")
        assert valid is True

    def test_age_valid_accepted(self):
        valid, canonical = _llm_validate_field("age", "35")
        assert valid is True
        assert canonical == 35

    def test_income_valid_accepted(self):
        valid, canonical = _llm_validate_field("annual_income", "120000")
        assert valid is True
        assert canonical == 120000

    def test_occupation_farmer_accepted(self):
        valid, canonical = _llm_validate_field("occupation", "farmer")
        assert valid is True

    def test_occupation_uncommon_accepted(self):
        """An uncommon but real occupation should also be accepted."""
        valid, canonical = _llm_validate_field("occupation", "electrician")
        assert valid is True


# ══════════════════════════════════════════════════════════════════════════════
# 4. extract_profile_updates — profile only stores validated fields
# ══════════════════════════════════════════════════════════════════════════════

@needs_groq
class TestProfileStorageCorrectness:
    """
    Simulate a user filling the form step by step.
    Wrong values must NOT enter the profile.
    Right values must accumulate correctly.
    """

    def test_wrong_state_not_stored(self):
        """User types 'Nepal' for state → profile stays empty."""
        updates = extract_profile_updates("Nepal", {}, context_field="state")
        assert updates.get("__invalid__") is True, (
            f"Expected __invalid__=True for 'Nepal', got {updates}"
        )
        # Simulate what app.py does: if __invalid__, don't update profile
        profile = {}
        if not updates.get("__invalid__"):
            profile.update(updates)
        assert "state" not in profile

    def test_correct_state_stored(self):
        """User types 'Rajasthan' for state → profile gets state='Rajasthan'."""
        updates = extract_profile_updates("Rajasthan", {}, context_field="state")
        assert not updates.get("__invalid__"), f"Rajasthan should be valid, got {updates}"
        assert "state" in updates
        profile = {}
        profile.update(updates)
        assert profile["state"]  # non-empty

    def test_wrong_then_right_state(self):
        """Nepal (wrong) → profile empty. Then Rajasthan (right) → profile has state."""
        profile = {}

        # Step 1: wrong answer
        u1 = extract_profile_updates("Nepal", profile, context_field="state")
        assert u1.get("__invalid__") is True
        if not u1.get("__invalid__"):
            profile.update(u1)
        assert "state" not in profile

        # Step 2: correct answer
        u2 = extract_profile_updates("Rajasthan", profile, context_field="state")
        assert not u2.get("__invalid__"), f"Rajasthan should be valid, got {u2}"
        if not u2.get("__invalid__"):
            profile.update(u2)
        assert profile.get("state")

    def test_partial_profile_preserved_on_wrong_answer(self):
        """
        User filled state + age correctly, then gives a wrong gender.
        state and age must still be in the profile after the bad gender answer.
        """
        profile = {"state": "Rajasthan", "age": 30}

        bad = extract_profile_updates("helicopter", profile, context_field="gender")
        assert bad.get("__invalid__") is True
        if not bad.get("__invalid__"):
            profile.update(bad)

        # state and age must be untouched
        assert profile["state"] == "Rajasthan"
        assert profile["age"] == 30
        assert "gender" not in profile

    def test_full_happy_path_accumulation(self):
        """
        Fill state → age → gender correctly, one field at a time.
        At each step only that field is added; previous fields are preserved.
        """
        profile = {}

        # state
        u = extract_profile_updates("Madhya Pradesh", profile, context_field="state")
        assert not u.get("__invalid__")
        profile.update(u)
        assert "state" in profile

        # age — regex handles this, no Groq needed
        u = extract_profile_updates("35", profile, context_field="age")
        assert not u.get("__invalid__")
        profile.update(u)
        assert profile.get("age") == 35
        assert "state" in profile  # still present

        # gender — regex handles "male" directly
        u = extract_profile_updates("male", profile, context_field="gender")
        assert not u.get("__invalid__")
        profile.update(u)
        assert profile.get("gender") == "male"
        assert profile.get("age") == 35
        assert "state" in profile


# ══════════════════════════════════════════════════════════════════════════════
# 5. Regex fast-path (no API needed) — known values handled without Groq
# ══════════════════════════════════════════════════════════════════════════════

class TestRegexFastPath:
    """These should pass even without an API key (Tier 1 regex only)."""

    def test_known_state_extracted(self):
        result = _regex_extract("Madhya Pradesh", context_field="state")
        assert result.get("state") == "Madhya Pradesh"

    def test_mp_abbreviation_normalised(self):
        result = _regex_extract("MP", context_field="state")
        assert result.get("state") == "Madhya Pradesh"

    def test_up_abbreviation_normalised(self):
        result = _regex_extract("UP", context_field="state")
        assert result.get("state") == "Uttar Pradesh"

    def test_age_bare_number(self):
        result = _regex_extract("35", context_field="age")
        assert result.get("age") == 35

    def test_age_out_of_range_not_extracted(self):
        result = _regex_extract("200", context_field="age")
        assert "age" not in result

    def test_gender_male(self):
        result = _regex_extract("male", context_field="gender")
        assert result.get("gender") == "male"

    def test_gender_female(self):
        result = _regex_extract("female", context_field="gender")
        assert result.get("gender") == "female"

    def test_social_category_obc(self):
        result = _regex_extract("OBC", context_field="social_category")
        assert result.get("social_category") == "OBC"

    def test_social_category_sc(self):
        result = _regex_extract("sc", context_field="social_category")
        assert result.get("social_category") == "SC"

    def test_marital_married(self):
        result = _regex_extract("married", context_field="marital_status")
        assert result.get("marital_status") == "married"

    def test_marital_widow(self):
        result = _regex_extract("widowed", context_field="marital_status")
        assert result.get("marital_status") == "widow"

    def test_income_bare_number(self):
        result = _regex_extract("80000", context_field="annual_income")
        assert result.get("annual_income") == 80000

    def test_income_lakh(self):
        result = _regex_extract("1.5 lakh", context_field="annual_income")
        assert result.get("annual_income") == 150000

    def test_occupation_farmer(self):
        result = _regex_extract("farmer", context_field="occupation")
        assert result.get("occupation") == "farmer"

    def test_nepal_not_extracted_as_state(self):
        """'Nepal' must not match any Indian state in the regex."""
        result = _regex_extract("Nepal", context_field="state")
        assert "state" not in result, f"Nepal should not be extracted as a state, got {result}"

    def test_unknown_state_not_extracted(self):
        """A foreign country must not be extracted."""
        result = _regex_extract("Germany", context_field="state")
        assert "state" not in result


# ══════════════════════════════════════════════════════════════════════════════
# 6. decide_next_question — correct field ordering
# ══════════════════════════════════════════════════════════════════════════════

class TestDecideNextQuestion:
    def test_empty_profile_asks_state_first(self):
        _, field = decide_next_question({})
        assert field == "state"

    def test_after_state_asks_age(self):
        _, field = decide_next_question({"state": "Rajasthan"})
        assert field == "age"

    def test_after_state_age_asks_gender(self):
        _, field = decide_next_question({"state": "Rajasthan", "age": 30})
        assert field == "gender"

    def test_land_acres_skipped_for_non_farmer(self):
        profile = {
            "state": "Rajasthan", "age": 30, "gender": "male",
            "occupation": "student", "annual_income": 100000,
            "social_category": "General", "marital_status": "unmarried",
            "has_bpl": False, "has_disability": False,
            "num_daughters": 0, "has_bank_account": True,
        }
        q, field = decide_next_question(profile)
        # land_acres should be skipped for a student
        assert field != "land_acres", "land_acres should not be asked for non-farmer"

    def test_complete_profile_returns_none(self):
        profile = {
            "state": "Rajasthan", "age": 30, "gender": "male",
            "occupation": "student", "annual_income": 100000,
            "social_category": "General", "marital_status": "unmarried",
            "has_bpl": False, "has_disability": False,
            "num_daughters": 0, "has_bank_account": True,
        }
        q, field = decide_next_question(profile)
        assert field is None
        assert q is None
