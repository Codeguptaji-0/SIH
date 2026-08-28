# DEPLOY.md — putting SkillSetu on a real URL

This is the runbook for moving the demo off `localhost`: a Postgres database, the
FastAPI backend on a host that gives it a public URL, and the Next.js frontend on
Vercel. It is written to be followed top to bottom, and every step ends in
something you can check rather than something you have to trust.

Two limits are stated up front, because they shape everything below:

**Nothing here was executed against a live Postgres.** The code changes for it are
tested — the seed rewrite has a self-test, the rewrite rule is proven against
SQLite, `next.config.js` was exercised with and without `BACKEND_ORIGIN` — but the
first real Postgres connection will be yours. Expect one or two surprises at step
3 and read the failure text rather than re-running.

**The demo accounts are published.** `README.md` prints the shared password and
the `/login` screen submits it from one-click buttons. That is fine for a
hackathon laptop and not fine for a public URL that stays up. Step 6 covers what
to do about it; do not skip it if the URL will outlive the demo.

## 0. What actually changes between the laptop and the deploy

Almost nothing in the application code, which is the point. `app/database.py`
builds the engine from `settings.DATABASE_URL` and only passes SQLite's
`check_same_thread` connect-arg when the URL starts with `sqlite`. So the switch
is one environment variable plus a driver.

The parts that are genuinely different are worth naming, because each one has bitten
this repo already:

| Concern | On the laptop | Deployed | Where it lives |
|---|---|---|---|
| Tables | `init_db.py` executes `database/schema.sql` | `Base.metadata.create_all()` emits DDL from `app/models/models.py` | `app/main.py:17` |
| Domain constraints | 8 `CHECK`s from schema.sql | the same 8, mirrored as `CheckConstraint` | `app/models/models.py` |
| Seed data | `init_db.py`, `executescript`, `INSERT OR REPLACE` | `seed_db.py`, statement by statement, `ON CONFLICT (id) DO NOTHING` | `backend/seed_db.py` |
| Frontend → backend | rewrite to `127.0.0.1:8000` | rewrite to `BACKEND_ORIGIN` | `frontend/next.config.js` |
| CORS | wildcard allowed under `DEMO_MODE` | explicit origins, wildcard refused | `app/main.py` |
| JWT signing key | random per process | `SECRET_KEY`, or refuses to start | `app/config.py` |

The constraint row is the one that would have been silent. `create_all()` never
reads `schema.sql`, so before the `CheckConstraint`s were added to `models.py` a
Postgres deploy accepted `review_status='WHATEVER'` — the human-in-the-loop gate,
gone, with no error anywhere.

## 1. Create the Postgres database (Supabase)

Any managed Postgres works; Supabase is assumed because it has a free tier and the
schema was written with it in mind.

1. Create a project. Note the database password when it is shown — Supabase does
   not display it again, and you will need it in the URL.
2. Take the **connection string** from Project Settings → Database. Prefer the
   pooler / "Connection pooling" string (port `6543`) over the direct one (`5432`)
   if the host you pick creates many short-lived connections.
3. Rewrite the scheme for SQLAlchemy. Supabase hands you a `postgresql://` URL;
   SQLAlchemy needs to be told which driver to load:

   ```
   postgresql+psycopg://postgres.PROJECTREF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
   ```

   `+psycopg` is psycopg **3**, which is what `requirements-postgres.txt`
   installs. If you install `psycopg2-binary` instead, the scheme is
   `postgresql+psycopg2://`. Getting this wrong produces
   `ModuleNotFoundError: No module named 'psycopg2'` at startup — a driver
   problem, not a network one.
4. If the password contains `@ : / ? # [ ] %`, percent-encode it. An unencoded `@`
   makes the URL parser read the password as the hostname, and the error you get
   back talks about an unknown host.

This URL is a credential — it contains the password in plain text. Put it in the
host's environment variables, never in a file in the repo. Nothing in this project
prints it: `seed_db.py` deliberately logs only `engine.dialect.name`.

## 2. Prove the seed loader before you point it at anything

`seed_db.py` has a self-test that needs no database and no network — only the
`sqlite3` module Python ships with:

```bash
cd backend
python seed_db.py --selftest
```

It builds `schema.sql` + `seed.sql` twice into in-memory SQLite — once with
`executescript` (exactly what `init_db.py` has always done) and once through the
statement splitter this script uses — and asserts the two databases hold identical
row counts. Then it asserts that every `INSERT OR REPLACE` gains
`ON CONFLICT (id) DO NOTHING`, that no SQLite-only `INSERT OR` clause survives, and
that rewriting twice changes nothing.

Expected tail:

```
SEED LOADER SELFTEST PASSED (15 statements, 8 tables, 15 upserts).
```

Why this step is not optional: the splitter is the risky part. `seed.sql` is full
of prose explanations, and a semicolon or `--` inside a quoted string would cut a
statement in half. That failure does not raise — it loads *most* of the seed and
leaves a half-populated database that looks plausible. The self-test is the only
place that failure is cheap.

Then install the driver and pin it, with the same interpreter that runs the server:

