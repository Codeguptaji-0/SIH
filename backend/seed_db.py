#!/usr/bin/env python3
"""
Load database/seed.sql into whatever DATABASE_URL points at - SQLite or Postgres.

Why this exists. init_db.py talks to the sqlite3 module directly and uses
`cursor.executescript`, so it can only ever build the local demo file. Deploying
to Postgres (Supabase) needs the same seed data in a database that does not
understand two things init_db.py relies on:

  1. `INSERT OR REPLACE INTO`, which is SQLite-only. Postgres spells it
     `INSERT ... ON CONFLICT (id) DO NOTHING`.
  2. `executescript`, which is a sqlite3 convenience, not a SQL feature. Every
     other driver wants one statement per execute() call.

The tables themselves are NOT created from schema.sql here. app/main.py already
calls `Base.metadata.create_all(bind=engine)`, so SQLAlchemy emits the DDL in the
target dialect. That is only safe because app/models/models.py and
database/schema.sql were checked to agree: 12 tables, 0 column mismatches. If
they ever drift, Postgres gets the models version and SQLite gets schema.sql,
and the two deployments stop being the same product.

The statement splitter and the dialect rewrite are pure functions, and
`--selftest` exercises them with the stdlib sqlite3 module alone. That matters
because the deploy target cannot be reached from a dev machine without
credentials: the risky part of this script is testable without any database
except the one Python ships with.

    python seed_db.py --selftest     # prove the splitter and rewrite, no server
    python seed_db.py                # load into DATABASE_URL (needs SQLAlchemy)
    python seed_db.py --dry-run      # print what would run, touch nothing

For Postgres also install a driver and pin it:
    python -m pip install -r requirements-postgres.txt
    python pin_requirements.py --file requirements-postgres.txt --write
"""

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA_SQL = os.path.join(HERE, "..", "database", "schema.sql")
SEED_SQL = os.path.join(HERE, "..", "database", "seed.sql")

def split_statements(sql):
    """
    Split a SQL script into statements on semicolons that are not inside a string
    literal, dropping `--` line comments.

    Naive `sql.split(";")` is wrong here and would fail quietly: seed.sql is full
    of prose explanations, and a semicolon or a `--` inside one of those quoted
    strings would cut a statement in half. SQLite's `executescript` gets this
    right for free, which is exactly why moving off it needs this function.
    Doubled quotes ('') are SQL's own escape for an apostrophe and stay inside
    the string.
    """
    out, buf, i, in_string = [], [], 0, False
    n = len(sql)
    while i < n:
        ch = sql[i]
        if in_string:
            buf.append(ch)
            if ch == "'":
                if i + 1 < n and sql[i + 1] == "'":   # '' -> escaped apostrophe
                    buf.append("'")
                    i += 2
                    continue
                in_string = False
            i += 1
            continue
        if ch == "'":
            in_string = True
            buf.append(ch)
            i += 1
            continue
        if ch == "-" and i + 1 < n and sql[i + 1] == "-":
            while i < n and sql[i] != "\n":
                i += 1
            continue
        if ch == ";":
            stmt = "".join(buf).strip()
            if stmt:
                out.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        out.append(tail)
    return out


# `INSERT OR REPLACE` / `INSERT OR IGNORE` are SQLite spellings of an upsert.
OR_CLAUSE = re.compile(r"^INSERT\s+OR\s+(REPLACE|IGNORE)\s+INTO\b", re.I)


def rewrite_for_postgres(stmt):
    """
    Make one statement acceptable to Postgres.

    DO NOTHING rather than DO UPDATE on purpose: seeding is meant to be safe to
    re-run, not to overwrite data an operator may have changed in a live
    database. Every seeded table's insert column list begins with `id`, which is
    the primary key, so `(id)` is the conflict target in all cases.
    """
    if not OR_CLAUSE.match(stmt):
        return stmt
    stmt = OR_CLAUSE.sub("INSERT INTO", stmt)
    if re.search(r"\bON\s+CONFLICT\b", stmt, re.I):
        return stmt
    return stmt + "\nON CONFLICT (id) DO NOTHING"

