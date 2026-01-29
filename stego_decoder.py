#!/usr/bin/env python3
"""
LSB Steganography Decoder with Entropy Detection
Forensic-grade output with AI-assisted interpretation
"""

import sys
import os
import argparse
import string
import json
import math
from collections import Counter
from PIL import Image
from dotenv import load_dotenv
import urllib.request
import urllib.error

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.1-8b-instant"

MAX_AI_CHARS = 4000
ENTROPY_THRESHOLD = 4.5

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0 Safari/537.36"
)

SYSTEM_PROMPT = """
You are a Digital Forensics Analyst specializing in steganography.

Analyze extracted hidden messages from images.
Provide interpretation, intent assessment, and risk evaluation.
Be factual and concise. If information is limited, state limitations.
"""


def clean_text(text):
    text = ''.join(c for c in text if c in string.printable)
    return text.encode("utf-8", errors="ignore").decode("utf-8").strip()


def calculate_entropy(text):
    if not text:
        return 0.0
    counts = Counter(text)
    length = len(text)
    return -sum((c / length) * math.log2(c / length) for c in counts.values())


def analyze_with_ai(message, entropy):
    if not GROQ_API_KEY:
        return "AI analysis unavailable (API key missing)."

    message = clean_text(message)[:MAX_AI_CHARS]

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT.strip()},
            {
                "role": "user",
                "content": (
                    "Hidden message extracted from image steganography:\n\n"
                    f"Message: \"{message}\"\n"
                    f"Entropy Score: {entropy:.2f}\n\n"
                    "Analyze meaning, intent, and potential risk."
                )
            }
        ],
        "temperature": 0.0,
        "max_tokens": 600
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT
    }

    req = urllib.request.Request(
        GROQ_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]

    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode()
        except Exception:
            detail = "No response body"
        return f"AI analysis failed: HTTP {e.code} - {detail}"

    except Exception as e:
        return f"AI analysis error: {str(e)}"


def process_message(message):
    cleaned = clean_text(message)

    if not cleaned:
        return "Stego Analysis:\nNo hidden message detected."

    entropy = calculate_entropy(cleaned)

    if entropy > ENTROPY_THRESHOLD:
        return (
            "Stego Analysis:\n"
            "Hidden data detected, but content appears to be noise or encrypted.\n"
            f"Entropy Score: {entropy:.2f} (Threshold: {ENTROPY_THRESHOLD})\n"
            "AI analysis skipped."
        )

    ai_result = analyze_with_ai(cleaned, entropy)

    return (
        "Stego Analysis:\n"
        f"Hidden Message: {cleaned}\n"
        f"Entropy Score: {entropy:.2f}\n\n"
        "AI Interpretation:\n"
        f"{ai_result}"
    )


def decode_lsb(image_path):
    try:
        img = Image.open(image_path).convert("RGB")
        binary = ""

        for y in range(img.height):
            for x in range(img.width):
                for c in img.getpixel((x, y)):
                    binary += str(c & 1)

                    if len(binary) % 8 == 0:
                        chars = []
                        for i in range(0, len(binary), 8):
                            b = binary[i:i+8]
                            if len(b) < 8:
                                continue
                            ch = chr(int(b, 2))
                            if ch == "\0":
                                return process_message("".join(chars))
                            chars.append(ch)

        # fallback
        chars = [
            chr(int(binary[i:i+8], 2))
            for i in range(0, len(binary), 8)
            if len(binary[i:i+8]) == 8
        ]

        return process_message("".join(chars))

    except Exception as e:
        return f"Stego Analysis Error: {str(e)}"


def main():
    parser = argparse.ArgumentParser(description="LSB Steganography Decoder")
    parser.add_argument("image", help="Image file path")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        print("File not found.")
        sys.exit(1)

    print(decode_lsb(args.image))


if __name__ == "__main__":
    main()
