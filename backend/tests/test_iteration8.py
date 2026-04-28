"""Backend tests for Mr. Maybe Flight iteration 8 features:
- Save/restore endpoints
- Owned skins endpoint
- Stripe checkout session creation + status (clean error tolerated for non-real key)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://flying-game-demo-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Health ---
class TestHealth:
    def test_root(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True


# --- Save / Restore ---
class TestSaveRestore:
    def test_save_then_fetch(self, client):
        progress = {
            "xp": 123,
            "bestScore": 42,
            "ownedSkins": ["origami", "skyliner"],
            "equippedSkin": "skyliner",
            "achievements": ["first_flight"],
        }
        r = client.post(f"{API}/save", json={"progress": progress})
        assert r.status_code == 200, r.text
        data = r.json()
        code = data.get("code")
        assert code and isinstance(code, str)
        # Format: 4-4 with hyphen, 9 chars total
        assert len(code) == 9 and code[4] == "-"

        # Fetch
        r2 = client.get(f"{API}/save/{code}")
        assert r2.status_code == 200
        got = r2.json()["progress"]
        assert got["xp"] == 123
        assert got["bestScore"] == 42
        assert "skyliner" in got["ownedSkins"]

    def test_fetch_invalid_code(self, client):
        r = client.get(f"{API}/save/ZZZZ-ZZZZ")
        assert r.status_code == 404

    def test_fetch_lowercase_normalized(self, client):
        progress = {"xp": 5, "bestScore": 0}
        r = client.post(f"{API}/save", json={"progress": progress})
        code = r.json()["code"]
        # backend uppercases
        r2 = client.get(f"{API}/save/{code.lower()}")
        assert r2.status_code == 200
        assert r2.json()["progress"]["xp"] == 5


# --- Owned skins ---
class TestOwnedSkins:
    def test_unknown_device_returns_empty(self, client):
        r = client.get(f"{API}/owned-skins/TEST_unknown_device_xyz")
        assert r.status_code == 200
        assert r.json() == {"owned": []}


# --- Stripe checkout ---
class TestStripeCheckout:
    def test_unknown_skin_400(self, client):
        r = client.post(
            f"{API}/checkout/session",
            json={
                "skin_id": "not_a_skin",
                "device_id": "TEST_dev",
                "origin_url": "https://example.com",
            },
        )
        assert r.status_code == 400

    def test_create_session_aurora_clean_error_or_url(self, client):
        """Stripe key may be a placeholder; we only require:
        - server does NOT 500 with stack trace
        - either returns 200 with url+session_id OR a clean 4xx/5xx with JSON detail
        """
        r = client.post(
            f"{API}/checkout/session",
            json={
                "skin_id": "aurora",
                "device_id": "TEST_dev",
                "origin_url": "https://example.com",
            },
        )
        # Any non-network response acceptable; response must be JSON-decodable
        try:
            body = r.json()
        except Exception:
            pytest.fail(f"Non-JSON response from /checkout/session: {r.status_code} {r.text[:200]}")
        if r.status_code == 200:
            assert body.get("url", "").startswith("http")
            assert body.get("session_id")
        else:
            # Clean error
            assert "detail" in body, f"Unexpected error body: {body}"

    def test_status_unknown_session(self, client):
        r = client.get(f"{API}/checkout/status/cs_test_does_not_exist_xyz")
        # Either Stripe upstream error (4xx/5xx) or 200 with status; must be JSON
        try:
            r.json()
        except Exception:
            pytest.fail(f"Non-JSON response: {r.status_code}")
