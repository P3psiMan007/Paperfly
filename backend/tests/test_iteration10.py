"""Backend tests for iteration 10 — Paper Fly rename + crates/keys + daily leaderboard."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mr-maybe-flight.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- rename ----------
def test_root_says_paper_fly(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    j = r.json()
    assert j.get("message") == "Paper Fly backend"
    assert j.get("ok") is True


# ---------- existing save endpoints still work ----------
def test_save_roundtrip(s):
    payload = {"progress": {"xp": 123, "bestScore": 456, "ownedSkins": ["origami"]}}
    r = s.post(f"{API}/save", json=payload)
    assert r.status_code == 200
    code = r.json()["code"]
    assert isinstance(code, str) and len(code) == 9  # AAAA-AAAA

    r2 = s.get(f"{API}/save/{code}")
    assert r2.status_code == 200
    assert r2.json()["progress"]["xp"] == 123


def test_save_unknown_code_404(s):
    r = s.get(f"{API}/save/XXXX-XXXX")
    assert r.status_code == 404


def test_owned_skins_empty_default(s):
    did = f"TEST_{uuid.uuid4().hex[:8]}"
    r = s.get(f"{API}/owned-skins/{did}")
    assert r.status_code == 200
    assert r.json() == {"owned": []}


# ---------- new consumable IAP ----------
@pytest.mark.parametrize(
    "product_id,expected",
    [("keys_1", 1), ("keys_5", 6), ("keys_10", 12)],
)
def test_verify_consumable_grants(s, product_id, expected):
    did = f"TEST_{uuid.uuid4().hex[:8]}"
    body = {
        "platform": "ios",
        "product_id": product_id,
        "receipt": f"receipt_{uuid.uuid4().hex}",
        "device_id": did,
    }
    r = s.post(f"{API}/iap/verify-consumable", json=body)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["ok"] is True
    assert j["product_id"] == product_id
    assert j["granted"] == expected


def test_verify_consumable_idempotent(s):
    did = f"TEST_{uuid.uuid4().hex[:8]}"
    receipt = f"receipt_{uuid.uuid4().hex}"
    body = {
        "platform": "android",
        "product_id": "keys_5",
        "receipt": receipt,
        "device_id": did,
    }
    r1 = s.post(f"{API}/iap/verify-consumable", json=body)
    r2 = s.post(f"{API}/iap/verify-consumable", json=body)
    assert r1.status_code == 200 and r2.status_code == 200
    # second call must not double-grant
    assert r2.json()["granted"] == 6


def test_verify_consumable_unknown_product(s):
    body = {
        "platform": "ios",
        "product_id": "keys_999",
        "receipt": "r",
        "device_id": "did",
    }
    r = s.post(f"{API}/iap/verify-consumable", json=body)
    assert r.status_code == 400


def test_verify_consumable_bad_platform(s):
    body = {
        "platform": "windows",
        "product_id": "keys_1",
        "receipt": "r",
        "device_id": "did",
    }
    r = s.post(f"{API}/iap/verify-consumable", json=body)
    assert r.status_code == 400


# ---------- non-consumable still works ----------
def test_verify_iap_skin(s):
    did = f"TEST_{uuid.uuid4().hex[:8]}"
    body = {
        "platform": "ios",
        "product_id": "skin_aurora",
        "receipt": f"receipt_{uuid.uuid4().hex}",
        "device_id": did,
    }
    r = s.post(f"{API}/iap/verify", json=body)
    assert r.status_code == 200
    assert r.json() == {"ok": True, "skin_id": "aurora"}

    # verify persisted via /owned-skins
    r2 = s.get(f"{API}/owned-skins/{did}")
    assert r2.status_code == 200
    assert "aurora" in r2.json()["owned"]


# ---------- daily leaderboard ----------
def test_leaderboard_submit_and_list(s):
    seed = f"TEST_seed_{uuid.uuid4().hex[:8]}"
    did_a = f"TEST_{uuid.uuid4().hex[:8]}"
    did_b = f"TEST_{uuid.uuid4().hex[:8]}"

    r = s.post(
        f"{API}/leaderboard/daily",
        json={"name": "Alice", "score": 100, "rings": 5, "seed": seed, "device_id": did_a},
    )
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True
    assert j["rank"] == 1
    assert j["total"] == 1

    r2 = s.post(
        f"{API}/leaderboard/daily",
        json={"name": "Bob", "score": 200, "rings": 8, "seed": seed, "device_id": did_b},
    )
    assert r2.status_code == 200
    j2 = r2.json()
    assert j2["rank"] == 1  # Bob now top
    assert j2["total"] == 2

    lr = s.get(f"{API}/leaderboard/daily/{seed}")
    assert lr.status_code == 200
    body = lr.json()
    assert body["total"] == 2
    scores = [e["score"] for e in body["entries"]]
    assert scores == sorted(scores, reverse=True)
    assert scores[0] == 200
    assert body["entries"][0]["name"] == "Bob"


def test_leaderboard_keeps_best_per_device(s):
    seed = f"TEST_seed_{uuid.uuid4().hex[:8]}"
    did = f"TEST_{uuid.uuid4().hex[:8]}"
    s.post(f"{API}/leaderboard/daily", json={"name": "Solo", "score": 500, "rings": 5, "seed": seed, "device_id": did})
    s.post(f"{API}/leaderboard/daily", json={"name": "Solo", "score": 200, "rings": 2, "seed": seed, "device_id": did})

    lr = s.get(f"{API}/leaderboard/daily/{seed}")
    body = lr.json()
    assert body["total"] == 1
    assert body["entries"][0]["score"] == 500  # best preserved


def test_leaderboard_anonymous_name_fallback(s):
    seed = f"TEST_seed_{uuid.uuid4().hex[:8]}"
    did = f"TEST_{uuid.uuid4().hex[:8]}"
    s.post(f"{API}/leaderboard/daily", json={"name": "  ", "score": 10, "rings": 0, "seed": seed, "device_id": did})
    lr = s.get(f"{API}/leaderboard/daily/{seed}")
    assert lr.json()["entries"][0]["name"] == "Anonymous"


def test_leaderboard_bad_score_rejected(s):
    r = s.post(
        f"{API}/leaderboard/daily",
        json={"name": "Hax", "score": -1, "rings": 0, "seed": "x", "device_id": "x"},
    )
    assert r.status_code == 400

    r2 = s.post(
        f"{API}/leaderboard/daily",
        json={"name": "Hax", "score": 9_999_999, "rings": 0, "seed": "x", "device_id": "x"},
    )
    assert r2.status_code == 400


def test_leaderboard_missing_seed(s):
    r = s.post(
        f"{API}/leaderboard/daily",
        json={"name": "X", "score": 1, "rings": 0, "seed": "", "device_id": "x"},
    )
    assert r.status_code == 400
