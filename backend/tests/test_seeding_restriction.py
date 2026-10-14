import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.app.config import settings

def test_seeding_disabled_in_production():
    client = TestClient(app)
    original_env = settings.ENVIRONMENT
    original_allow = settings.ALLOW_SEEDING
    original_admin_key = settings.ADMIN_API_KEY
    try:
        settings.ENVIRONMENT = "production"
        settings.ALLOW_SEEDING = False
        settings.ADMIN_API_KEY = "super-secret-admin-token"

        # 1. Without credentials -> 403 Forbidden
        res = client.post("/api/seed")
        assert res.status_code == 403
        assert "restricted and disabled in production" in res.json()["detail"]

        # 2. With wrong credentials -> 403 Forbidden
        res_wrong = client.post("/api/seed", headers={"X-Admin-Key": "wrong-key"})
        assert res_wrong.status_code == 403

        # 3. With correct X-Admin-Key -> 200 OK
        res_auth = client.post("/api/seed", headers={"X-Admin-Key": "super-secret-admin-token"})
        assert res_auth.status_code == 200
        assert "successfully populated" in res_auth.json()["message"]

        # 4. With correct Authorization Bearer header -> 200 OK
        res_bearer = client.post("/api/seed", headers={"Authorization": "Bearer super-secret-admin-token"})
        assert res_bearer.status_code == 200
    finally:
        settings.ENVIRONMENT = original_env
        settings.ALLOW_SEEDING = original_allow
        settings.ADMIN_API_KEY = original_admin_key


def test_seeding_allowed_in_development():
    client = TestClient(app)
    original_env = settings.ENVIRONMENT
    original_allow = settings.ALLOW_SEEDING
    try:
        settings.ENVIRONMENT = "development"
        settings.ALLOW_SEEDING = True

        res = client.post("/api/seed")
        assert res.status_code == 200
        assert "successfully populated" in res.json()["message"]
    finally:
        settings.ENVIRONMENT = original_env
        settings.ALLOW_SEEDING = original_allow
