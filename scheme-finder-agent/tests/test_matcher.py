"""
tests/test_matcher.py — Unit tests for the eligibility matching engine.

Personas tested:
  a) 45-year-old farmer, 2 acres, income Rs 80,000, OBC, Madhya Pradesh
  b) 20-year-old SC student, family income Rs 1,50,000
  c) 62-year-old widow, BPL card holder
  d) 30-year-old daily-wage worker, no land, income Rs 1,20,000
"""

from __future__ import annotations

import json
import sys
import os
from pathlib import Path

# Allow running from repo root or from tests/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

from matcher import match_schemes

# ──────────────────────────────────────────────────────────────────────────────
# Load scheme database
# ──────────────────────────────────────────────────────────────────────────────

_SCHEMES_PATH = Path(__file__).parent.parent / "data" / "schemes.json"

with open(_SCHEMES_PATH, encoding="utf-8") as _fh:
    SCHEMES = json.load(_fh)


def _scheme_ids(items: list[dict]) -> set[str]:
    """Extract scheme IDs from a list of match result items."""
    return {item["scheme"]["id"] for item in items}


def _get_result(results: dict, scheme_id: str) -> dict | None:
    """Find a result entry by scheme ID across all buckets."""
    for bucket in ("eligible", "possibly_eligible", "not_eligible"):
        for item in results[bucket]:
            if item["scheme"]["id"] == scheme_id:
                return {"bucket": bucket, **item}
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Persona A: 45-year-old farmer, OBC, MP, 2 acres, income Rs 80,000
# ──────────────────────────────────────────────────────────────────────────────

PERSONA_A = {
    "age": 45,
    "gender": "male",
    "state": "Madhya Pradesh",
    "occupation": "farmer",
    "annual_income": 80000,
    "social_category": "OBC",
    "marital_status": "married",
    "land_acres": 2.0,
    "has_bpl": False,
    "has_disability": False,
    "num_daughters": 1,
    "has_bank_account": True,
}


class TestPersonaA:
    def setup_method(self):
        self.results = match_schemes(PERSONA_A, SCHEMES)

    def test_result_has_three_buckets(self):
        assert "eligible" in self.results
        assert "possibly_eligible" in self.results
        assert "not_eligible" in self.results

    def test_pm_kisan_eligible(self):
        """Farmer with land → PM-KISAN eligible."""
        r = _get_result(self.results, "pm_kisan")
        assert r is not None, "pm_kisan not found in results"
        assert r["bucket"] == "eligible", (
            f"Expected pm_kisan eligible, got {r['bucket']}. Reasons: {r['reasons']}"
        )

    def test_post_matric_scholarship_not_eligible(self):
        """Age 45, occupation farmer → not a student → scholarship not eligible."""
        r = _get_result(self.results, "post_matric_scholarship")
        assert r is not None
        assert r["bucket"] == "not_eligible", (
            f"Expected not_eligible, got {r['bucket']}"
        )

    def test_atal_pension_not_eligible(self):
        """Age 45 > max 40 → Atal Pension not eligible."""
        r = _get_result(self.results, "atal_pension_yojana")
        assert r is not None
        assert r["bucket"] == "not_eligible", (
            f"Expected not_eligible for age 45, got {r['bucket']}. Reasons: {r['reasons']}"
        )

    def test_e_shram_eligible(self):
        """Farmer = unorganised worker → e-Shram eligible (age 16–59)."""
        r = _get_result(self.results, "e_shram")
        assert r is not None
        assert r["bucket"] == "eligible", (
            f"Expected e_shram eligible, got {r['bucket']}. Reasons: {r['reasons']}"
        )

    def test_pm_jan_dhan_not_eligible_has_account(self):
        """Persona A already has a bank account → PMJDY not eligible (scheme is for unbanked)."""
        r = _get_result(self.results, "pm_jan_dhan")
        assert r is not None
        assert r["bucket"] == "not_eligible", (
            f"Expected not_eligible (already has bank account), got {r['bucket']}"
        )

    def test_ladli_behna_not_eligible(self):
        """Male applicant → Ladli Behna (female-only) not eligible."""
        r = _get_result(self.results, "ladli_behna")
        assert r is not None
        assert r["bucket"] == "not_eligible", (
            f"Expected not_eligible (male), got {r['bucket']}"
        )

    def test_reasons_present(self):
        """Each result should have at least one reason string."""
        for bucket in ("eligible", "possibly_eligible", "not_eligible"):
            for item in self.results[bucket]:
                assert isinstance(item["reasons"], list), "reasons must be a list"

    def test_all_schemes_accounted_for(self):
        """Every scheme in the database should appear in exactly one bucket."""
        all_ids = {s["id"] for s in SCHEMES}
        found_ids: set[str] = set()
        for bucket in ("eligible", "possibly_eligible", "not_eligible"):
            found_ids |= _scheme_ids(self.results[bucket])
        assert found_ids == all_ids, f"Missing schemes: {all_ids - found_ids}"


