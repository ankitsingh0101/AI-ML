"""
app.py — Streamlit UI for the Scheme Finder Agent.

Run with:  streamlit run app.py
"""

from __future__ import annotations

import json

import streamlit as st
from dotenv import load_dotenv

import agent as ag
from matcher import match_schemes

load_dotenv()

# ──────────────────────────────────────────────────────────────────────────────
# Page config
# ──────────────────────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="Scheme Finder — SDG 1: No Poverty",
    page_icon="🇮🇳",
    layout="centered",
    initial_sidebar_state="expanded",
)

# ──────────────────────────────────────────────────────────────────────────────
# Session state initialisation
# ──────────────────────────────────────────────────────────────────────────────

def _init_state() -> None:
    defaults: dict = {
        "language": "English",
        "profile": {},
        "messages": [],          # {"role": "user"|"assistant", "content": str}
        "match_results": None,
        "greeted": False,
        "profile_complete": False,
        "schemes": ag.load_schemes(),
        "scheme_of_day_shown": False,
        "last_asked_field": None,   # field key of the last question asked
    }
    for key, val in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = val


_init_state()


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _add_message(role: str, content: str) -> None:
    st.session_state.messages.append({"role": role, "content": content})


def _reset() -> None:
    for key in ["profile", "messages", "match_results", "greeted",
                "profile_complete", "scheme_of_day_shown", "last_asked_field"]:
        if key in st.session_state:
            del st.session_state[key]
    _init_state()


def _profile_label(field: str, language: str) -> str:
    labels_en = {
        "age": "Age", "gender": "Gender", "state": "State",
        "occupation": "Occupation", "annual_income": "Annual Income (₹)",
        "social_category": "Social Category", "marital_status": "Marital Status",
        "land_acres": "Land (acres)", "has_bpl": "BPL Card",
        "has_disability": "Disability", "num_daughters": "No. of Daughters",
        "has_bank_account": "Bank Account",
    }
    labels_hi = {
        "age": "आयु", "gender": "लिंग", "state": "राज्य",
        "occupation": "व्यवसाय", "annual_income": "वार्षिक आय (₹)",
        "social_category": "सामाजिक श्रेणी", "marital_status": "वैवाहिक स्थिति",
        "land_acres": "भूमि (एकड़)", "has_bpl": "बीपीएल कार्ड",
        "has_disability": "विकलांगता", "num_daughters": "बेटियों की संख्या",
        "has_bank_account": "बैंक खाता",
    }
    labels = labels_hi if language == "Hindi" else labels_en
    return labels.get(field, field.replace("_", " ").title())


# ──────────────────────────────────────────────────────────────────────────────
# Sidebar
# ──────────────────────────────────────────────────────────────────────────────

with st.sidebar:
    st.title("⚙️ Settings")

    lang_choice = st.radio(
        "Language / भाषा",
        ["English", "Hindi"],
        index=0 if st.session_state.language == "English" else 1,
        horizontal=True,
    )
    if lang_choice != st.session_state.language:
        st.session_state.language = lang_choice

    st.divider()

    if st.button("🔄 Restart Conversation", use_container_width=True):
        _reset()
        st.rerun()

    st.divider()

    # Profile panel
    profile = st.session_state.profile
    if profile:
        if st.session_state.language == "Hindi":
            st.subheader("📋 आपका प्रोफ़ाइल")
        else:
            st.subheader("📋 Your Profile So Far")

        for field, value in profile.items():
            if value is None or value == "":
                continue
            label = _profile_label(field, st.session_state.language)
            if isinstance(value, bool):
                display = ("Yes ✓" if value else "No") if st.session_state.language == "English" else ("हाँ ✓" if value else "नहीं")
            elif field == "annual_income":
                display = f"₹{int(value):,}"
            else:
                display = str(value)
            st.write(f"**{label}:** {display}")
    else:
        if st.session_state.language == "Hindi":
            st.caption("बातचीत शुरू होने पर प्रोफ़ाइल यहाँ दिखाई देगा।")
        else:
            st.caption("Your profile will appear here as we chat.")

    st.divider()
    st.caption("🌐 [myScheme.gov.in](https://www.myscheme.gov.in)")
    st.caption("📞 Helpline: 14255 (UMANG)")


# ──────────────────────────────────────────────────────────────────────────────
# Main area — header
# ──────────────────────────────────────────────────────────────────────────────

col1, col2 = st.columns([3, 1])
with col1:
    if st.session_state.language == "Hindi":
        st.title("🇮🇳 Scheme Finder")
        st.caption("भारत की सरकारी कल्याण योजनाएं — आपके लिए")
    else:
        st.title("🇮🇳 Scheme Finder")
        st.caption("Indian Government Welfare Schemes — Personalised for You")

