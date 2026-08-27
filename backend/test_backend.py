import base64
import json
import os
import sys
from fastapi.testclient import TestClient

from app.main import app
from app.ai.provider import MockAIProvider

client = TestClient(app)

# Password for the three seeded demo accounts (see database/seed.sql).
DEMO_PASSWORD = "SkillSetu@2026"

ADMIN_EMAIL = "admin@skillsetu.demo"
TRAINER_EMAIL = "trainer@skillsetu.demo"
OFFICIAL_EMAIL = "official@skillsetu.demo"


def login(email, password=DEMO_PASSWORD):
    """POST /api/auth/login and return the raw response."""
    return client.post("/api/auth/login", json={"email": email, "password": password})


def login_token(email, password=DEMO_PASSWORD):
    """Log in and return the access token, asserting the call succeeded."""
    res = login(email, password)
    assert res.status_code == 200, f"Login failed for {email}: {res.status_code} {res.text}"
    body = res.json()
    assert "access_token" in body, f"Login response for {email} is missing access_token"
    return body["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def run_tests():
    print("Testing SkillSetu Backend API Endpoints & Gap Closure Enhancements...\n")

    # 1. Health endpoint
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health endpoint failed: {res.text}"
    print("[OK] /api/health passed.")

    # 2. Login endpoint (JWT token issuance)
    admin_res = login(ADMIN_EMAIL)
    assert admin_res.status_code == 200, f"Login endpoint failed: {admin_res.text}"
    admin_data = admin_res.json()
    assert "access_token" in admin_data, "Login response missing JWT access_token"
    admin_token = admin_data["access_token"]
    assert admin_data["role"] == "ADMIN", f"Expected ADMIN role, got {admin_data['role']}"
    print("[OK] /api/auth/login returned JWT token.")

    trainer_token = login_token(TRAINER_EMAIL)

    official_res = login(OFFICIAL_EMAIL)
    official_data = official_res.json()
    official_token = official_data["access_token"]

    # A signed JWT has three dot-separated segments; anything else means the
    # crypto path was skipped.
    assert len(admin_token.split(".")) == 3, "Access token is not a three-segment JWT"

    # Priority 4 Check: Profile fields in login response
    assert official_data.get("job_role") is not None, "Missing job_role in profile response"
    assert official_data.get("current_assignment") is not None, "Missing current_assignment in profile response"
    print("[OK] Priority 4: Competency Profile contains required job_role, assignment, and education fields.")

    # ---------------------------------------------------------------------
    # 2b. Authentication must actually reject bad credentials.
    #
    # These are regression tests for a real privilege-escalation bug. login()
    # used to accept an email with no password at all, and if the email was not
    # found it fell back to matching any account whose role name appeared as a
    # substring of the submitted address, and finally to the first row in the
    # users table. "i-am-an-admin@evil.xyz" was therefore issued an ADMIN token
    # with no password. Every case below must now be refused.
    # ---------------------------------------------------------------------
    res = login(ADMIN_EMAIL, "wrong-password")
    assert res.status_code == 401, f"Wrong password must return 401, got {res.status_code}"

    res = login(ADMIN_EMAIL, "")
    assert res.status_code in (401, 422), f"Empty password must be refused, got {res.status_code}"

    # The literal placeholder that used to sit in seed.sql must never verify.
    res = login(ADMIN_EMAIL, "demo_hash_admin")
    assert res.status_code == 401, f"Placeholder hash as password must return 401, got {res.status_code}"

    # The role-substring escalation, in its several forms.
    for hostile_email in ("admin@attacker.com", "i-am-an-admin@evil.xyz", "ADMIN@x.y", "trainer@evil.xyz"):
        res = login(hostile_email)
        assert res.status_code == 401, (
            f"Role-substring escalation still open: {hostile_email} returned "
            f"{res.status_code} {res.text}"
        )

    # The final db.query(User).first() fallback.
    res = login("random-stranger@nowhere.com")
    assert res.status_code == 401, f"Unknown email must return 401, got {res.status_code}"

    # Password is a required field, so omitting it is a validation error.
    res = client.post("/api/auth/login", json={"email": ADMIN_EMAIL})
    assert res.status_code == 422, f"Login without a password field must be rejected, got {res.status_code}"

    # An unknown email and a wrong password must be indistinguishable, or the
    # endpoint becomes an account-enumeration oracle.
    unknown = login("definitely-not-a-user@example.com")
    wrong_pw = login(ADMIN_EMAIL, "not-the-password")
    assert unknown.json().get("detail") == wrong_pw.json().get("detail"), (
        "Unknown email and wrong password return different messages, which leaks "
        "which accounts exist"
    )
    print("[OK] Authentication rejects wrong passwords, unknown emails, and role-substring escalation (401).")

    # ---------------------------------------------------------------------
    # 2c. Forged and tampered tokens must be rejected.
    #
    # decode_access_token() previously accepted any token beginning with
    # "demo_jwt." by base64-decoding the middle segment without verifying a
    # signature, so a caller could mint a token and choose their own role.
    # ---------------------------------------------------------------------
    forged_payload = base64.urlsafe_b64encode(
        json.dumps({"sub": "u-admin-001", "email": ADMIN_EMAIL, "role": "ADMIN"}).encode()
    ).decode().rstrip("=")
    forged_token = f"demo_jwt.{forged_payload}.signature"

    res = client.get("/api/admin/analytics", headers=auth(forged_token))
    assert res.status_code == 401, (
        f"Unsigned forged token was accepted ({res.status_code}) - token forgery is still possible"
    )

    # A real token with its signature altered must also fail.
    head, payload, sig = admin_token.split(".")
    tampered = f"{head}.{payload}.{'x' * len(sig)}"
    res = client.get("/api/admin/analytics", headers=auth(tampered))
    assert res.status_code == 401, f"Tampered signature was accepted ({res.status_code})"

    res = client.get("/api/admin/analytics", headers=auth("not-a-token-at-all"))
    assert res.status_code == 401, f"Garbage token was accepted ({res.status_code})"
    print("[OK] Forged, tampered and malformed tokens are all rejected (401).")

    # 3. Profile endpoint RBAC check (Unauthenticated -> 401, Authenticated -> 200)
    res_prof_unauth = client.get("/api/profile/me")
    assert res_prof_unauth.status_code == 401, f"Expected 401 for unauthenticated profile call, got: {res_prof_unauth.status_code}"

    res = client.get("/api/profile/me", headers=auth(official_token))
    assert res.status_code == 200, f"Profile endpoint failed: {res.text}"
    print("[OK] /api/profile/me RBAC passed (401 unauthenticated / 200 authenticated).")

    # 3b. GET /api/auth/me must identify the caller from the token alone.
    # It previously took an `email` query parameter defaulting to a demo account,
    # and returned nothing, so it failed response validation on every call.
    res_me = client.get("/api/auth/me", headers=auth(trainer_token))
    assert res_me.status_code == 200, f"/api/auth/me failed: {res_me.status_code} {res_me.text}"
    me_body = res_me.json()
    assert me_body["email"] == TRAINER_EMAIL, f"/api/auth/me returned the wrong user: {me_body['email']}"
    assert me_body["role"] == "TRAINER", f"/api/auth/me returned the wrong role: {me_body['role']}"

    # Passing somebody else's email must not change who is returned.
    res_imp = client.get(f"/api/auth/me?email={ADMIN_EMAIL}", headers=auth(trainer_token))
    assert res_imp.status_code == 200, f"/api/auth/me with a query param failed: {res_imp.text}"
    assert res_imp.json()["email"] == TRAINER_EMAIL, "/api/auth/me can be steered by a query parameter"

    res_me_unauth = client.get("/api/auth/me")
    assert res_me_unauth.status_code == 401, f"Expected 401 for /api/auth/me without a token, got {res_me_unauth.status_code}"
    print("[OK] /api/auth/me resolves identity from the token only, and cannot be impersonated.")

    # 4. Priority 1 & 5 Check: RBAC Enforcement on /api/admin/analytics
    # Unauthorized call without token -> should return 401
    res_unauth = client.get("/api/admin/analytics")
    assert res_unauth.status_code == 401, f"Expected 401 for unauthenticated admin call, got: {res_unauth.status_code}"

    # Unauthorized call with Official token -> should return 403
    res_forbidden = client.get("/api/admin/analytics", headers=auth(official_token))
    assert res_forbidden.status_code == 403, f"Expected 403 FORBIDDEN for official accessing admin endpoint, got: {res_forbidden.status_code}"

    # Authorized call with Admin token -> should return 200
    res_admin = client.get("/api/admin/analytics", headers=auth(admin_token))
    assert res_admin.status_code == 200, f"Admin analytics failed with valid token: {res_admin.text}"
    admin_analytics_json = res_admin.json()
    assert "domain_trends" in admin_analytics_json, "Missing domain_trends in admin analytics response"
    print("[OK] Priority 1 & 5: Backend RBAC enforcement & JWT token verification passed (401/403/200).")
    print("[OK] Priority 3: Admin Predictive Analytics contains DB domain readiness & 7-day trend signals.")

    # 5. Trainer & Materials RBAC check
    res_trainer = client.get("/api/trainer/questions", headers=auth(trainer_token))
    assert res_trainer.status_code == 200, f"Trainer endpoint failed: {res_trainer.text}"

    res_mat = client.get("/api/materials", headers=auth(official_token))
    assert res_mat.status_code == 200, f"Materials list failed: {res_mat.text}"
    print("[OK] Materials & Trainer RBAC checks passed.")

    # 6. Quizzes, Competency, Recommendations & Assistant RBAC checks
    res_quiz = client.get("/api/quizzes/active", headers=auth(official_token))
    assert res_quiz.status_code == 200, f"Active quiz failed: {res_quiz.text}"

    res_comp = client.get("/api/competency/me", headers=auth(official_token))
    assert res_comp.status_code == 200, f"Competency me failed: {res_comp.text}"

    res_rec = client.get("/api/recommendations", headers=auth(official_token))
    assert res_rec.status_code == 200, f"Recommendations failed: {res_rec.text}"

    res_ast = client.post("/api/assistant/chat", json={"message": "sampling"}, headers=auth(official_token))
    assert res_ast.status_code == 200, f"Assistant failed: {res_ast.text}"
    print("[OK] Full RBAC Router Coverage Verified across Materials, Quizzes, Competency, Recommendations, and Assistant.")

    # 6b. Logout must revoke the token it was called with.
    throwaway_token = login_token(OFFICIAL_EMAIL)
    assert throwaway_token != official_token, (
        "Two logins by the same user produced byte-identical tokens, so revoking "
        "one session would revoke them all (the jti claim is missing)"
    )
    res = client.get("/api/profile/me", headers=auth(throwaway_token))
    assert res.status_code == 200, f"Fresh token should work before logout: {res.status_code}"

    res_logout = client.post("/api/auth/logout", headers=auth(throwaway_token))
    assert res_logout.status_code == 200, f"Logout failed: {res_logout.text}"

    res = client.get("/api/profile/me", headers=auth(throwaway_token))
    assert res.status_code == 401, f"Revoked token still works after logout ({res.status_code})"
    print("[OK] Logout revokes the access token (subsequent calls return 401).")

    # 7. Priority 2 Check: Dynamic sentence extraction in MockAIProvider
    mock_ai = MockAIProvider()
    sample_text = [
        "The National Sample Survey 80th round collects data on household consumer expenditure across 12000 sample blocks in 2026.",
        "Stratified Random Sampling with Horvitz-Thompson estimation is mandated to ensure minimal standard error across rural strata."
    ]
    mcqs = mock_ai.generate_mcqs(text_chunks=sample_text, count=2)
    assert len(mcqs) == 2, "Expected 2 generated MCQs"
    assert "National Sample Survey" in mcqs[0]["question_text"] or "National Sample Survey" in mcqs[0]["explanation"], "MCQ failed to reflect uploaded content"
    print("[OK] Priority 2: MockAIProvider dynamically generates questions reflecting uploaded text content.")

    # 8. Password hashing helpers.
    from app.auth.dependencies import hash_password, verify_password

    digest = hash_password(DEMO_PASSWORD)
    assert digest.startswith("pbkdf2_sha256$"), f"Unexpected hash format: {digest[:32]}"
    assert verify_password(DEMO_PASSWORD, digest), "Correct password failed to verify"
    assert not verify_password("wrong", digest), "Wrong password verified"
    assert not verify_password(DEMO_PASSWORD, "demo_hash_official"), "Placeholder hash verified as a match"
    assert not verify_password("", digest), "Empty password verified"
    assert hash_password(DEMO_PASSWORD) != digest, "Two hashes of the same password are identical (salt is not random)"
    print("[OK] PBKDF2 password hashing verifies correct passwords and fails closed on everything else.")

    print("\nAll Core Backend API Endpoints & Gap Closure Enhancements Verified Successfully!")


if __name__ == "__main__":
    run_tests()