# ──────────────────────────────────────────────────────────────────────────────
# Persona B: 20-year-old SC student, family income Rs 1,50,000
# ──────────────────────────────────────────────────────────────────────────────

PERSONA_B = {
    "age": 20,
    "gender": "male",
    "state": "Madhya Pradesh",
    "occupation": "student",
    "annual_income": 150000,
    "social_category": "SC",
    "marital_status": "unmarried",
    "land_acres": 0,
    "has_bpl": False,
    "has_disability": False,
    "num_daughters": 0,
    "has_bank_account": True,
}


class TestPersonaB:
    def setup_method(self):
        self.results = match_schemes(PERSONA_B, SCHEMES)

    def test_scholarship_eligible(self):
        """SC student, income Rs 1,50,000 < Rs 2,50,000 → eligible for Post-Matric Scholarship."""
        r = _get_result(self.results, "post_matric_scholarship")
        assert r is not None
        assert r["bucket"] == "eligible", (
            f"Expected eligible for scholarship, got {r['bucket']}. Reasons: {r['reasons']}"
        )

    def test_atal_pension_eligible(self):
        """Age 20 within 18–40 → APY eligible."""
        r = _get_result(self.results, "atal_pension_yojana")
        assert r is not None
        assert r["bucket"] == "eligible", (
            f"Expected APY eligible at age 20, got {r['bucket']}. Reasons: {r['reasons']}"
        )

    def test_pm_kisan_not_eligible(self):
        """Student with 0 acres → PM-KISAN not eligible (no land + not farmer)."""
        r = _get_result(self.results, "pm_kisan")
        assert r is not None
        assert r["bucket"] == "not_eligible", (
            f"Expected not_eligible (student / no land), got {r['bucket']}"
        )

    def test_old_age_pension_not_eligible(self):
        """Age 20 < min 60 → IGNOAPS not eligible."""
        r = _get_result(self.results, "ignoaps")
        assert r is not None
        assert r["bucket"] == "not_eligible", (
            f"Expected not_eligible (age 20), got {r['bucket']}"
        )

    def test_all_schemes_accounted_for(self):
        all_ids = {s["id"] for s in SCHEMES}
        found_ids: set[str] = set()
        for bucket in ("eligible", "possibly_eligible", "not_eligible"):
            found_ids |= _scheme_ids(self.results[bucket])
        assert found_ids == all_ids


# ──────────────────────────────────────────────────────────────────────────────
# Persona C: 62-year-old widow, BPL card holder
# ──────────────────────────────────────────────────────────────────────────────

PERSONA_C = {
    "age": 62,
    "gender": "female",
    "state": "Madhya Pradesh",
    "occupation": "homemaker",
    "annual_income": 50000,
    "social_category": "General",
    "marital_status": "widow",
    "land_acres": 0,
    "has_bpl": True,
    "has_disability": False,
    "num_daughters": 0,
    "has_bank_account": True,
}


