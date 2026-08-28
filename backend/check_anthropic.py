#!/usr/bin/env python3
"""
Check an Anthropic (Claude) key end to end, without the app's silent fallback.

Why this script exists. Every failure path in app/ai/provider.py degrades to
MockAIProvider, which returns plausible MCQs. That is right for a live demo - a bad
key must never crash the golden path - and useless for setup, because a wrong model
ID, an expired key, a missing `anthropic` package and a working key all look the
same from the outside. This script does the same calls with NO fallback, so the
error is the error.

It runs four stages, each printing before it acts, so a hang tells you where:

    1. is the key visible to the app's settings at all
    2. is the SDK importable
    3. which model IDs can this key actually see          <- the ID you need
    4. one real MCQ generation + one chat reply, through the app's own prompt

    cd backend
    python check_anthropic.py                 # uses ANTHROPIC_MODEL, else the default
    python check_anthropic.py --model claude-... --count 2

No key material is printed: only whether a key is set, its length, and whether it
has the expected `sk-ant-` prefix. Stage 3 is the point of the script - model IDs
are dated strings that change faster than any constant in this repo, so ask the API
rather than trusting a default.
"""

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def stage(n, text):
    print("\n%d. %s" % (n, text))


SAMPLE_TEXT = (
    "In the National Sample Survey, stratified multi-stage sampling is used so that "
    "estimates remain reliable for sub-populations. First-stage units are villages in "
    "rural areas and urban frame survey blocks in urban areas. Design weights are the "
    "inverse of the selection probability, and are calibrated against Census "
    "population projections before estimates are published. The Consumer Price Index "
    "uses 2012 as its base year and is published for Rural, Urban and Combined."
)


