"""Phone Guide - explains phone apps in simple Indian languages.
Runs fully on your own computer: Flask + Ollama (open-weight Gemma)."""
import requests
from flask import Flask, request, jsonify, send_from_directory

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "gemma3:4b"  # change to gemma3:12b if your laptop can handle it

app = Flask(__name__, static_folder=".")

STYLE = (
    "You are a patient, kind helper for an elderly person who is new to smartphones. "
    "Reply ONLY in {lang}. Use very simple, short sentences and everyday words. "
    "Never use technical jargon. Do not use markdown symbols like ** or #. "
    "Use short lines with plain labels."
)

EXPLAIN = (
    "Explain this to the person: {text}\n"
    "If an image is attached, it is a screenshot of their phone. Explain what is on the screen "
    "and what each button does.\n"
    "Answer in this order:\n"
    "1. What it is for (2 lines)\n"
    "2. How to use it (3 to 5 easy steps)\n"
    "3. Dangers and what to be careful about (scams, OTP, fake links, privacy)\n"
    "4. One thing they must NEVER do"
)

SCAM = (
    "Check if this message, call, or screen could be a scam: {text}\n"
    "If an image is attached, it is a screenshot of it.\n"
    "Start with one clear line: SAFE, DANGEROUS, or NOT SURE (translated into the language). "
    "Then give 2 to 3 simple reasons and tell them exactly what to do next. "
    "Remind them: never share OTP, PIN, or card numbers with anyone, and a bank never asks for them."
    "Never tell the person to call or contact you. Tell them to delete the message and call their bank's official number, or the cyber crime helpline 1930."
)


@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/ask", methods=["POST"])
def ask():
    d = request.get_json(force=True)
    lang = d.get("lang", "Hindi")
    mode = d.get("mode", "explain")
    text = (d.get("text") or "").strip() or "(see screenshot)"
    image = d.get("image")  # base64 string without the data: prefix

    prompt = (SCAM if mode == "scam" else EXPLAIN).format(text=text)
    user_msg = {"role": "user", "content": prompt}
    if image:
        user_msg["images"] = [image]

    payload = {
        "model": MODEL,
        "stream": False,
        "messages": [{"role": "system", "content": STYLE.format(lang=lang)}, user_msg],
    }
    try:
        r = requests.post(OLLAMA_URL, json=payload, timeout=300)
        r.raise_for_status()
        return jsonify(answer=r.json()["message"]["content"])
    except requests.exceptions.ConnectionError:
        return jsonify(error="Ollama is not running. Start it and try again."), 503
    except Exception as e:
        return jsonify(error=str(e)), 500


if __name__ == "__main__":
    # host 0.0.0.0 lets your mom open it from her phone on the same Wi-Fi
    app.run(host="0.0.0.0", port=5000)
