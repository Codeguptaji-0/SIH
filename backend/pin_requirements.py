#!/usr/bin/env python3
"""
Pin requirements.txt to the versions this machine actually runs.

Every line in requirements.txt used to be `>=`, which means "whatever PyPI ships
today". That is how a demo that worked last week stops working on the morning of
the hackathon: a new major release of any one of eleven packages is enough. The
opposite mistake is `pip freeze > requirements.txt`, which dumps the whole
environment - every transitive dependency and anything else installed globally -
and no longer says which packages the project actually chose.

So this reads the curated list, asks importlib.metadata what is installed for
each name, and rewrites the same list with `==`. The result is a pinned set that
is known to run the demo, because it is the set the demo just ran on.

Run it with the SAME interpreter that runs the server - see the README's
`python -m uvicorn` note. A different interpreter has a different site-packages
and would pin versions that were never tested:

    cd backend
    python pin_requirements.py            # show what would change
    python pin_requirements.py --write    # rewrite requirements.txt

Exit code 1 means something in the list is not installed, so nothing was written.
"""

import argparse
import os
import re
import sys

try:
    from importlib.metadata import PackageNotFoundError, version
except ImportError:  # Python < 3.8
    print("This needs Python 3.8+ for importlib.metadata.")
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
REQUIREMENTS = os.path.join(HERE, "requirements.txt")

# `python-jose[cryptography]>=3.3.0` -> name `python-jose`, extras `[cryptography]`.
# The extras have to survive the rewrite: dropping them silently removes the
# cryptography backend and login only fails later, at token-signing time.
LINE = re.compile(r"^\s*([A-Za-z0-9._-]+)\s*(\[[^\]]*\])?\s*([<>=!~].*)?$")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true",
                    help="rewrite requirements.txt in place")
    ap.add_argument("--file", default=REQUIREMENTS)
    args = ap.parse_args()

    with open(args.file, "r", encoding="utf-8") as fh:
        original = fh.read()

    out, missing, changed = [], [], 0
    for raw in original.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            out.append(raw)
            continue
        m = LINE.match(line)
        if not m:
            print("  ?? cannot parse, left as is: %s" % line)
            out.append(raw)
            continue
        name, extras, spec = m.group(1), m.group(2) or "", m.group(3) or ""
        try:
            found = version(name)
        except PackageNotFoundError:
            missing.append(name)
            out.append(raw)
            continue
        pinned = "%s%s==%s" % (name, extras, found)
        if pinned != line:
            changed += 1
            print("  %-34s %s  ->  %s" % (name + extras, spec or "(unpinned)", "==" + found))
        else:
            print("  %-34s already pinned at %s" % (name + extras, found))
        out.append(pinned)

    print("")
    if missing:
        print("NOT INSTALLED under %s:" % sys.executable)
        for name in missing:
            print("  - %s" % name)
        print("\nNothing written. Install these with the same interpreter first:")
        print("  python -m pip install -r requirements.txt")
        return 1

    if not changed:
        print("Already pinned to this environment - nothing to do.")
        return 0

    if not args.write:
        print("%d line(s) would change. Re-run with --write to apply." % changed)
        return 0

    with open(args.file, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(out).rstrip("\n") + "\n")
    print("Pinned %d line(s) in %s (interpreter: %s)."
          % (changed, args.file, sys.version.split()[0]))
    print("Verify with: python -m pip install -r requirements.txt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
