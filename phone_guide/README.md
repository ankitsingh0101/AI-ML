# Phone Guide

Explains phone apps in simple Hindi (and a few other Indian languages), checks whether a message is a scam, and reads the answer aloud. Built for my mom, who asked me how to use PhonePe safely.

Built for the **Hacktoberfest Weekend Challenge: Build for a Friend** (DEV), started and finished Oct 2-5, 2026.

**Demo video:** https://youtu.be/oxgzFcXjPHI

## What it does

- **Explain this:** type an app name (PhonePe, WhatsApp...) and get what it is for, how to use it, what dangers to watch for, and one thing to never do.
- **Is this a scam?:** paste a suspicious SMS or message and get a plain verdict with what to do next.
- **Listen to the answer:** reads the answer aloud using the browser's built-in voice.
- **Screenshot upload:** attach a screenshot of a confusing screen and ask about it.
- Languages: Hindi, English, Marathi, Gujarati, Bengali, Tamil, Telugu.
- Large text and big buttons, because it is meant for people new to smartphones.

## How it works

- **Model:** [Gemma 3](https://ai.google.dev/gemma) (open-weight, `gemma3:4b`) running locally through [Ollama](https://ollama.com).
- **Backend:** a small Flask app (`app.py`) that sends a simple-language prompt to Ollama.
- **Frontend:** one HTML page (`index.html`).

Everything runs on your own computer. What the person types or uploads is sent only to the local Ollama server, not to a cloud AI service.

## Run it yourself (Windows)

1. Install Ollama from https://ollama.com
2. Download the model (about 3.3 GB, do this on Wi-Fi):
   ```
   ollama pull gemma3:4b
   ```
3. Install Python 3 (tick "Add python.exe to PATH") and the dependencies:
   ```
   pip install flask requests
   ```
4. Start the app from this folder:
   ```
   python app.py
   ```
5. Open http://localhost:5000

To use it from a phone, connect the phone to the same Wi-Fi as the computer and open `http://YOUR-COMPUTER-IP:5000`.

## Why open-source AI

- The questions and screenshots stay on the device, which matters for chats and payment screens.
- After the one-time model download, it does not need an internet connection or paid API.
- The model, language and prompts can be swapped or tuned by anyone.

## Limitations

- A small local model (4B) can give imperfect advice and its Hindi is not perfect. Always double-check anything about money.
- The first answer can take a minute or two on a laptop without a GPU.
- The Listen button uses the browser's voices, so a Hindi voice must be available on the device.
- The page loads Google Fonts when online and falls back to system fonts otherwise.
- It does not know the current screens of any app, so it explains in general terms.
- The scam checker is a helper, not a guarantee. For real fraud in India, contact your bank and the cyber crime helpline (1930).

## License

MIT. See `LICENSE`.

## Credits

[Gemma](https://ai.google.dev/gemma) by Google, [Ollama](https://ollama.com), [Flask](https://flask.palletsprojects.com).
