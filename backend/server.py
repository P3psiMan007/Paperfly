from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, Dict
from pathlib import Path
import logging
import os
import secrets
import string
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
    owned: list[str]


# ---------------- Helpers ----------------
def make_save_code() -> str:
    # 8-char human-friendly (avoid ambiguous chars)
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "-".join(
        "".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(2)
    )


# ---------------- Routes ----------------
@api.get("/")
async def root():
    return {"message": "Mr. Maybe Flight backend", "ok": True}


@api.post("/status", response_model=StatusCheck)
async def create_status_check(body: StatusCheckCreate):
    obj = StatusCheck(client_name=body.client_name)
    await db.status_checks.insert_one(obj.model_dump())
    return obj


@api.get("/status", response_model=list[StatusCheck])
async def list_status_checks():
    docs = await db.status_checks.find({}, {"_id": 0}).limit(100).to_list(100)
    return docs


# -----------------------------------------------------------------
# Stripe checkout for premium skins
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
        "source": "mr_maybe_flight",
    }

    req = CheckoutSessionRequest(
        amount=float(pkg["amount"]),
        currency=pkg["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(req)

    # Record pending transaction
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

    status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(
        session_id
    )

    tx = await db.payment_transactions.find_one(
        {"session_id": session_id}, {"_id": 0}
    )
    skin_id = tx.get("skin_id") if tx else None
    device_id = tx.get("device_id") if tx else None
    already_owned = False

    # Idempotently update transaction + grant skin
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
        # Grant skin to device
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
# Save / restore progression by code
# -----------------------------------------------------------------
@api.post("/save", response_model=SaveCreatedResponse)
async def create_save(body: SaveCreateBody):
    code = make_save_code()
    # Ensure unique code (rare collision)
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