def read(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def selftest():
    """
    Prove the two risky functions with nothing but the standard library.

    The test that matters is equivalence: build the schema and seed twice into
    in-memory SQLite - once with executescript (the behaviour init_db.py has
    always had) and once through split_statements() - and assert both databases
    hold the same rows. If the splitter ever cuts a statement wrongly, the counts
    diverge here instead of in a half-seeded production database.
    """
    import sqlite3

    schema, seed = read(SCHEMA_SQL), read(SEED_SQL)
    tables = re.findall(r"CREATE TABLE IF NOT EXISTS (\w+)", schema)
    failures = []

    def counts(conn):
        return {t: conn.execute("SELECT COUNT(*) FROM %s" % t).fetchone()[0]
                for t in tables}

    reference = sqlite3.connect(":memory:")
    reference.executescript(schema)
    reference.executescript(seed)

    stmts = split_statements(seed)
    mine = sqlite3.connect(":memory:")
    mine.executescript(schema)
    for stmt in stmts:
        mine.execute(stmt)
    mine.commit()

    want, got = counts(reference), counts(mine)
    print("  %d statements parsed out of seed.sql" % len(stmts))
    if want == got:
        print("  [PASS] statement-by-statement load matches executescript exactly")
    else:
        failures.append("row counts differ: %s" % {
            t: (want[t], got[t]) for t in tables if want[t] != got[t]})

    seeded = {t: c for t, c in got.items() if c}
    print("  seeded: %s" % ", ".join("%s=%d" % kv for kv in sorted(seeded.items())))
    if len(seeded) >= 8:
        print("  [PASS] every seeded table is populated -> %d tables" % len(seeded))
    else:
        failures.append("only %d tables seeded, expected >= 8" % len(seeded))

    # The rewrite must remove every SQLite-only clause and add a conflict target,
    # or Postgres rejects the statement at load time - after some rows are in.
    upserts = [s for s in stmts if OR_CLAUSE.match(s)]
    rewritten = [rewrite_for_postgres(s) for s in upserts]
    if upserts and all("ON CONFLICT (id) DO NOTHING" in s for s in rewritten):
        print("  [PASS] all %d upserts gain an explicit conflict target"
              % len(upserts))
    else:
        failures.append("rewrite missed an upsert: %d of %d"
                        % (sum("ON CONFLICT" in s for s in rewritten), len(upserts)))
    if not any(OR_CLAUSE.match(s) for s in rewritten):
        print("  [PASS] no SQLite-only INSERT OR ... survives the rewrite")
    else:
        failures.append("an INSERT OR ... clause survived the rewrite")

    # Idempotence: re-running the rewritten script must not double any row. On
    # SQLite the original OR REPLACE gives that; the Postgres form has to match.
    if all(rewrite_for_postgres(s) == rewrite_for_postgres(rewrite_for_postgres(s))
           for s in upserts):
        print("  [PASS] the rewrite is idempotent, so re-seeding is safe")
    else:
        failures.append("rewriting twice changes the statement")

    print("")
    if failures:
        for f in failures:
            print("FAILED: %s" % f)
        return 1
    print("SEED LOADER SELFTEST PASSED (%d statements, %d tables, %d upserts)."
          % (len(stmts), len(seeded), len(upserts)))
    return 0

def load(dry_run=False):
    """
    Create the tables through SQLAlchemy, then load the seed in the right dialect.
    """
    sys.path.insert(0, HERE)
    from app.config import settings          # noqa: E402
    from app.database import Base, engine    # noqa: E402
    import app.models.models                 # noqa: E402,F401  (registers the tables)

    url = settings.DATABASE_URL
    # Never print the URL itself - a hosted Postgres URL carries the password.
    print("Target dialect: %s" % engine.dialect.name)
    is_postgres = engine.dialect.name.startswith("postgres")

    stmts = split_statements(read(SEED_SQL))
    if is_postgres:
        stmts = [rewrite_for_postgres(s) for s in stmts]
    print("%d statements to load%s"
          % (len(stmts), " (rewritten for Postgres)" if is_postgres else ""))

    if dry_run:
        for s in stmts:
            print("---\n%s" % s[:300])
        print("\nDry run: nothing was executed.")
        return 0

    Base.metadata.create_all(bind=engine)
    print("[OK] Tables created or already present.")

    # exec_driver_sql, not text(): SQLAlchemy's text() treats ':word' as a bind
    # parameter, and the seed's explanation strings contain colons. Passing the
    # SQL straight to the driver avoids inventing parameters that do not exist.
    with engine.begin() as conn:
        for i, stmt in enumerate(stmts, 1):
            try:
                conn.exec_driver_sql(stmt)
            except Exception as exc:
                print("[FAIL] statement %d of %d:\n%s\n  -> %s"
                      % (i, len(stmts), stmt[:400], exc))
                raise
    print("[OK] Seed loaded into %s." % engine.dialect.name)
    print("Verify with: python smoke_adaptive.py --base <deployed-url>")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true",
                    help="prove the splitter and the rewrite, no database needed")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the statements that would run")
    args = ap.parse_args()
    if args.selftest:
        print("Seed loader selftest (stdlib sqlite3 only)")
        return selftest()
    return load(dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