```bash
python -m pip install -r requirements.txt
python -m pip install -r requirements-postgres.txt
python pin_requirements.py --file requirements-postgres.txt --write
```

## 3. Create the tables and load the seed into Postgres

Run this from your own machine, with `DATABASE_URL` set to the Postgres URL, before
deploying anything. Doing it locally means the failure lands in your terminal
rather than in a build log.

```bash
cd backend
# PowerShell:  $env:DATABASE_URL = "postgresql+psycopg://..."
# bash:        export DATABASE_URL="postgresql+psycopg://..."
python seed_db.py --dry-run     # prints the rewritten statements, touches nothing
python seed_db.py               # create_all() + load the seed
```

Expected:

```
Target dialect: postgresql
15 statements to load (rewritten for Postgres)
[OK] Tables created or already present.
[OK] Seed loaded into postgresql.
```

`seed_db.py` is safe to re-run. `DO NOTHING` rather than `DO UPDATE` is on purpose:
re-seeding must not overwrite a row an operator has changed in a live database. The
corollary is that changing `seed.sql` and re-running will **not** update existing
rows — for a real content change, delete the affected rows first, or accept that
seeding only ever fills gaps.

If a statement fails, the script prints its index, the first 400 characters and the
driver's error, then re-raises inside a transaction that rolls back. Two failures
are worth predicting:

- **`relation "..." does not exist`** — `create_all()` did not run, which means
  `app/models/models.py` failed to import. Run `python -c "import app.models.models"`
  and read that traceback instead.
- **a `CHECK` violation on `questions.review_status` or `difficulty`** — the seed
  disagrees with the constraints now mirrored in `models.py`. That is a real
  finding, not a deploy problem: the same insert would have been rejected by SQLite.

## 4. Deploy the backend (Render or Railway)

`render.yaml` at the repo root carries the build and start commands; on Railway type
the same two commands into the dashboard, or let it read `backend/Procfile`. Either
way the essentials are:

- **Root directory:** `backend`. The repo has `backend/` and `frontend/` side by
  side, so without this the build finds no `requirements.txt`.
- **Build:** `pip install -r requirements.txt -r requirements-postgres.txt`
- **Start:** `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  — `python -m`, never bare `uvicorn`; `0.0.0.0` because the platform's router has
  to reach it; `$PORT` because the platform chooses it.
- **Health check path:** `/api/health`

Environment variables:

| Variable | Value | What happens if you get it wrong |
|---|---|---|
| `DEMO_MODE` | `false` | `true` leaves the AI provider mocked and re-permits a CORS wildcard |
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(48))"` | with `DEMO_MODE=false` and no key, the app **refuses to start** — by design |
| `DATABASE_URL` | the `postgresql+psycopg://…` URL from step 1 | unset means it quietly uses a local SQLite file that the platform wipes on every deploy |
| `CORS_ORIGINS` | the exact Vercel origin, e.g. `https://skillsetu.vercel.app` | empty or `*` with `DEMO_MODE=false` is now a **startup error**, not a browser error |
| `AI_PROVIDER` | `anthropic`, `openai`, `mock`, or empty | empty means "decide from `DEMO_MODE` and whichever key is set"; naming a provider whose key is missing falls back to mock |
| `ANTHROPIC_API_KEY` | `sk-ant-…` if you are using Claude | absent while `AI_PROVIDER=anthropic` silently means mocked questions |
| `ANTHROPIC_MODEL` | an ID `python check_anthropic.py` printed | a wrong ID is a 404 the app swallows into `MockAIProvider` |
| `OPENAI_API_KEY` | only if you chose OpenAI instead | see the `openai==3.3.1` caveat below before using this path |

If you set a Claude key, the build command needs one more file:

```
pip install -r requirements.txt -r requirements-postgres.txt -r requirements-anthropic.txt
```

Without it the SDK import fails and the log says
`[AI ERROR] could not start the Anthropic client (ModuleNotFoundError: …)` — the app
keeps serving, from the mock provider.

On the Python version: `requirements.txt` is pinned from Python **3.14.3**, and most
platform images default lower. `render.yaml` asks for 3.12.8, which is the safer
default. If a wheel turns out to be unavailable there, bump the image rather than
unpinning — the pins are the versions the demo has actually run on.

Two notes on what you are exposing. `--host 0.0.0.0` puts the API on the public
internet; every protected route is behind `require_role(...)` with a signed HS256
JWT, so that is intended, but it also means the published demo password now works
from anywhere (step 6). And prefer the Claude path over `OPENAI_API_KEY`: `provider.py`
is written against the OpenAI 1.x client shape while `requirements.txt` pins
`openai==3.3.1`, that path has never been exercised, and its fallback to the mock
provider is silent. The Anthropic path is the one covered by
`backend/test_ai_provider.py` and `backend/check_anthropic.py`.

Before you paste a key into a platform dashboard, prove it locally — once, on your
own machine, so a bad key is a visible error instead of quietly mocked questions:

```bash
cd backend
python -m pip install -r requirements-anthropic.txt
python check_anthropic.py          # lists the model IDs your key can see, then generates
```

