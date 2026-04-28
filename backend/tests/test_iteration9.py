"""Iteration 9 final verification — strict no-error pass.

Covers exactly the 7 endpoint scenarios listed in the review request:
  1. POST /api/save -> code (200, 9-char AAAA-AAAA)
  2. GET  /api/save/{code} -> progress (200)
  3. GET  /api/save/UNKNOWN-CODE -> 404 JSON {detail: ...}
  4. POST /api/checkout/session with valid skin -> 200 Stripe URL + session_id
  5. POST /api/checkout/session with unknown skin -> 400 JSON
  6. GET  /api/checkout/status/UNKNOWN_SID -> 404 JSON (was 500 before iter9)
  7. GET  /api/owned-skins/{anyid} -> 200 JSON {owned: []}
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else "https://flying-game-demo-1.preview.emergentagent.com"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Health ---
class TestHealth:
    def test_root_ok(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("ok") is True


# --- Save / Restore ---
class TestSaveRestore:
    saved_code = None

    def test_1_save_create(self, client):
        progress = {"xp": 999, "bestScore": 77, "ownedSkins": ["origami"], "equippedSkin": "origami"}
        r = client.post(f"{API}/save", json={"progress": progress})
        assert r.status_code == 200, r.text
        body = r.json()
        code = body.get("code")
        assert code and len(code) == 9 and code[4] == "-"
        TestSaveRestore.saved_code = code

    def test_2_save_fetch(self, client):
        code = TestSaveRestore.saved_code
        assert code, "No saved_code from previous test"
        r = client.get(f"{API}/save/{code}")
        assert r.status_code == 200
        assert r.json()["progress"]["bestScore"] == 77

    def test_3_save_fetch_unknown_404_json(self, client):
        r = client.get(f"{API}/save/ZZZZ-ZZZZ")
        assert r.status_code == 404
        # Must be valid JSON
        body = r.json()
        assert "detail" in body


# --- Stripe ---
class TestStripeCheckout:
    def test_4_create_session_valid_skin(self, client):
        r = client.post(
            f"{API}/checkout/session",
            json={
                "skin_id": "aurora",
                "device_id": "TEST_iter9_device",
                "origin_url": BASE_URL,
            },
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("url", "").startswith("https://checkout.stripe.com"), f"Unexpected url: {body.get('url')}"
        assert body.get("session_id", "").startswith("cs_")

    def test_5_create_session_unknown_skin_400(self, client):
        r = client.post(
            f"{API}/checkout/session",
            json={
                "skin_id": "not_a_real_skin",
                "device_id": "TEST_iter9_device",
                "origin_url": BASE_URL,
            },
        )
        assert r.status_code == 400
        body = r.json()
        assert "detail" in body

    def test_6_status_unknown_session_returns_404_json(self, client):
        """This was 500 before iter9; now must be a clean 404 JSON."""
        r = client.get(f"{API}/checkout/status/cs_test_does_not_exist_iter9_xyz")
        # Strict: must NOT be 500 plain text
        assert r.status_code != 500, f"Regression — endpoint returned 500: {r.text[:300]}"
        # Must be JSON
        body = r.json()
        assert r.status_code == 404, f"Expected 404, got {r.status_code} body={body}"
        assert "detail" in body


# --- Owned skins ---
class TestOwnedSkins:
    def test_7_owned_skins_unknown_device(self, client):
        r = client.get(f"{API}/owned-skins/TEST_iter9_unknown_device")
        assert r.status_code == 200
        assert r.json() == {"owned": []}