def run(args):
    # ---------------------------------------------------------------- 1. the key
    stage(1, "Is the key visible to the app's settings?")
    try:
        from app.config import settings
    except Exception as exc:
        print("   [FAIL] cannot import app.config (%s: %s)" % (type(exc).__name__, exc))
        print("   Install the base requirements first: python -m pip install -r requirements.txt")
        return 1
    key = (settings.ANTHROPIC_API_KEY or os.environ.get("ANTHROPIC_API_KEY", "")).strip()
    if not key:
        print("   [FAIL] ANTHROPIC_API_KEY is empty.")
        print("   Put it in backend/.env as  ANTHROPIC_API_KEY=sk-ant-...  (that file is")
        print("   gitignored) or set it in the environment, then re-run.")
        return 1
    # Length and prefix only - never any part of the key itself.
    print("   [OK] key is set: %d characters, prefix %s"
          % (len(key), "sk-ant- (expected)" if key.startswith("sk-ant-") else "NOT sk-ant- (suspicious)"))
    print("   AI_PROVIDER=%r  DEMO_MODE=%r" % (settings.AI_PROVIDER, settings.DEMO_MODE))

    from app.ai.provider import (DEFAULT_ANTHROPIC_MODEL, build_mcq_prompt,
                                 parse_mcq_response, resolve_provider_name,
                                 describe_ai_provider, MCQ_SYSTEM_PROMPT,
                                 ASSISTANT_SYSTEM_PROMPT)
    resolved = resolve_provider_name()
    print("   the app would currently use: %s (%s)" % (resolved, describe_ai_provider()))
    if resolved != "anthropic":
        print("   [WARN] not 'anthropic'. Set AI_PROVIDER=anthropic in backend/.env -")
        print("          an explicit AI_PROVIDER wins over DEMO_MODE. This script")
        print("          continues anyway and tests the key directly.")

    # ---------------------------------------------------------------- 2. the SDK
    stage(2, "Is the anthropic SDK importable?")
    try:
        import anthropic
    except Exception as exc:
        print("   [FAIL] %s: %s" % (type(exc).__name__, exc))
        print("   python -m pip install -r requirements-anthropic.txt")
        return 1
    print("   [OK] anthropic %s" % getattr(anthropic, "__version__", "(version unknown)"))
    client = anthropic.Anthropic(api_key=key)

    # ------------------------------------------------------------- 3. model IDs
    stage(3, "Which model IDs can this key see?")
    model = (args.model or settings.ANTHROPIC_MODEL or DEFAULT_ANTHROPIC_MODEL).strip()
    ids = []
    try:
        listing = client.models.list()
        for m in getattr(listing, "data", listing) or []:
            mid = getattr(m, "id", None) or (m.get("id") if isinstance(m, dict) else None)
            if mid:
                ids.append(mid)
        for mid in ids:
            print("     %s%s" % (mid, "   <- will be used" if mid == model else ""))
        if not ids:
            print("   [WARN] the listing came back empty; the API may not expose it for this key")
    except Exception as exc:
        # Not fatal: an older SDK may not have models.list even though messages works.
        print("   [WARN] could not list models (%s: %s)" % (type(exc).__name__, exc))
    if ids and model not in ids:
        print("   [FAIL] %r is not in that list. Set ANTHROPIC_MODEL to one of the IDs" % model)
        print("          above (backend/.env) and re-run. A wrong ID is a 404 that the")
        print("          app would swallow into the mock provider.")
        return 1
    print("   testing with model: %s" % model)

    if args.skip_generation:
        print("\n--skip-generation: stopping before any tokens are spent.")
        return 0

    # ------------------------------------------- 4. one real generation, no fallback
    stage(4, "One real MCQ generation through the app's own prompt")
    from app.ai.provider import AnthropicProvider
    try:
        response = client.messages.create(
            model=model,
            max_tokens=4096,          # required by this API; too small truncates the JSON
            temperature=0.3,
            system=MCQ_SYSTEM_PROMPT,
            messages=[{"role": "user",
                       "content": build_mcq_prompt([SAMPLE_TEXT], args.count)}],
        )
    except Exception as exc:
        print("   [FAIL] the API call itself failed: %s: %s" % (type(exc).__name__, exc))
        print("   401/403 -> key; 404 -> model ID; 429 -> rate or credit limit.")
        return 1
    usage = getattr(response, "usage", None)
    if usage is not None:
        print("   tokens in/out: %s/%s" % (getattr(usage, "input_tokens", "?"),
                                           getattr(usage, "output_tokens", "?")))
    raw = AnthropicProvider._text_of(response)
    print("   reply: %d characters of text blocks" % len(raw))
    try:
        items = parse_mcq_response(raw, "Claude (%s)" % model)
    except Exception as exc:
        print("   [FAIL] the reply did not survive the quality gate: %s: %s"
              % (type(exc).__name__, exc))
        print("   First 400 characters of what came back:")
        print("   " + raw[:400].replace("\n", "\n   "))
        return 1
    print("   [OK] %d question(s) passed the same gate the app applies" % len(items))
    for it in items:
        print("     - [%s/%s] %s" % (it.get("difficulty"), it.get("competency_name"),
                                     (it.get("question_text") or "")[:70]))
        print("       correct option index %s of %d"
              % (it.get("correct_option"), len(it.get("options") or [])))

    stage(5, "One assistant reply")
    try:
        chat = client.messages.create(
            model=model, max_tokens=700, temperature=0.5,
            system=ASSISTANT_SYSTEM_PROMPT,
            messages=[{"role": "user",
                       "content": "In one sentence: why are design weights calibrated "
                                  "against Census projections?"}],
        )
        reply = AnthropicProvider._text_of(chat)
        print("   [OK] %s" % (reply[:200] + ("..." if len(reply) > 200 else "")))
    except Exception as exc:
        print("   [FAIL] %s: %s" % (type(exc).__name__, exc))
        return 1

    print("\nCLAUDE KEY CHECK PASSED with model %s." % model)
    print("Set these in backend/.env (and in the host's env vars when deploying):")
    print("  AI_PROVIDER=anthropic")
    print("  ANTHROPIC_MODEL=%s" % model)
    print("Then confirm the running server agrees:")
    print("  curl http://127.0.0.1:8000/api/health   -> \"ai_provider\":\"anthropic:%s\"" % model)
    return 0




def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="", help="model ID to test (default: ANTHROPIC_MODEL, else the built-in default)")
    ap.add_argument("--count", type=int, default=2, help="how many MCQs to ask for")
    ap.add_argument("--skip-generation", action="store_true",
                    help="stages 1-3 only: no tokens spent")
    args = ap.parse_args()
    print("Anthropic key check (no fallback, real errors)")
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