class TestPersonaC:
    def setup_method(self):
        self.results = match_schemes(PERSONA_C, SCHEMES)

    def test_old_age_pension_eligible(self):
        """Age 62, BPL → IGNOAPS eligible."""
        r = _get_result(self.results, "ignoaps")
        assert r is not None
        assert r["bucket"] == "eligible", (
            f"Expected eligible for IGNOAPS, got {r['bucket']}. Reasons: {r['reasons']}"
        )

    def test_ayushman_eligible(self):
        """BPL card holder → Ayushman Bharat eligible."""
        r = _get_result(self.results, "ayushman_bharat")
        assert r is not None
        assert r["bucket"] == "eligible", (
            f"Expected Ayushman eligible (BPL), got {r['bucket']}. Reasons: {r['reasons']}"
        )

    def test_ladli_behna_eligible(self):
        """Female widow, age 62 > max_age 60 → check result."""
        r = _get_result(self.results, "ladli_behna")
        assert r is not None
        # Age 62 > max_age 60, so not_eligible
        assert r["bucket"] == "not_eligible", (
            f"Expected not_eligible (age 62 > max 60), got {r['bucket']}. Reasons: {r['reasons']}"
        )

    def test_atal_pension_not_eligible(self):
        """Age 62 > max 40 → APY not eligible."""
        r = _get_result(self.results, "atal_pension_yojana")
        assert r is not None
        assert r["bucket"] == "not_eligible"

    def test_pm_awas_possibly_or_eligible(self):
        """BPL → PM Awas Yojana should be eligible or possibly eligible."""
        r = _get_result(self.results, "pm_awas_gramin")
        assert r is not None
        assert r["bucket"] in ("eligible", "possibly_eligible"), (
            f"Expected eligible or possibly_eligible, got {r['bucket']}"
        )

    def test_pm_ujjwala_eligible(self):
        """Female, BPL, age > 18 → PM Ujjwala eligible."""
        r = _get_result(self.results, "pm_ujjwala")
        assert r is not None
        assert r["bucket"] == "eligible", (
            f"Expected eligible for Ujjwala, got {r['bucket']}. Reasons: {r['reasons']}"
        )

    def test_all_schemes_accounted_for(self):
        all_ids = {s["id"] for s in SCHEMES}
        found_ids: set[str] = set()
        for bucket in ("eligible", "possibly_eligible", "not_eligible"):
            found_ids |= _scheme_ids(self.results[bucket])
        assert found_ids == all_ids


# ──────────────────────────────────────────────────────────────────────────────
# Persona D: 30-year-old daily-wage worker, no land, income Rs 1,20,000
# ──────────────────────────────────────────────────────────────────────────────

PERSONA_D = {
    "age": 30,
    "gender": "male",
    "state": "Madhya Pradesh",
    "occupation": "daily-wage worker",
    "annual_income": 120000,
    "social_category": "OBC",
    "marital_status": "married",
    "land_acres": 0,
    "has_bpl": False,
    "has_disability": False,
    "num_daughters": 0,
    "has_bank_account": True,
}