That script has no fallback: 401/403 means the key, 404 means the model ID, 429 means
a rate or credit limit. Copy the ID it marks into `ANTHROPIC_MODEL`. To check the
wiring without a key or any spend at all, `python test_ai_provider.py`.

Check it before moving on:

```bash
curl https://YOUR-API.onrender.com/api/health
```

`{"status":"healthy", … "demo_mode":false, "database":"postgresql",
"ai_provider":"anthropic:claude-…"}`. Two fields to read, not one: `database` comes
from the live engine, so `sqlite` there means `DATABASE_URL` never arrived; and
`ai_provider` saying `mock` while you expect Claude is the answer to "why do the
questions look generic" — the key, the SDK or the model ID did not make it.

## 5. Deploy the frontend (Vercel)

Import the repo, set **root directory** to `frontend`, and add exactly one
environment variable:

```
BACKEND_ORIGIN = https://YOUR-API.onrender.com
```

Scheme included, no trailing `/api`, no trailing slash (a trailing slash is
stripped anyway). No `NEXT_PUBLIC_` prefix on purpose: `next.config.js` reads it
while evaluating rewrites, which happens on the server, so the backend URL never
ships in the browser bundle.

This is the step that used to be impossible. `app/lib/api.ts` calls relative paths
(`/api/auth/login`) and `next.config.js` rewrote them to a hardcoded
`http://127.0.0.1:8000` — on Vercel that is the function's own loopback, where
nothing listens. The frontend rendered perfectly and every API call failed.
`NEXT_PUBLIC_API_URL` in the old `.env.example` was never read by any code; it is
now commented out and labelled as such.

Redeploy after setting the variable — Next.js inlines it at build time, so a
variable added to an existing deployment does nothing until the next build.

Then confirm the two halves are actually talking:

```bash
curl https://YOUR-APP.vercel.app/api/health
```

Same JSON as step 4. If this returns Vercel's 404 page while the direct backend
URL works, the rewrite is not picking up `BACKEND_ORIGIN` — check the root
directory and rebuild.

## 6. Before the URL outlives the demo

Everything below is safe to leave alone for a hackathon evaluation on a laptop, and
none of it is safe to leave on a public URL that stays up.

The demo password is published in `README.md`, and `/login` has one-click persona
buttons that submit it. That is inherent to one-click login — the credential has to
be in the client. So: remove the quick-login buttons from
`frontend/app/login/page.tsx`, remove `DEMO_PASSWORD` from
`frontend/app/context/AuthContext.tsx`, and replace the three seeded accounts with
real ones (the seeded PBKDF2 hashes live in `database/seed.sql`; generate new ones
rather than reusing those).

Rotate `SECRET_KEY` at the same time, and treat any key that has ever been in a
file in the repo as burnt — an `ADMIN` token can be forged from it with no
password.

`CORS_ORIGINS` should list only the real frontend origin. With `DEMO_MODE=false`
the app now refuses to start on an empty or wildcard value, so this is enforced
rather than remembered.

Two smaller things, called out so they are decisions rather than oversights.
Uploaded PDFs are written to `backend/uploaded_materials/`, which is ephemeral
local disk on every PaaS — they disappear on redeploy, and object storage is the
real answer if uploads need to persist. And `Base.metadata.create_all()` creates
missing tables but never alters existing ones, so the first schema change after
this deploy needs either a manual `ALTER` or Alembic; `create_all()` will not tell
you it skipped anything.

## 7. Verify the deployed instance the same way you verify the laptop

A green health check only proves the process booted. The assertion that matters is
that the adaptive assessment still behaves like an assessment against Postgres:

```bash
cd backend
python smoke_adaptive.py --base https://YOUR-API.onrender.com --db ./skillsetu.db
```

`--db` stays local on purpose. The script reads correct answers from a SQLite copy
of the seed to build its answer key, and seeded question IDs are fixed literals in
`seed.sql`, so a locally seeded `skillsetu.db` is a valid key for the deployed pool.
Re-seed it first (`python init_db.py`, with uvicorn stopped) — the script refuses to
run against a database that predates the current seed, because a thin pool makes the
ladder substitute difficulties and proves nothing.

What passing means, over real HTTP against the deployed instance: two consecutive
correct answers step the level up and two incorrect step it down, a single answer
moves nothing, served questions never leak `correct_option`, another account cannot
read the session, role targets reach both scoring paths, a fixed-length submission
returns `answer_review` with the explanation for every answer, and — section 7c —
the gap report accounts for every answer given, measures at least `max_questions/3`
competencies on two or more answers, and never lets the top-priority verdict rest on
a single answer unless it is flagged `low_evidence`.

Also worth one manual pass through the UI, since these are the paths the smoke test
does not touch: log in as all three personas, upload a PDF and generate questions
(trainer review should show them `PENDING`), and open the admin analytics page.

## Rollback

The frontend is one click — Vercel keeps previous deployments; promote the last good
one. The backend is the same on Render/Railway via a redeploy of the previous
commit. The database is the part that does not roll back: `seed_db.py` only inserts
and never drops, so a bad deploy leaves data rather than destroying it, but a schema
change made by hand has no undo. Take the Supabase backup before altering anything.








