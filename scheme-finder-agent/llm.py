"""
llm.py — Provider-agnostic LLM wrapper.

Reads LLM_PROVIDER from .env (default: "openai").
Supports: openai, gemini, anthropic.

Usage:
    from llm import chat_completion
    response_text = chat_completion(messages, system_prompt)
"""

import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "")


def chat_completion(
    messages: list[dict],
    system_prompt: str = "",
    temperature: float = 0.3,
    max_tokens: int = 1024,
) -> str:
    """
    Send a chat completion request to the configured LLM provider.

    Args:
        messages:      List of {"role": "user"/"assistant", "content": "..."}
        system_prompt: System instruction (prepended automatically per provider).
        temperature:   Sampling temperature (0 = deterministic).
        max_tokens:    Maximum tokens in the response.

    Returns:
        The assistant's reply as a plain string.

    Raises:
        ValueError: If the provider is unknown or the API key is missing.
        RuntimeError: On API errors.
    """
    if not LLM_API_KEY:
        raise ValueError(
            "LLM_API_KEY is not set. Please add it to your .env file."
        )

    if LLM_PROVIDER == "openai":
        return _openai(messages, system_prompt, temperature, max_tokens)
    elif LLM_PROVIDER == "gemini":
        return _gemini(messages, system_prompt, temperature, max_tokens)
    elif LLM_PROVIDER == "anthropic":
        return _anthropic(messages, system_prompt, temperature, max_tokens)
    else:
        raise ValueError(
            f"Unknown LLM_PROVIDER '{LLM_PROVIDER}'. "
            "Choose from: openai, gemini, anthropic."
        )


# ──────────────────────────────────────────────────────────────────────────────
# Provider implementations
# ──────────────────────────────────────────────────────────────────────────────

def _openai(
    messages: list[dict],
    system_prompt: str,
    temperature: float,
    max_tokens: int,
) -> str:
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise ImportError(
            "openai package not installed. Run: pip install openai"
        ) from exc

    model = LLM_MODEL or "gpt-4o-mini"
    client = OpenAI(api_key=LLM_API_KEY)

    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=full_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        raise RuntimeError(f"OpenAI API error: {exc}") from exc


def _gemini(
    messages: list[dict],
    system_prompt: str,
    temperature: float,
    max_tokens: int,
) -> str:
    try:
        import google.generativeai as genai
    except ImportError as exc:
        raise ImportError(
            "google-generativeai package not installed. "
            "Run: pip install google-generativeai"
        ) from exc

    model_name = LLM_MODEL or "gemini-1.5-flash"
    genai.configure(api_key=LLM_API_KEY)

    generation_config = genai.types.GenerationConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
    )

    # Gemini uses "model" and "user" roles; convert "assistant" → "model"
    gemini_history = []
    for msg in messages[:-1]:  # all but the last (current user turn)
        role = "model" if msg["role"] == "assistant" else "user"
        gemini_history.append({"role": role, "parts": [msg["content"]]})

    last_user_message = messages[-1]["content"] if messages else ""

    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_prompt or None,
        generation_config=generation_config,
    )

    try:
        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(last_user_message)
        return response.text.strip()
    except Exception as exc:
        raise RuntimeError(f"Gemini API error: {exc}") from exc


def _anthropic(
    messages: list[dict],
    system_prompt: str,
    temperature: float,
    max_tokens: int,
) -> str:
    try:
        import anthropic
    except ImportError as exc:
        raise ImportError(
            "anthropic package not installed. Run: pip install anthropic"
        ) from exc

    model_name = LLM_MODEL or "claude-3-haiku-20240307"
    client = anthropic.Anthropic(api_key=LLM_API_KEY)

    try:
        response = client.messages.create(
            model=model_name,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt if system_prompt else anthropic.NOT_GIVEN,
            messages=messages,
        )
        return response.content[0].text.strip()
    except Exception as exc:
        raise RuntimeError(f"Anthropic API error: {exc}") from exc
