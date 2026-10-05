<div align="center">

<img src="https://img.shields.io/badge/UN%20SDG%201-No%20Poverty-e5243b?style=for-the-badge&logo=unitednations&logoColor=white" alt="SDG 1"/>
<img src="https://img.shields.io/badge/Built%20with-Streamlit-FF4B4B?style=for-the-badge&logo=streamlit&logoColor=white" alt="Streamlit"/>
<img src="https://img.shields.io/badge/Python-3.9%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
<img src="https://img.shields.io/badge/LLM-OpenAI%20%7C%20Gemini%20%7C%20Anthropic%20%7C%20Groq-412991?style=for-the-badge&logo=openai&logoColor=white" alt="LLM"/>
<img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License"/>

# 🇮🇳 Scheme Finder Agent

### *AI-powered government welfare scheme discovery for every Indian citizen*

> **"No form. No jargon. Just a conversation — and the schemes you deserve."**

[🚀 Quick Start](#quick-start) · [📸 Screenshots](#screenshots) · [🏗 Architecture](#architecture) · [📚 Scheme Database](#scheme-database) · [⚠️ Limitations](#limitations)

---

</div>

## ✨ What It Does

The **Scheme Finder Agent** is a conversational AI assistant that helps low-income Indian citizens discover which government welfare schemes they qualify for — in plain English or Hindi, with zero paperwork.

```
You chat  →  Agent asks a few smart questions  →  You get matched schemes + how to apply
```

No long forms. No bureaucratic jargon. No hallucinated eligibility rules.

| Feature | Detail |
|---|---|
| 💬 Natural conversation | Chat in English or Hindi |
| 🎯 Rule-based matching | 100% deterministic eligibility engine |
| 📋 12 real schemes | PM-KISAN, Ayushman Bharat, APY, and more |
| 🔒 Privacy-first | Session persisted in URL only — no server storage, no database |
| 🤖 Multi-provider LLM | OpenAI · Gemini · Anthropic · Groq ⚡ |
| ✅ Smart input validation | Regex-first; Groq only for unknown values |

---

<a name="screenshots"></a>

## 📸 Screenshots

### 1 · Welcome Screen — Scheme of the Day + Greeting

> The app opens with a collapsible **Scheme of the Day** card and a warm Namaste greeting. Users are immediately asked for their preferred language — no sign-up, no forms.

![Welcome screen showing Scheme of the Day and Namaste greeting](screenshots/Screenshot%202026-10-05%20201908.png)

---

### 2 · Conversational Profile Collection — State & Age

> The agent collects the user's state and age through natural chat. The **"Your Profile So Far"** sidebar updates live with every confirmed answer.

![Profile collection — language, state and age](screenshots/Screenshot%202026-10-05%20202046.png)

---

### 3 · Profile Collection — Gender, Occupation & Income

> Collection continues through gender, occupation, and income. As soon as enough fields are known the agent announces how many schemes matched.

![Profile collection — gender, occupation and income](screenshots/Screenshot%202026-10-05%20202100.png)

---

### 4 · Matched Schemes — Full Results View

> The full results page: a green **"You are eligible"** banner lists confirmed schemes, and a blue **"need more info"** section shows maybes — all as expandable cards.

![Full results view with eligible and maybe scheme cards](screenshots/Screenshot%202026-10-05%20202110.png)

---

### 5 · Scheme Detail — Documents & Apply

> Expanding any card reveals the full description, **why you qualify**, a documents checklist, how to apply step-by-step, and an **Apply Here** button linking to the official portal.

![Expanded PM Jan Dhan card with documents and Apply Here button](screenshots/Screenshot%202026-10-05%20202204.png)

---


## 🏗 Architecture

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
           │ LLM calls (validation + explanation only)
           ▼
┌──────────────────────┐       ┌────────────────────────────────┐
│       llm.py         │──────►│  OpenAI / Gemini / Anthropic / │
│  provider-agnostic   │       │  Groq  (qwen/qwen3.8-27b)      │
└──────────────────────┘       └────────────────────────────────┘
           │
           ▼
┌──────────────────────┐
│  data/schemes.json   │
│  12 welfare schemes  │
└──────────────────────┘
```

> **Key design principle:** The LLM is used *only* for validating unknown free-text input and explaining results. Eligibility decisions are made entirely by [`matcher.py`](matcher.py) — a transparent, auditable, rule-based engine. **No hallucinated eligibility.**

---

## 📁 Folder Structure

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

<a name="quick-start"></a>

## 🚀 Setup

### 1 · Clone and enter the project

```bash
git clone <repo-url>
cd scheme-finder-agent
```

### 2 · Create a virtual environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

### 3 · Install dependencies

```bash
pip install -r requirements.txt
```

### 4 · Configure your LLM API key

```bash
cp .env.example .env
# Edit .env and set LLM_PROVIDER and LLM_API_KEY
```

Supported providers:

| Provider | `LLM_PROVIDER` value | Default model | Notes |
|---|---|---|---|
| OpenAI | `openai` | `gpt-4o-mini` | Best quality |
| Google Gemini | `gemini` | `gemini-1.5-flash` | Good free tier |
| Anthropic | `anthropic` | `claude-3-haiku-20240307` | Fast + cheap |
| Groq ⚡ | `groq` | `qwen/qwen3.8-27b` | **Recommended** — 3/3 tasks correct, ~0.18s |

> **Groq note:** Available models differ per account. The default `qwen/qwen3.8-27b` was benchmarked against all available models for this project's validation task — it scored 3/3 correct at 0.18s average, outperforming the others. To override, set `LLM_MODEL` in `.env`. To list your account's models, run the command in `.env.example`.

### 5 · Run the app

```bash
streamlit run app.py
```

Open **http://localhost:8501** in your browser.

---

## 🧪 Running the Unit Tests

```bash
# From the scheme-finder-agent directory
python -m pytest tests/ -v
```

Expected output:

```
tests/test_matcher.py::test_farmer_profile       PASSED
tests/test_matcher.py::test_elderly_widow        PASSED
tests/test_matcher.py::test_student_sc           PASSED
tests/test_matcher.py::test_pregnant_woman       PASSED
tests/test_matcher.py::test_no_match_edge_case   PASSED
```

---

## 💬 Sample Conversation

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

<a name="scheme-database"></a>

## 📚 Scheme Database

12 schemes across 6 categories — all grounded in real government data:

| # | Scheme | Category | Key Benefit |
|---|---|---|---|
| 1 | PM-KISAN | 🌾 Agriculture | ₹6,000/year cash transfer |
| 2 | Ayushman Bharat PM-JAY | 🏥 Health | ₹5 lakh/year hospital coverage |
| 3 | Ladli Behna Yojana (MP) | 👩 Women | Monthly financial support |
| 4 | PM Ujjwala Yojana | 👩 Women | Free LPG connection |
| 5 | IGNOAPS (NSAP) | 👴 Pension | Monthly pension for elderly |
| 6 | PM Awas Yojana (Gramin) | 🏠 Housing | Rural housing assistance |
| 7 | Sukanya Samriddhi Yojana | 📖 Education | Savings scheme for girl child |
| 8 | PM Matru Vandana Yojana | 👩 Women | ₹5,000 maternity benefit |
| 9 | Post Matric Scholarship SC/ST/OBC | 📖 Education | Scholarship for higher studies |
| 10 | PM Jan Dhan Yojana | 💳 Financial Inclusion | Zero-balance bank account |
| 11 | Atal Pension Yojana | 👴 Pension | Guaranteed monthly pension |
| 12 | e-Shram Card | 👷 Labour | ₹2 lakh accident insurance |

---

## 🧠 Smart Input Validation — 3-Tier Strategy

When a user answers a question, the agent processes the input through three tiers in order:

```
User types an answer
        │
        ▼
┌─────────────────────────────────────────────────┐
│  TIER 1 — Regex  (instant, zero API cost)       │
│  Matches hardcoded known values per field       │
│  States, common occupations, yes/no, numbers…   │
│  ✅ Match found → store it, done                │
└───────────────────┬─────────────────────────────┘
                    │ No match
                    ▼
┌─────────────────────────────────────────────────┐
│  TIER 2 — Groq validation  (API key required)   │
│  Asks LLM: "Is this a valid {field} value?"     │
│  ✅ Valid  → store LLM-normalised canonical     │
│  ❌ Invalid → re-ask with friendly error msg    │
└───────────────────┬─────────────────────────────┘
                    │ No API key configured
                    ▼
┌─────────────────────────────────────────────────┐
│  TIER 3 — Graceful fallback                     │
│  Accept raw input as-is, conversation continues │
└─────────────────────────────────────────────────┘
```

**Examples:**
| Input | Field | Tier | Result |
|---|---|---|---|
| `farmer` | occupation | Tier 1 ✅ | Stored immediately |
| `Jharkhand` | state | Tier 1 ✅ | Stored immediately |
| `yes` | has_bpl | Tier 1 ✅ | `true` stored |
| `army officer` | occupation | Tier 2 ✅ | Groq validates → stored |
| `Chandigarh` | state | Tier 1 ✅ | UT in hardcoded list |
| `banana123` | state | Tier 2 ❌ | "Please enter a valid state" |
| `!!!` | occupation | Tier 2 ❌ | "Please enter a valid occupation" |

---

## 🔄 How Eligibility Matching Works

```
User Profile                     Scheme Rules
─────────────                    ────────────────────────────
state       ──────────────────►  state_restriction: ["MP", ...]
age         ──────────────────►  min_age / max_age
occupation  ──────────────────►  occupation_includes: ["farmer"]
income      ──────────────────►  max_annual_income: 150000
category    ──────────────────►  categories: ["SC", "ST", "OBC"]
bpl_card    ──────────────────►  bpl_required: true/false
gender      ──────────────────►  gender: "female"
            
                    ▼
           matcher.py evaluates all rules
                    ▼
         ELIGIBLE / NOT_ELIGIBLE / MAYBE
```

Each scheme in [`data/schemes.json`](data/schemes.json) declares its eligibility rules as structured JSON. `matcher.py` evaluates them deterministically — no LLM involved, fully auditable.

---

<a name="limitations"></a>

## ⚠️ Limitations and Things to Verify Manually

> These are known gaps to address before any production deployment.

<details>
<summary><strong>📌 Click to expand — verification checklist</strong></summary>

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

</details>

---

## 🔒 Safety and Privacy

| Safeguard | Implementation |
|---|---|
| 🚫 No sensitive data | App explicitly tells users **not to share** Aadhaar, bank details, or phone numbers |
| 🎯 Grounded answers | LLM system prompt restricts it to answer **only from scheme data** |
| 🌐 Unknown schemes | Agent directs users to **myScheme.gov.in** |
| ⚠️ Disclaimer footer | Shown on every screen |
| 🔄 Session persistence | Chat + profile survive a browser refresh via a URL query param (`?_sfa=`) — no server-side storage, no database, no cookies |

---

## 🌐 SDG 1 Alignment

<div align="center">

| SDG 1 Target | How this project helps |
|---|---|
| **1.3** — Social protection systems | Surfaces pension, health insurance, and housing schemes |
| **1.4** — Access to services | Explains application process in plain language |
| **1.b** — Policy frameworks | Demonstrates tech-enabled outreach for under-served citizens |

</div>

---

## 📄 License

This project is provided for educational and public-interest purposes under the **MIT License**.

---

<div align="center">

Made with ❤️ for India's citizens · Powered by AI · Grounded in real government data

*If this project helped you, please ⭐ the repo!*

</div>