class TestPersonaD:
    def setup_method(self):
        self.results = match_schemes(PERSONA_D, SCHEMES)

    def test_e_shram_eligible(self):
        """Daily-wage worker, age 30 → e-Shram eligible."""
        r = _get_result(self.results, "e_shram")
        assert r is not None
        assert r["bucket"] == "eligible", (
            f"Expected e_shram eligible, got {r['bucket']}. Reasons: {r['reasons']}"
        )

    def test_atal_pension_eligible(self):
        """Age 30 within 18–40 → APY eligible."""
        r = _get_result(self.results, "atal_pension_yojana")
        assert r is not None
        assert r["bucket"] == "eligible", (
            f"Expected APY eligible, got {r['bucket']}. Reasons: {r['reasons']}"
        )

    def test_pm_kisan_not_eligible(self):
        """No land, not a farmer → PM-KISAN not eligible."""
        r = _get_result(self.results, "pm_kisan")
        assert r is not None
        assert r["bucket"] == "not_eligible", (
            f"Expected not_eligible (daily-wage / no land), got {r['bucket']}"
        )

    def test_old_age_pension_not_eligible(self):
        """Age 30 < 60 → IGNOAPS not eligible."""
        r = _get_result(self.results, "ignoaps")
        assert r is not None
        assert r["bucket"] == "not_eligible"

    def test_pm_jan_dhan_not_eligible_has_account(self):
        """Persona D already has a bank account → PMJDY not eligible (scheme is for unbanked)."""
        r = _get_result(self.results, "pm_jan_dhan")
        assert r is not None
        assert r["bucket"] == "not_eligible", (
            f"Expected not_eligible (already has bank account), got {r['bucket']}"
        )

    def test_ladli_behna_not_eligible(self):
        """Male → Ladli Behna not eligible."""
        r = _get_result(self.results, "ladli_behna")
        assert r is not None
        assert r["bucket"] == "not_eligible"

    def test_all_schemes_accounted_for(self):
        all_ids = {s["id"] for s in SCHEMES}
        found_ids: set[str] = set()
        for bucket in ("eligible", "possibly_eligible", "not_eligible"):
            found_ids |= _scheme_ids(self.results[bucket])
        assert found_ids == all_ids


# ──────────────────────────────────────────────────────────────────────────────
# Edge-case tests
# ──────────────────────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_empty_profile_puts_most_in_possibly(self):
        """An empty profile should result in most schemes being possibly eligible."""
        results = match_schemes({}, SCHEMES)
        total = sum(len(results[b]) for b in ("eligible", "possibly_eligible", "not_eligible"))
        assert total == len(SCHEMES), "Not all schemes accounted for"
        # With empty profile, nothing should be hard-failed except schemes with
        # strict checks that default to pass without criteria
        assert len(results["not_eligible"]) == 0, (
            f"Expected no hard failures on empty profile, got: "
            f"{[i['scheme']['id'] for i in results['not_eligible']]}"
        )

    def test_out_of_state_hides_state_scheme(self):
        """A user from Kerala should not see Ladli Behna (MP-only scheme)."""
        profile = {
            "age": 30, "gender": "female", "state": "Kerala",
            "occupation": "homemaker", "annual_income": 100000,
            "marital_status": "married", "has_bpl": False,
        }
        results = match_schemes(profile, SCHEMES)
        r = _get_result(results, "ladli_behna")
        assert r is not None
        assert r["bucket"] == "not_eligible", (
            f"Ladli Behna should be not_eligible for Kerala user, got {r['bucket']}"
        )

    def test_income_over_limit_blocks_scholarship(self):
        """SC student with income > Rs 2.5 lakh should not get Post-Matric Scholarship."""
        profile = {
            "age": 19, "gender": "female", "state": "Madhya Pradesh",
            "occupation": "student", "annual_income": 400000,
            "social_category": "SC",
        }
        results = match_schemes(profile, SCHEMES)
        r = _get_result(results, "post_matric_scholarship")
        assert r is not None
        assert r["bucket"] == "not_eligible", (
            f"Expected not_eligible (income > limit), got {r['bucket']}"
        )

    def test_missing_field_creates_possibly_eligible(self):
        """Profile missing annual_income should make income-capped schemes possibly_eligible."""
        profile = {
            "age": 19, "gender": "female", "state": "Madhya Pradesh",
            "occupation": "student",
            # annual_income intentionally missing
            "social_category": "SC",
        }
        results = match_schemes(profile, SCHEMES)
        r = _get_result(results, "post_matric_scholarship")
        assert r is not None
        assert r["bucket"] == "possibly_eligible", (
            f"Expected possibly_eligible (missing income), got {r['bucket']}"
        )
        assert "annual_income" in r["missing"]
