#!/usr/bin/env python3
"""
Localise the /api/auth/login 500 by running the same code path in-process.

Over HTTP the failure only shows as a bare "Internal Server Error", so this walks
the login path in four widening stages and prints the real traceback for whichever
stage breaks first. Run it with the backend stopped or running, it does not matter.

    python diag_login.py
"""

import sys
import traceback

EMAIL = "official@skillsetu.demo"
PASSWORD = "SkillSetu@2026"


def stage(number, label, fn):
    print("\n--- %d. %s" % (number, label))
    try:
        result = fn()
    except BaseException:
        print("    FAILED. This is the real error:\n")
        traceback.print_exc()
        return None, False
    print("    OK  %s" % ("" if result is None else result))
    return result, True


def main():
    print("Python %s" % sys.version.replace("\n", " "))

    def s1():
        import cryptography
        from cryptography.hazmat.primitives import hashes  # loads the compiled backend
        return "cryptography %s, compiled backend imports" % cryptography.__version__

    def s2():
        from jose import jwt
        token = jwt.encode({"sub": "probe"}, "x" * 48, algorithm="HS256")
        payload = jwt.decode(token, "x" * 48, algorithms=["HS256"])
        return "jose HS256 encode+decode roundtrip, sub=%r" % payload.get("sub")

    def s3():
        from app.auth.dependencies import create_access_token, verify_password
        from app.database import SessionLocal
        from app.models.models import User
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == EMAIL).first()
            if not user:
                raise RuntimeError("no user %s in the database - run init_db.py" % EMAIL)
            if not verify_password(PASSWORD, user.password_hash):
                raise RuntimeError("password does not verify for %s" % EMAIL)
            token = create_access_token({"sub": user.id, "email": user.email,
                                         "role": user.role})
            return "password verifies, token issued (length %d, not printed)" % len(token)
        finally:
            db.close()

    def s4():
        from app.database import SessionLocal
        from app.routers.auth import login
        from app.schemas.schemas import LoginRequest
        db = SessionLocal()
        try:
            res = login(LoginRequest(email=EMAIL, password=PASSWORD), db)
            return "full login() returned role=%s full_name=%r trainings=%d" % (
                res.role, res.full_name, len(res.previous_trainings or []))
        finally:
            db.close()

    def _client():
        # TestClient drives the real ASGI app: routing, request parsing, the
        # response_model serialisation step and every middleware. With
        # raise_server_exceptions=True an unhandled error propagates here with its
        # full traceback, instead of collapsing into a bare 500 body over the wire.
        from fastapi.testclient import TestClient
        from app.main import app
        return TestClient(app, raise_server_exceptions=True)

    def s5():
        r = _client().get("/api/health")
        if r.status_code != 200:
            raise RuntimeError("/api/health returned %s: %s" % (r.status_code, r.text[:500]))
        return "/api/health 200 through the full ASGI stack (so the stack itself is fine)"

    def s6():
        r = _client().post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
        if r.status_code != 200:
            raise RuntimeError("login returned HTTP %s, body: %s"
                               % (r.status_code, r.text[:800]))
        body = r.json()
        return "login 200 through the full ASGI stack, role=%s" % body.get("role")

    stages = [
        ("cryptography compiled backend", s1),
        ("jose HS256 sign + verify", s2),
        ("verify_password + create_access_token against the real DB", s3),
        ("the whole login() function, including UserResponse validation", s4),
        ("GET /api/health through the full ASGI stack", s5),
        ("POST /api/auth/login through the full ASGI stack", s6),
    ]

    for i, (label, fn) in enumerate(stages, start=1):
        _, passed = stage(i, label, fn)
        if not passed:
            print("\nStage %d is the culprit. Everything above it is fine." % i)
            return 1

    print("\nAll six stages passed, including the full ASGI stack. If the running")
    print("uvicorn still 500s, that process is serving older code - stop it with")
    print("Ctrl+C and start it again.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
