# Scheme Finder Agent 🇮🇳

> **UN SDG 1 — No Poverty** | AI-powered government welfare scheme discovery for low-income Indian citizens.

---

## Overview

The Scheme Finder Agent is a conversational AI assistant that helps citizens discover which Indian government welfare schemes they are eligible for. Users chat in plain English or Hindi, and the agent:

1. Collects a user profile through natural conversation (no long forms).
2. Uses a deterministic, rule-based engine to match the profile against 12 real schemes.
3. Explains eligibility, benefits, required documents, and how to apply — grounded only in the scheme database.

---

## SDG 1 Alignment

| SDG 1 Target | How this project helps |
|---|---|
| 1.3 — Social protection systems | Surfaces pension, health insurance, and housing schemes |
| 1.4 — Access to services | Explains application process in plain language |
| 1.b — Policy frameworks | Demonstrates tech-enabled outreach for under-served citizens |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        app.py  (Streamlit UI)                   │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │  Chat panel  │  │  Profile sidebar  │  │  Scheme cards   │   │
│  └──────┬───────┘  └──────────────────┘  └────────┬────────┘   │
└─────────┼──────────────────────────────────────────┼────────────┘
          │ user message                              │ match results
          ▼                                           │
┌─────────────────────┐                    ┌──────────┴──────────┐
│     agent.py        │◄──── profile ──────│    matcher.py       │
│  - extract_profile  │                    │  - match_schemes()  │
│  - decide_next_q    │────── schemes ────►│  - pure Python      │
│  - format_results   │                    │  - deterministic    │
│  - answer_followup  │                    └─────────────────────┘
└──────────┬──────────┘
           │ LLM calls (NLU + explanation only)
           ▼
┌──────────────────────┐       ┌──────────────────────┐
│       llm.py         │──────►│  OpenAI / Gemini /    │
│  provider-agnostic   │       │  Anthropic API        │
└──────────────────────┘       └──────────────────────┘
           │
           ▼
┌──────────────────────┐
│  data/schemes.json   │
│  12 welfare schemes  │
└──────────────────────┘
```

**Key design principle:** The LLM is used *only* for natural language understanding (extracting profile fields from free text) and explanation. Eligibility decisions are made entirely by `matcher.py` — a transparent, auditable, rule-based engine.

---

## Folder Structure

```
scheme-finder-agent/
├── app.py                  # Streamlit UI — chat interface and scheme cards
├── agent.py                # Orchestration: profile extraction, Q&A, formatting
├── matcher.py              # Rule-based eligibility engine
├── llm.py                  # Provider-agnostic LLM wrapper
├── data/
│   └── schemes.json        # 12 government schemes database
├── tests/
│   └── test_matcher.py     # Unit tests for 4 personas + edge cases
├── .env.example            # Configuration template
├── requirements.txt
└── README.md
```

---

## Setup

### 1. Clone and enter the project

```bash
git clone <repo-url>
cd scheme-finder-agent
```

### 2. Create a virtual environment

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure your LLM API key

```bash
cp .env.example .env
# Edit .env and set LLM_PROVIDER and LLM_API_KEY
```

Supported providers:

| Provider | `LLM_PROVIDER` value | Default model |
|---|---|---|
| OpenAI | `openai` | `gpt-4o-mini` |
| Google Gemini | `gemini` | `gemini-1.5-flash` |
| Anthropic | `anthropic` | `claude-3-haiku-20240307` |

### 5. Run the app

```bash
streamlit run app.py
```

Open http://localhost:8501 in your browser.

---

## Running the Unit Tests

```bash
# From the scheme-finder-agent directory
python -m pytest tests/ -v
```

---

## Sample Conversation

```
Agent: Namaste! 🙏 I am the Scheme Finder — here to help you find government
       welfare schemes you may be eligible for.
       Would you like to continue in English or Hindi?

User:  English please

Agent: Which state do you live in?

User:  Madhya Pradesh

Agent: How old are you?

User:  I am 45 years old

Agent: What is your main occupation? farmer, student, daily-wage worker…?

User:  I am a farmer

Agent: What is your family's total annual income?

User:  Around 80 thousand rupees

Agent: What is your social category? General, OBC, SC, or ST?

User:  OBC

Agent: Do you have a BPL ration card?

User:  No

Agent: I found 4 scheme(s) you are eligible for, and 3 more where a little
       more info is needed.

       [Shows expandable cards for PM-KISAN, e-Shram, PM Jan Dhan, APY…]

User:  What documents do I need for PM-KISAN?

Agent: For PM-KISAN you will need:
       • Aadhaar card
       • Land ownership documents (Khasra / Khatauni)
       • Bank account passbook
       • Mobile number linked to Aadhaar
       You can apply at pmkisan.gov.in or your nearest CSC.
```

---

## Scheme Database

12 schemes are included (all marked `"verified": false`):

| # | Scheme | Category |
|---|---|---|
| 1 | PM-KISAN | Agriculture |
| 2 | Ayushman Bharat PM-JAY | Health |
| 3 | Ladli Behna Yojana (MP) | Women |
| 4 | PM Ujjwala Yojana | Women |
| 5 | IGNOAPS (NSAP) | Pension |
| 6 | PM Awas Yojana (Gramin) | Housing |
| 7 | Sukanya Samriddhi Yojana | Education |
| 8 | PM Matru Vandana Yojana | Women |
| 9 | Post Matric Scholarship SC/ST/OBC | Education |
| 10 | PM Jan Dhan Yojana | Financial Inclusion |
| 11 | Atal Pension Yojana | Pension |
| 12 | e-Shram Card | Labour |

---

## Limitations and Things to Verify Manually

### ⚠️ Must verify before use in production

1. **Benefit amounts** — Several amounts are marked "To be verified" in `schemes.json`. Confirm against official portals:
   - IGNOAPS pension: central share is Rs 200–500/month; state top-ups vary widely.
   - Ladli Behna amount (MP Government may have updated it).
   - PM Awas Yojana unit cost (may differ for hilly areas).
   - APY contribution table and income-tax exclusion rule.

2. **Income limits** — Verify exact income ceilings for:
   - Post-Matric Scholarship (OBC limit differs from SC/ST).
   - Ladli Behna (family income + land cap).
   - PMJDY overdraft eligibility criteria.

3. **SECC 2011 linkage** — PM Awas Yojana (Gramin) and Ayushman Bharat use SECC 2011 data for beneficiary selection, which is not fully modelled here.

4. **State variations** — Many central schemes have state-specific top-ups or additional criteria. The matcher uses central eligibility rules only.

5. **PMMVY second-child rule** — The Rs 6,000 for second girl-child benefit was introduced under Mission Shakti; verify current rules.

6. **e-Shram income-tax exclusion** — Verify whether income-tax payers are explicitly excluded.

7. **Sukanya Samriddhi interest rate** — Rate is revised quarterly by the government; update the benefit field regularly.

---

## Safety and Privacy

- The app explicitly tells users **not to share** Aadhaar numbers, bank details, or phone numbers.
- The LLM is given a system prompt restricting it to answer **only from scheme data**.
- If asked about an unknown scheme, the agent directs users to **myScheme.gov.in**.
- A footer disclaimer is shown on every screen.
- No data is persisted beyond the Streamlit session.

---

## License

This project is provided for educational and public-interest purposes under the MIT License.
