from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from pathlib import Path
import logging
import os
import secrets
import hashlib
from datetime import datetime, timezone
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
    CheckoutStatusResponse,
)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

# ---------------------------------------------------------------
# Fixed pricing for premium skins (server-defined to prevent manipulation)
# ---------------------------------------------------------------
PREMIUM_SKINS = {
    "aurora": {"name": "Aurora", "amount": 2.99, "currency": "usd"},
    "phoenix": {"name": "Phoenix", "amount": 2.99, "currency": "usd"},
    "galaxy": {"name": "Galaxy", "amount": 2.99, "currency": "usd"},
}

# Consumable key packs (Apple/Google in-app purchase products)
KEY_PRODUCT_TO_COUNT = {
    "keys_1": 1,
    "keys_5": 6,
    "keys_10": 12,
}

app = FastAPI()
api = APIRouter(prefix="/api")


# ---------------- Pydantic models ----------------
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: secrets.token_hex(8))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class CheckoutCreateBody(BaseModel):
    skin_id: str
    device_id: str
    origin_url: str


class CheckoutCreatedResponse(BaseModel):
    url: str
    session_id: str


class CheckoutStatusResponseModel(BaseModel):
    status: str
    payment_status: str
    skin_id: Optional[str] = None
    already_owned: bool = False


class SaveCreateBody(BaseModel):
    progress: Dict


class SaveCreatedResponse(BaseModel):
    code: str


class SaveFetchResponse(BaseModel):
    progress: Dict


class OwnedSkinsResponse(BaseModel):
    owned: List[str]


# ---------------- Helpers ----------------
def make_save_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "-".join(
        "".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(2)
    )


def hash_receipt(receipt: str) -> str:
    return hashlib.sha256(receipt.encode("utf-8")).hexdigest()


# ---------------- Routes ----------------
@api.get("/")
async def root():
    return {"message": "Paper Fly backend", "ok": True}


@api.post("/status", response_model=StatusCheck)
async def create_status_check(body: StatusCheckCreate):
    obj = StatusCheck(client_name=body.client_name)
    await db.status_checks.insert_one(obj.model_dump())
    return obj


@api.get("/status", response_model=List[StatusCheck])
async def list_status_checks():
    docs = await db.status_checks.find({}, {"_id": 0}).limit(100).to_list(100)
    return docs


# -----------------------------------------------------------------
# Stripe checkout for premium skins (dev / web preview only)
# -----------------------------------------------------------------
@api.post("/checkout/session", response_model=CheckoutCreatedResponse)
async def create_checkout_session(body: CheckoutCreateBody, request: Request):
    if not STRIPE_API_KEY:
        raise HTTPException(500, "Stripe not configured")
    if body.skin_id not in PREMIUM_SKINS:
        raise HTTPException(400, "Unknown skin")

    pkg = PREMIUM_SKINS[body.skin_id]
    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/skins?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/skins?cancelled=1"

    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"

    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    metadata = {
        "skin_id": body.skin_id,
        "device_id": body.device_id,
        "source": "paper_fly",
    }

    req = CheckoutSessionRequest(
        amount=float(pkg["amount"]),
        currency=pkg["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(req)

    await db.payment_transactions.insert_one(
        {
            "session_id": session.session_id,
            "skin_id": body.skin_id,
            "device_id": body.device_id,
            "amount": float(pkg["amount"]),
            "currency": pkg["currency"],
            "status": "initiated",
            "payment_status": "pending",
            "metadata": metadata,
            "created_at": datetime.now(timezone.utc),
        }
    )

    return CheckoutCreatedResponse(url=session.url, session_id=session.session_id)


@api.get("/checkout/status/{session_id}", response_model=CheckoutStatusResponseModel)
async def get_checkout_status(session_id: str, request: Request):
    if not STRIPE_API_KEY:
        raise HTTPException(500, "Stripe not configured")

    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(
            session_id
        )
    except Exception as e:
        msg = str(e)
        if "No such checkout.session" in msg or "not found" in msg.lower():
            raise HTTPException(404, "Checkout session not found")
        raise HTTPException(502, f"Stripe error: {msg}")

    tx = await db.payment_transactions.find_one(
        {"session_id": session_id}, {"_id": 0}
    )
    skin_id = tx.get("skin_id") if tx else None
    device_id = tx.get("device_id") if tx else None
    already_owned = False

    new_status = status.status
    new_payment_status = status.payment_status
    if tx and tx.get("payment_status") != "paid" and new_payment_status == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "status": new_status,
                    "payment_status": new_payment_status,
                    "completed_at": datetime.now(timezone.utc),
                }
            },
        )
        if device_id and skin_id:
            await db.device_skins.update_one(
                {"device_id": device_id},
                {"$addToSet": {"owned": skin_id}},
                upsert=True,
            )
    elif tx:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": new_status, "payment_status": new_payment_status}},
        )

    if device_id and skin_id:
        owned_doc = await db.device_skins.find_one(
            {"device_id": device_id}, {"_id": 0}
        )
        if owned_doc and skin_id in owned_doc.get("owned", []):
            already_owned = True

    return CheckoutStatusResponseModel(
        status=new_status,
        payment_status=new_payment_status,
        skin_id=skin_id,
        already_owned=already_owned,
    )