# ──────────────────────────────────────────────────────────────────────────────
# Scheme of the day
# ──────────────────────────────────────────────────────────────────────────────

if not st.session_state.scheme_of_day_shown and not st.session_state.greeted:
    import datetime
    schemes_all = st.session_state.schemes
    day_idx = datetime.date.today().day % len(schemes_all)
    sod = schemes_all[day_idx]
    with st.expander("💡 Scheme of the Day", expanded=True):
        st.markdown(f"**{sod['name']}**")
        st.markdown(sod.get("description", ""))
        st.markdown(f"*Benefit: {sod.get('benefit', '')}*")
        st.markdown(f"[Learn more]({sod.get('official_link', '')})")
    st.session_state.scheme_of_day_shown = True

# ──────────────────────────────────────────────────────────────────────────────
# Chat history display
# ──────────────────────────────────────────────────────────────────────────────

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# ──────────────────────────────────────────────────────────────────────────────
# Greeting (first load)
# ──────────────────────────────────────────────────────────────────────────────

if not st.session_state.greeted:
    greeting = ag.GREETING_EN if st.session_state.language == "English" else ag.GREETING_HI
    with st.chat_message("assistant"):
        st.markdown(greeting)
    _add_message("assistant", greeting)
    st.session_state.greeted = True

# ──────────────────────────────────────────────────────────────────────────────
# Match results display (rendered once match is available)
# ──────────────────────────────────────────────────────────────────────────────

def _render_match_results(results: dict, language: str) -> None:
    """Render eligible and possibly-eligible schemes as expandable cards."""
    eligible = results.get("eligible", [])
    possibly = results.get("possibly_eligible", [])

    if not eligible and not possibly:
        if language == "Hindi":
            st.warning("कोई मेल खाने वाली योजना नहीं मिली। myScheme.gov.in पर जाँच करें।")
        else:
            st.warning("No matching schemes found. Please check myScheme.gov.in.")
        return

    if eligible:
        if language == "Hindi":
            st.success(f"✅ आप **{len(eligible)}** योजना(ओं) के लिए पात्र हैं")
        else:
            st.success(f"✅ You are eligible for **{len(eligible)}** scheme(s)")

        for item in eligible:
            s = item["scheme"]
            name = f"{s['name']} ({s.get('name_hi', '')})" if language == "Hindi" and s.get("name_hi") else s["name"]
            with st.expander(f"🟢 {name} — {s.get('benefit', '')}", expanded=False):
                st.markdown(f"**{'विवरण' if language == 'Hindi' else 'Description'}:** {s.get('description', '')}")
                st.markdown(f"**{'लाभ' if language == 'Hindi' else 'Benefit'}:** {s.get('benefit', '')}")
                st.divider()

                # Why you qualify
                if item["reasons"]:
                    st.markdown(f"**{'आप क्यों योग्य हैं' if language == 'Hindi' else 'Why you qualify'}:**")
                    for r in item["reasons"]:
                        st.markdown(f"- {r}")
                st.divider()

                # Documents checklist
                docs = s.get("documents", [])
                if docs:
                    st.markdown(f"**{'आवश्यक दस्तावेज़' if language == 'Hindi' else 'Documents Required'}:**")
                    for d in docs:
                        st.checkbox(d, key=f"doc_{s['id']}_{d[:20]}", disabled=False)
                st.divider()

                # How to apply
                st.markdown(f"**{'कैसे आवेदन करें' if language == 'Hindi' else 'How to Apply'}:** {s.get('how_to_apply', '')}")
                link = s.get("official_link", "")
                if link:
                    apply_label = "🔗 आवेदन करें" if language == "Hindi" else "🔗 Apply Here"
                    st.link_button(apply_label, link)
                if not s.get("verified"):
                    st.caption("⚠️ Details to be verified on the official website.")

    if possibly:
        st.divider()
        if language == "Hindi":
            st.info(f"🔍 **{len(possibly)}** योजनाएं — अधिक जानकारी की आवश्यकता है")
        else:
            st.info(f"🔍 **{len(possibly)}** scheme(s) — need more information from you")

        for item in possibly:
            s = item["scheme"]
            name = f"{s['name']} ({s.get('name_hi', '')})" if language == "Hindi" and s.get("name_hi") else s["name"]
            with st.expander(f"🟡 {name} — {s.get('benefit', '')}", expanded=False):
                st.markdown(f"**{'विवरण' if language == 'Hindi' else 'Description'}:** {s.get('description', '')}")
                st.markdown(f"**{'लाभ' if language == 'Hindi' else 'Benefit'}:** {s.get('benefit', '')}")
                if item["missing"]:
                    st.markdown(f"**{'अभी भी चाहिए' if language == 'Hindi' else 'Still need to confirm'}:**")
                    for f in item["missing"]:
                        st.markdown(f"- {f.replace('_', ' ').title()}")
                link = s.get("official_link", "")
                if link:
                    learn_label = "🔗 अधिक जानें" if language == "Hindi" else "🔗 Learn More"
                    st.link_button(learn_label, link)


