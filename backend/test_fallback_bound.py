"""
Regression test for the mutual-fallback recursion defect.

Both live providers hand off to each other on failure: OpenAIProvider falls back
to AnthropicProvider and AnthropicProvider falls back to OpenAIProvider. Before
the `allow_fallback` flag existed, a request with BOTH keys set and BOTH providers
failing bounced between them without limit - a simulation of the old code made 195
real API attempts before Python's own recursion limit stopped it. In production
that is a request that hangs for minutes, a pile of billable calls, and only then
the mock.

This test stubs `pydantic_settings`, `openai` and `anthropic` so it needs no keys,
no network and no installed SDKs, then asserts the chain is bounded at exactly two
live attempts (primary + one alternate) before MockAIProvider takes over.

    python test_fallback_bound.py        # exit 0 = bounded
"""
import os
import sys
import types

BACKEND = os.path.dirname(os.path.abspath(__file__))

# Every stubbed API call appends here, so len() is the number of live attempts.
ATTEMPTS = []


def _install_pydantic_settings():
    """Minimal BaseSettings: read each declared field from os.environ."""
    if "pydantic_settings" in sys.modules:
        return
    try:
        import pydantic_settings  # noqa: F401
        return
    except Exception:
        pass

    m = types.ModuleType("pydantic_settings")

    class BaseSettings:
        def __init__(self, **kw):
            ann = {}
            for klass in reversed(type(self).__mro__):
                ann.update(getattr(klass, "__annotations__", {}) or {})
            for name, typ in ann.items():
                default = getattr(type(self), name, "")
                raw = os.environ.get(name)
                if raw is None:
                    val = default
                elif typ is bool:
                    val = raw.strip().lower() in ("1", "true", "yes", "on")
                elif typ is int:
                    val = int(raw)
                else:
                    val = raw
                setattr(self, name, val)

    m.BaseSettings = BaseSettings
    m.SettingsConfigDict = dict
    sys.modules["pydantic_settings"] = m


class _Boom(Exception):
    pass


def _install_openai():
    m = types.ModuleType("openai")

    class _Completions:
        def create(self, **kw):
            ATTEMPTS.append("openai")
            raise _Boom("stubbed OpenAI failure")

    class _Chat:
        completions = _Completions()

    class OpenAI:
        def __init__(self, **kw):
            self.chat = _Chat()

    m.OpenAI = OpenAI
    sys.modules["openai"] = m


def _install_anthropic():
    m = types.ModuleType("anthropic")

    class _Messages:
        def create(self, **kw):
            ATTEMPTS.append("anthropic")
            raise _Boom("stubbed Anthropic failure")

    class Anthropic:
        def __init__(self, **kw):
            self.messages = _Messages()

    m.Anthropic = Anthropic
    sys.modules["anthropic"] = m


def main():
    # Both keys present is the only configuration that could recurse.
    os.environ["ANTHROPIC_API_KEY"] = "stub-anthropic-key"
    os.environ["OPENAI_API_KEY"] = "stub-openai-key"
    os.environ["AI_PROVIDER"] = ""
    os.environ["DEMO_MODE"] = "false"
    os.environ["SECRET_KEY"] = "stub-secret-for-import-only"

    _install_pydantic_settings()
    _install_openai()
    _install_anthropic()
    sys.path.insert(0, BACKEND)
    os.chdir(BACKEND)

    from app.ai.provider import get_ai_provider, resolve_provider_name

    print("FALLBACK BOUND TEST")
    print("  resolve_provider_name() ->", resolve_provider_name())
    prov = get_ai_provider()
    print("  provider class          ->", type(prov).__name__)

    failures = []
    chunks = [
        "Stratified random sampling divides the population into homogeneous strata "
        "before selecting a sample from each stratum, which reduces the variance of "
        "the estimator compared with simple random sampling of the same size."
    ] * 3

    print("\n1. generate_mcqs with both providers failing")
    ATTEMPTS.clear()
    old_limit = sys.getrecursionlimit()
    sys.setrecursionlimit(300)          # a runaway chain trips this in a second
    try:
        mcqs = prov.generate_mcqs(chunks, 3)
    except RecursionError:
        failures.append("generate_mcqs still recurses (RecursionError)")
        mcqs = []
    print("  live attempts:", ATTEMPTS, "->", len(ATTEMPTS))
    if len(ATTEMPTS) != 2:
        failures.append("generate_mcqs made %d live attempts, expected 2" % len(ATTEMPTS))
    else:
        print("  [PASS] bounded at 2 attempts (primary + one alternate)")
    if sorted(set(ATTEMPTS)) != ["anthropic", "openai"]:
        failures.append("generate_mcqs attempted %r, expected one of each" % (ATTEMPTS,))
    else:
        print("  [PASS] each provider was tried exactly once")
    if not mcqs:
        failures.append("generate_mcqs fell through without any mock questions")
    else:
        print("  [PASS] still returned usable questions ->", len(mcqs))

    print("\n2. generate_chat_response with both providers failing")
    ATTEMPTS.clear()
    try:
        reply = prov.generate_chat_response("What is stratified sampling?")
    except RecursionError:
        failures.append("generate_chat_response still recurses (RecursionError)")
        reply = ""
    print("  live attempts:", ATTEMPTS, "->", len(ATTEMPTS))
    if len(ATTEMPTS) != 2:
        failures.append("generate_chat_response made %d live attempts, expected 2" % len(ATTEMPTS))
    else:
        print("  [PASS] bounded at 2 attempts")
    if not reply:
        failures.append("generate_chat_response returned nothing")
    else:
        print("  [PASS] the learner still got an answer ->", len(reply), "chars")

    sys.setrecursionlimit(old_limit)

    print()
    if failures:
        for f in failures:
            print("  [FAIL]", f)
        print("\nFALLBACK BOUND TEST FAILED (%d failure(s))" % len(failures))
        return 1
    print("FALLBACK BOUND TEST PASSED (0 failure(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