@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    if not STRIPE_API_KEY:
        return {"ok": False}
    try:
        body = await request.body()
        host_url = str(request.base_url)
        webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(
            api_key=STRIPE_API_KEY, webhook_url=webhook_url
        )
        event = await stripe_checkout.handle_webhook(
            body, request.headers.get("Stripe-Signature")
        )
        if event.payment_status == "paid":
            sid = event.session_id
            md = event.metadata or {}
            skin_id = md.get("skin_id")
            device_id = md.get("device_id")
            tx = await db.payment_transactions.find_one({"session_id": sid})
            if tx and tx.get("payment_status") != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": sid},
                    {
                        "$set": {
                            "payment_status": "paid",
                            "status": "complete",
                            "completed_at": datetime.now(timezone.utc),
                        }
                    },
                )
                if device_id and skin_id:
                    await db.device_skins.update_one(
                        {"device_id": device_id},
                        {"$addToSet": {"owned": skin_id}},
                        upsert=True,
                    )
        return {"ok": True}
    except Exception as e:
        logging.exception("stripe webhook error")
        raise HTTPException(400, str(e))


@api.get("/owned-skins/{device_id}", response_model=OwnedSkinsResponse)
async def get_owned_skins(device_id: str):
    doc = await db.device_skins.find_one({"device_id": device_id}, {"_id": 0})
    return OwnedSkinsResponse(owned=(doc or {}).get("owned", []))


# -----------------------------------------------------------------
# Native IAP receipt verification — Apple StoreKit / Google Play Billing
# -----------------------------------------------------------------
PRODUCT_TO_SKIN = {
    "skin_aurora": "aurora",
    "skin_phoenix": "phoenix",
    "skin_galaxy": "galaxy",
}


class IapVerifyBody(BaseModel):
    platform: str  # "ios" | "android"
    product_id: str
    receipt: str
    device_id: str


class IapVerifyResponse(BaseModel):
    ok: bool
    skin_id: Optional[str] = None


class IapConsumableResponse(BaseModel):
    ok: bool
    product_id: str
    granted: int


@api.post("/iap/verify", response_model=IapVerifyResponse)
async def verify_iap_receipt(body: IapVerifyBody):
    """Non-consumable: premium skin unlock."""
    if body.platform not in ("ios", "android"):
        raise HTTPException(400, "Unsupported platform")
    skin_id = PRODUCT_TO_SKIN.get(body.product_id)
    if not skin_id:
        raise HTTPException(400, "Unknown product_id")
    if not body.receipt:
        raise HTTPException(400, "Missing receipt")

    rhash = hash_receipt(body.receipt)
    await db.iap_receipts.update_one(
        {"platform": body.platform, "receipt_hash": rhash},
        {
            "$set": {
                "platform": body.platform,
                "product_id": body.product_id,
                "device_id": body.device_id,
                "skin_id": skin_id,
                "kind": "non_consumable",
                "verified_at": datetime.now(timezone.utc),
                "verified": True,
            }
        },
        upsert=True,
    )
    await db.device_skins.update_one(
        {"device_id": body.device_id},
        {"$addToSet": {"owned": skin_id}},
        upsert=True,
    )
    return IapVerifyResponse(ok=True, skin_id=skin_id)


