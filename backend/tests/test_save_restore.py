"""Backend smoke test for the current (post-Stripe) API surface.

Targets a hosted preview URL by default; set EXPO_PUBLIC_BACKEND_URL env
to point at a different host (e.g. http://localhost:8001 when running the
backend locally with `uvicorn server:app --reload`).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://flying-game-demo-1.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestHealth:
    def test_root_ok(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("ok") is True


class TestSaveRestore:
    saved_code = None

    def test_create_save(self, client):
        progress = {
            "xp": 999,
            "bestScore": 77,
            "ownedSkins": ["origami", "skyblue"],
            "equippedSkin": "skyblue",
            "achievements": ["rings_25"],
        }
        r = client.post(
            f"{API}/save",
            json={"progress": progress, "device_id": "TEST-pytest-device"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        code = body.get("code")
        # Format: 4-4 with hyphen, 9 chars total
        assert code and len(code) == 9 and code[4] == "-"
        TestSaveRestore.saved_code = code

    def test_fetch_save(self, client):
        code = TestSaveRestore.saved_code
        assert code, "No saved_code from previous test"
        r = client.get(f"{API}/save/{code}")
        assert r.status_code == 200
        assert r.json()["progress"]["bestScore"] == 77

    def test_fetch_lowercase_normalized(self, client):
        code = TestSaveRestore.saved_code
        r = client.get(f"{API}/save/{code.lower()}")
        assert r.status_code == 200

    def test_unknown_code_returns_404_json(self, client):
        r = client.get(f"{API}/save/ZZZZ-ZZZZ")
        assert r.status_code == 404
        assert "detail" in r.json()

    def test_malformed_code_returns_404_json(self, client):
        # Length / shape mismatch should be rejected before hitting Mongo.
        r = client.get(f"{API}/save/not_a_code")
        assert r.status_code == 404
        assert "detail" in r.json()


class TestPayloadGuards:
    def test_oversized_body_rejected(self, client):
        # 2 MB of junk inside the progress field. Backend caps bodies at 1 MB.
        huge = {"progress": {"noise": "x" * (2 * 1024 * 1024)}}
        r = client.post(f"{API}/save", json=huge)
        assert r.status_code in (413, 400, 422), r.status_code