# Show persisted results if available
if st.session_state.match_results is not None:
    _render_match_results(st.session_state.match_results, st.session_state.language)

# ──────────────────────────────────────────────────────────────────────────────
# Download button (text checklist)
# ──────────────────────────────────────────────────────────────────────────────

if st.session_state.match_results:
    results = st.session_state.match_results
    eligible = results.get("eligible", [])
    if eligible:
        lines = ["SCHEME FINDER — YOUR ELIGIBLE SCHEMES\n", "=" * 40 + "\n"]
        for item in eligible:
            s = item["scheme"]
            lines.append(f"\n{s['name']}")
            lines.append(f"Benefit: {s.get('benefit', '')}")
            lines.append(f"How to apply: {s.get('how_to_apply', '')}")
            lines.append(f"Link: {s.get('official_link', '')}")
            lines.append("\nDocuments needed:")
            for d in s.get("documents", []):
                lines.append(f"  [ ] {d}")
            lines.append("-" * 40)
        lines.append(
            "\nDisclaimer: This tool gives guidance only. "
            "Please confirm details on the official scheme website "
            "or at your nearest government office."
        )
        download_text = "\n".join(lines)
        st.download_button(
            label="📥 Download Scheme Checklist",
            data=download_text,
            file_name="my_schemes_checklist.txt",
            mime="text/plain",
            use_container_width=True,
        )

# ──────────────────────────────────────────────────────────────────────────────
# Acknowledgement helper
# ──────────────────────────────────────────────────────────────────────────────

_ACK_LABELS_EN = {
    "age": "age", "gender": "gender", "state": "state",
    "occupation": "occupation", "annual_income": "annual income",
    "social_category": "social category", "marital_status": "marital status",
    "land_acres": "land holding", "has_bpl": "BPL card status",
    "has_disability": "disability status", "num_daughters": "number of daughters",
    "has_bank_account": "bank account status",
}

_ACK_LABELS_HI = {
    "age": "आयु", "gender": "लिंग", "state": "राज्य",
    "occupation": "व्यवसाय", "annual_income": "वार्षिक आय",
    "social_category": "सामाजिक श्रेणी", "marital_status": "वैवाहिक स्थिति",
    "land_acres": "भूमि", "has_bpl": "बीपीएल कार्ड",
    "has_disability": "विकलांगता", "num_daughters": "बेटियों की संख्या",
    "has_bank_account": "बैंक खाता",
}


def _build_ack(updates: dict, language: str) -> str:
    """Build a one-line confirmation of what was just understood from the user's message."""
    if not updates:
        return ""
    labels = _ACK_LABELS_HI if language == "Hindi" else _ACK_LABELS_EN
    parts = []
    for field, value in updates.items():
        label = labels.get(field, field)
        if isinstance(value, bool):
            display = ("Yes" if value else "No") if language == "English" else ("हाँ" if value else "नहीं")
        elif field == "annual_income":
            display = f"₹{int(value):,}"
        else:
            display = str(value)
        parts.append(f"**{label}**: {display}")
    if language == "Hindi":
        return "✅ समझ गया — " + ", ".join(parts)
    return "✅ Got it — " + ", ".join(parts)


# ──────────────────────────────────────────────────────────────────────────────
# Chat input handler
# ──────────────────────────────────────────────────────────────────────────────

lang = st.session_state.language
placeholder = "अपना संदेश यहाँ लिखें..." if lang == "Hindi" else "Type your message here..."

