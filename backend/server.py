"""Paper Fly backend.

Surface area kept deliberately small post-Stripe-removal:
  POST /api/save           — store a progress blob, return a short code
  GET  /api/save/{code}    — fetch progress by code
  GET  /api/                — health
  POST /api/status         — legacy template (kept for the Emergent harness)
  GET  /api/status         — legacy template

Hardening:
  * 1 MB max request body (CloudFront/Vercel ingresses typically allow much
    more — we cap ourselves so a stray script can't shovel megabytes of
    junk into Mongo via /save).
  * Rate limit: 10 saves/min/IP, 60 fetches/min/IP.
  * Save code: 4-4 with hyphen, uppercase ambiguous-char-free alphabet.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, Dict
from pathlib import Path
import logging
import os
import secrets
from datetime import datetime, timezone

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

MAX_BODY_BYTES = 1 * 1024 * 1024  # 1 MB

app = FastAPI()
api = APIRouter(prefix="/api")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ---------------- Pydantic models ----------------
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: secrets.token_hex(8))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class SaveCreateBody(BaseModel):
    progress: Dict
    # Optional source device id, recorded alongside the save so a future
    # IAP/RevenueCat integration can map purchases to a save code if needed.
    device_id: Optional[str] = None


class SaveCreatedResponse(BaseModel):
    code: str


class SaveFetchResponse(BaseModel):
    progress: Dict


# ---------------- Helpers ----------------
def make_save_code() -> str:
    # 8-char human-friendly (avoid ambiguous chars: 0/O, 1/I/L)
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "-".join(
        "".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(2)
    )


# ---------------- Middleware ----------------
@app.middleware("http")
async def cap_body_size(request: Request, call_next):
    """Reject requests larger than MAX_BODY_BYTES before they touch a handler."""
    cl = request.headers.get("content-length")
    if cl is not None:
        try:
            if int(cl) > MAX_BODY_BYTES:
                return Response(
                    content='{"detail":"Request body too large"}',
                    status_code=413,
                    media_type="application/json",
                )
        except ValueError:
            pass
    return await call_next(request)


# ---------------- Routes ----------------
@api.get("/")
async def root():
    return {"message": "Paper Fly backend", "ok": True}


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
# Save / restore progression by code
# -----------------------------------------------------------------
@api.post("/save", response_model=SaveCreatedResponse)
@limiter.limit("10/minute")
async def create_save(request: Request, body: SaveCreateBody):
    code = make_save_code()
    # Ensure unique code (rare collision)
    while await db.saves.find_one({"code": code}):
        code = make_save_code()
    await db.saves.insert_one(
        {
            "code": code,
            "progress": body.progress,
            "device_id": body.device_id,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return SaveCreatedResponse(code=code)


@api.get("/save/{code}", response_model=SaveFetchResponse)
@limiter.limit("60/minute")
async def fetch_save(request: Request, code: str):
    code = code.upper().strip()
    # Cheap sanity check before hitting Mongo: codes are always 9 chars
    # (4-4 with one hyphen). Anything else is a typo or a probe.
    if len(code) != 9 or code[4] != "-":
        raise HTTPException(404, "Save code not found")
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