@api.post("/iap/verify-consumable", response_model=IapConsumableResponse)
async def verify_iap_consumable(body: IapVerifyBody):
    """Consumable: key pack (e.g. keys_1, keys_5, keys_10)."""
    if body.platform not in ("ios", "android"):
        raise HTTPException(400, "Unsupported platform")
    count = KEY_PRODUCT_TO_COUNT.get(body.product_id)
    if not count:
        raise HTTPException(400, "Unknown product_id")
    if not body.receipt:
        raise HTTPException(400, "Missing receipt")

    rhash = hash_receipt(body.receipt)
    # Idempotent grant: if we've seen this exact receipt before for keys, skip.
    existing = await db.iap_receipts.find_one(
        {"platform": body.platform, "receipt_hash": rhash},
        {"_id": 0, "granted": 1, "kind": 1},
    )
    if existing and existing.get("kind") == "consumable":
        return IapConsumableResponse(
            ok=True, product_id=body.product_id, granted=existing.get("granted", 0)
        )

    await db.iap_receipts.insert_one(
        {
            "platform": body.platform,
            "receipt_hash": rhash,
            "product_id": body.product_id,
            "device_id": body.device_id,
            "kind": "consumable",
            "granted": count,
            "verified_at": datetime.now(timezone.utc),
            "verified": True,
        }
    )
    # Mirror the running key balance on the device record for cross-device sync.
    await db.device_keys.update_one(
        {"device_id": body.device_id},
        {"$inc": {"keys": count}},
        upsert=True,
    )
    return IapConsumableResponse(
        ok=True, product_id=body.product_id, granted=count
    )


# -----------------------------------------------------------------
# Save / restore progression by code
# -----------------------------------------------------------------
@api.post("/save", response_model=SaveCreatedResponse)
async def create_save(body: SaveCreateBody):
    code = make_save_code()
    while await db.saves.find_one({"code": code}):
        code = make_save_code()
    await db.saves.insert_one(
        {
            "code": code,
            "progress": body.progress,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return SaveCreatedResponse(code=code)


@api.get("/save/{code}", response_model=SaveFetchResponse)
async def fetch_save(code: str):
    code = code.upper().strip()
    doc = await db.saves.find_one({"code": code}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Save code not found")
    return SaveFetchResponse(progress=doc["progress"])


# -----------------------------------------------------------------
# Daily Challenge Leaderboard
# -----------------------------------------------------------------
class LeaderboardSubmitBody(BaseModel):
    name: str
    score: int
    rings: int
    seed: str
    device_id: str


class LeaderboardEntry(BaseModel):
    name: str
    score: int
    rings: int
    device_id: str
    created_at: datetime


class LeaderboardListResponse(BaseModel):
    entries: List[LeaderboardEntry]
    total: int


class LeaderboardSubmitResponse(BaseModel):
    ok: bool
    rank: int
    total: int


def _clean_name(name: str) -> str:
    name = (name or "").strip()
    if not name:
        return "Anonymous"
    return name[:20]


@api.post("/leaderboard/daily", response_model=LeaderboardSubmitResponse)
async def submit_daily_score(body: LeaderboardSubmitBody):
    if not body.seed:
        raise HTTPException(400, "Missing seed")
    if body.score < 0 or body.score > 1_000_000:
        raise HTTPException(400, "Score out of range")

    name = _clean_name(body.name)
    now = datetime.now(timezone.utc)
    # Keep only the best score per (seed, device_id)
    existing = await db.daily_leaderboard.find_one(
        {"seed": body.seed, "device_id": body.device_id}, {"_id": 0, "score": 1}
    )
    if not existing or body.score > existing.get("score", 0):
        await db.daily_leaderboard.update_one(
            {"seed": body.seed, "device_id": body.device_id},
            {
                "$set": {
                    "seed": body.seed,
                    "device_id": body.device_id,
                    "name": name,
                    "score": body.score,
                    "rings": body.rings,
                    "created_at": now,
                }
            },
            upsert=True,
        )

    higher = await db.daily_leaderboard.count_documents(
        {"seed": body.seed, "score": {"$gt": body.score}}
    )
    total = await db.daily_leaderboard.count_documents({"seed": body.seed})
    rank = higher + 1
    return LeaderboardSubmitResponse(ok=True, rank=rank, total=total)


@api.get(
    "/leaderboard/daily/{seed}", response_model=LeaderboardListResponse
)
async def get_daily_leaderboard(seed: str, limit: int = 50):
    limit = max(1, min(limit, 100))
    cursor = (
        db.daily_leaderboard.find({"seed": seed}, {"_id": 0})
        .sort("score", -1)
        .limit(limit)
    )
    entries = await cursor.to_list(limit)
    total = await db.daily_leaderboard.count_documents({"seed": seed})
    return LeaderboardListResponse(entries=entries, total=total)


# Mount router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