if user_input := st.chat_input(placeholder):
    # Show user message
    with st.chat_message("user"):
        st.markdown(user_input)
    _add_message("user", user_input)

    # Detect language choice from first message
    ui_lower = user_input.lower().strip()
    if ui_lower in ("hindi", "हिंदी", "हिन्दी", "hindi please", "हिंदी में"):
        st.session_state.language = "Hindi"
        lang = "Hindi"
    elif ui_lower in ("english", "english please"):
        st.session_state.language = "English"
        lang = "English"

    with st.chat_message("assistant"):
        with st.spinner("Thinking..." if lang == "English" else "सोच रहा हूँ..."):
            try:
                # ── Step 1: Extract with context of last question asked ───────
                context_field = st.session_state.last_asked_field
                updates = ag.extract_profile_updates(
                    user_input, st.session_state.profile, context_field
                )

                # ── Invalid input: LLM rejected the answer ───────────────────
                # Re-ask the exact same question with a friendly error message.
                # Do NOT advance last_asked_field — keep it on the same field.
                if updates.get("__invalid__"):
                    questions_map = ag._QUESTIONS_HI if lang == "Hindi" else ag._QUESTIONS_EN
                    same_q = questions_map.get(context_field, "")
                    if lang == "Hindi":
                        retry_msg = (
                            f"⚠️ वह जवाब **{context_field}** के लिए सही नहीं लगता। "
                            f"कृपया सही जानकारी दें।\n\n{same_q}"
                        )
                    else:
                        retry_msg = (
                            f"⚠️ That doesn't look like a valid **{context_field.replace('_', ' ')}**. "
                            f"Please enter a correct value.\n\n{same_q}"
                        )
                    st.markdown(retry_msg)
                    _add_message("assistant", retry_msg)
                    st.stop()

                if updates:
                    st.session_state.profile.update(updates)

                # ── Step 2: Use UPDATED profile for all decisions ─────────────
                profile = st.session_state.profile
                next_q, next_field = ag.decide_next_question(profile, lang)

                # Store the field we're about to ask so next turn has context
                st.session_state.last_asked_field = next_field

                # Build acknowledgement of what was just captured
                ack = _build_ack(updates, lang)

                # Enough info to match?
                has_core = all(
                    profile.get(f) is not None
                    for f in ["age", "gender", "state", "occupation", "annual_income"]
                )

                if has_core:
                    results = match_schemes(profile, st.session_state.schemes)
                    st.session_state.match_results = results

                    eligible_count = len(results.get("eligible", []))
                    possibly_count = len(results.get("possibly_eligible", []))

                    if lang == "Hindi":
                        summary = (
                            (ack + "\n\n" if ack else "") +
                            f"मुझे आपके लिए **{eligible_count}** योजनाएं मिलीं जिनके लिए आप **पात्र** हैं"
                            + (f", और **{possibly_count}** और जिनके लिए थोड़ी और जानकारी चाहिए।" if possibly_count else "।")
                            + "\n\nनीचे विस्तार से देखें। 👇"
                        )
                    else:
                        summary = (
                            (ack + "\n\n" if ack else "") +
                            f"I found **{eligible_count}** scheme(s) you are **eligible** for"
                            + (f", and **{possibly_count}** more where a little more info is needed." if possibly_count else ".")
                            + "\n\nSee the details below 👇"
                        )

                    if next_q:
                        summary += f"\n\n{next_q}"

                    st.markdown(summary)
                    _add_message("assistant", summary)
                    _render_match_results(results, lang)

                elif next_q:
                    reply = (ack + "\n\n" if ack else "") + next_q
                    st.markdown(reply)
                    _add_message("assistant", reply)
                else:
                    # Profile seems complete; answer as follow-up
                    history = st.session_state.messages[:-1]  # exclude current user msg
                    answer = ag.answer_followup(
                        user_input,
                        profile,
                        st.session_state.match_results or {},
                        lang,
                        history,
                    )
                    st.markdown(answer)
                    _add_message("assistant", answer)

            except ValueError as exc:
                # Typically missing API key
                err_msg = (
                    f"⚠️ Configuration error: {exc}\n\n"
                    "Please check your `.env` file and make sure `LLM_API_KEY` is set."
                )
                st.error(err_msg)
                _add_message("assistant", err_msg)

            except RuntimeError as exc:
                err_msg = (
                    f"⚠️ API error: {exc}\n\n"
                    "Please try again in a moment."
                )
                st.warning(err_msg)
                _add_message("assistant", err_msg)

            except Exception as exc:
                err_msg = (
                    f"⚠️ Something went wrong: {exc}\n\n"
                    "Please try again or restart the conversation."
                )
                st.error(err_msg)
                _add_message("assistant", err_msg)

# ──────────────────────────────────────────────────────────────────────────────
# Footer disclaimer
# ──────────────────────────────────────────────────────────────────────────────

st.divider()
st.caption(
    "⚠️ **Disclaimer:** This tool gives guidance only. "
    "Please confirm details on the official scheme website or at your nearest government office. "
    "Do **not** share your Aadhaar number, bank account number, or phone number here."
)
st.caption("Built for UN SDG 1: No Poverty 🌍 | Data source: myScheme.gov.in & official portals")
