import os
import sys
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

def run_tests():
    print("Testing SkillSetu Backend API Endpoints...")

    # 1. Health endpoint
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health endpoint failed: {res.text}"
    print("[OK] /api/health passed.")

    # 2. Login endpoint
    res = client.post("/api/auth/login", json={"email": "official@skillsetu.demo"})
    assert res.status_code == 200, f"Login endpoint failed: {res.text}"
    print("[OK] /api/auth/login passed.")

    # 3. Profile endpoint
    res = client.get("/api/profile/me")
    assert res.status_code == 200, f"Profile endpoint failed: {res.text}"
    print("[OK] /api/profile/me passed.")

    # 4. Materials endpoint
    res = client.get("/api/materials")
    assert res.status_code == 200, f"Materials endpoint failed: {res.text}"
    print("[OK] /api/materials passed.")

    # 5. Quizzes active endpoint
    res = client.get("/api/quizzes/active")
    assert res.status_code == 200, f"Quizzes endpoint failed: {res.text}"
    print("[OK] /api/quizzes/active passed.")

    # 6. Submit Quiz endpoint
    res = client.post("/api/quizzes/active-session/submit", json={
        "answers": [
            {"question_id": "q-001", "selected_option": 1},
            {"question_id": "q-003", "selected_option": 1}
        ]
    })
    assert res.status_code == 200, f"Quiz submit failed: {res.text}"
    print("[OK] /api/quizzes/{id}/submit passed.")

    # 7. Competency endpoint
    res = client.get("/api/competency/me")
    assert res.status_code == 200, f"Competency endpoint failed: {res.text}"
    print("[OK] /api/competency/me passed.")

    # 8. Recommendations endpoint
    res = client.get("/api/recommendations")
    assert res.status_code == 200, f"Recommendations endpoint failed: {res.text}"
    print("[OK] /api/recommendations passed.")

    # 9. Assistant endpoint
    res = client.post("/api/assistant/chat", json={"message": "What is survey sampling?"})
    assert res.status_code == 200, f"Assistant endpoint failed: {res.text}"
    print("[OK] /api/assistant/chat passed.")

    # 10. Admin Analytics endpoint
    res = client.get("/api/admin/analytics")
    assert res.status_code == 200, f"Admin analytics failed: {res.text}"
    print("[OK] /api/admin/analytics passed.")

    print("\nAll 10 Core Backend API Endpoints Passed Successfully!")

if __name__ == "__main__":
    run_tests()
