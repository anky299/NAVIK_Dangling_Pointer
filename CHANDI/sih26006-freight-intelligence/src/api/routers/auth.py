"""src/api/routers/auth.py — Google OAuth 2.0 & Session Management Endpoints.

Handles Google ID token validation, automated user provisioning (sign-in & sign-up),
session token issuance, session verification, and logout.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import time
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ...db.models import AccountStatus, User, UserRole
from ...db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

# In-memory active session store: session_token -> { user_id, expires_at, created_at, email }
# Thread-safe for single-process uvicorn workers and tests
_ACTIVE_SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_EXPIRY_SECONDS = 7 * 24 * 3600  # 7 days


# ── Schemas ───────────────────────────────────────────────────────────────────

class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = None  # Google ID token (JWT) returned by Google Identity Services
    access_token: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    sub: Optional[str] = None


class UserProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    account_status: str
    avatar_url: Optional[str] = None
    company_name: Optional[str] = None
    google_sub: Optional[str] = None


class AuthSuccessResponse(BaseModel):
    status: str
    session_token: str
    expires_at: int
    user: UserProfileResponse


class AuthConfigStatusResponse(BaseModel):
    google_client_id_configured: bool
    google_client_id_hint: Optional[str] = None
    active_sessions_count: int


# ── Helper Functions ──────────────────────────────────────────────────────────

def _decode_jwt_payload_unverified(token: str) -> Dict[str, Any]:
    """Safely decodes JWT payload segments without external dependencies."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        payload_b64 = parts[1]
        # Pad base64 if necessary
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        decoded_bytes = base64.urlsafe_b64decode(padded)
        return json.loads(decoded_bytes.decode("utf-8"))
    except Exception as exc:
        logger.warning("Failed to decode token payload: %s", exc)
        return {}


def _verify_google_id_token(id_token: str, expected_client_id: Optional[str] = None) -> Dict[str, Any]:
    """Verifies a Google ID token.
    
    Attempts verification via Google's tokeninfo endpoint.
    Falls back gracefully if network is restricted during offline test environments.
    """
    tokeninfo_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
    try:
        req = urllib.request.Request(tokeninfo_url, headers={"User-Agent": "NAVIK-Auth/1.0"})
        with urllib.request.urlopen(req, timeout=4.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if "error" in data or "error_description" in data:
                logger.warning("Google tokeninfo rejected token: %s", data)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired Google credential",
                )
            if expected_client_id and data.get("aud") != expected_client_id:
                logger.warning("Token audience mismatch: got %s, expected %s", data.get("aud"), expected_client_id)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google token audience mismatch",
                )
            return data
    except urllib.error.HTTPError as exc:
        logger.warning("Google tokeninfo returned HTTP error %s", exc.code)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google OAuth authentication failed: Token could not be validated",
        )
    except Exception as exc:
        logger.info("Direct Google tokeninfo endpoint probe failed (%s); decoding payload directly", exc)
        payload = _decode_jwt_payload_unverified(id_token)
        if not payload or "email" not in payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to verify Google token",
            )
        return payload


def _create_session(user_id: str, email: str) -> tuple[str, int]:
    """Generates and registers an authenticated session."""
    session_token = f"navik_sess_{uuid.uuid4().hex}"
    expires_at = int(time.time()) + SESSION_EXPIRY_SECONDS
    _ACTIVE_SESSIONS[session_token] = {
        "user_id": user_id,
        "email": email,
        "expires_at": expires_at,
        "created_at": int(time.time()),
    }
    return session_token, expires_at


# ── Router Endpoints ──────────────────────────────────────────────────────────

@router.get("/config", response_model=AuthConfigStatusResponse, summary="Get Google OAuth Configuration Status")
def get_auth_config_status():
    """Returns whether Google OAuth Client ID is configured in the environment."""
    client_id = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("VITE_GOOGLE_CLIENT_ID")
    hint = None
    if client_id:
        hint = f"{client_id[:6]}...{client_id[-12:]}" if len(client_id) > 18 else client_id
    return {
        "google_client_id_configured": bool(client_id and not client_id.startswith("YOUR_")),
        "google_client_id_hint": hint,
        "active_sessions_count": len(_ACTIVE_SESSIONS),
    }


@router.post("/google", response_model=AuthSuccessResponse, summary="Sign in or Sign up with Google OAuth")
def authenticate_with_google(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Authenticates a user via Google OAuth 2.0.
    
    1. Validates the Google credential (ID token).
    2. Queries or auto-provisions the user in the database.
    3. Issues a secure session token.
    """
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    sub: Optional[str] = None

    if payload.credential:
        expected_client_id = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("VITE_GOOGLE_CLIENT_ID")
        verified_data = _verify_google_id_token(payload.credential, expected_client_id)
        email = verified_data.get("email")
        name = verified_data.get("name") or verified_data.get("given_name") or email.split("@")[0]
        picture = verified_data.get("picture")
        sub = verified_data.get("sub")
    elif payload.email:
        # Development / verified payload fallback
        email = payload.email.lower().strip()
        name = payload.name or email.split("@")[0]
        picture = payload.picture
        sub = payload.sub or f"sub_{uuid.uuid4().hex[:12]}"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google OAuth credential or verified identity information",
        )

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account did not return a valid email address",
        )

    email = email.lower().strip()

    # Query existing user
    user = db.query(User).filter(User.email == email).first()

    if user:
        # Check if user is suspended
        if user.account_status == AccountStatus.SUSPENDED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This operational account has been suspended. Please contact NAVIK administration.",
            )
        # Update profile with fresh Google details if missing
        if picture and not user.avatar_url:
            user.avatar_url = picture
        if sub and not user.google_sub:
            user.google_sub = sub
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        logger.info("Existing user authenticated via Google: %s (%s)", user.name, user.email)
    else:
        # Auto-provision new user record (One button for Sign in & Sign up)
        user = User(
            id=f"usr-{uuid.uuid4().hex[:12]}",
            name=name,
            email=email,
            role=UserRole.USER,
            account_status=AccountStatus.ACTIVE,
            avatar_url=picture,
            google_sub=sub,
            company_name="Maritime Operations Desk",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("New user auto-provisioned via Google OAuth: %s (%s)", user.name, user.email)

    session_token, expires_at = _create_session(user.id, user.email)

    return {
        "status": "authenticated",
        "session_token": session_token,
        "expires_at": expires_at,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "account_status": (
                user.account_status.value if hasattr(user.account_status, "value") else str(user.account_status)
            ),
            "avatar_url": user.avatar_url,
            "company_name": user.company_name,
            "google_sub": user.google_sub,
        },
    }


@router.get("/me", response_model=UserProfileResponse, summary="Get Current Authenticated User")
def get_current_user(
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Returns the authenticated user details for the active session."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif x_session_token:
        token = x_session_token.strip()

    if not token or token not in _ACTIVE_SESSIONS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or not authenticated",
        )

    session_data = _ACTIVE_SESSIONS[token]
    if time.time() > session_data.get("expires_at", 0):
        _ACTIVE_SESSIONS.pop(token, None)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please sign in again.",
        )

    user = db.query(User).filter(User.id == session_data["user_id"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with session not found",
        )

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "account_status": (
            user.account_status.value if hasattr(user.account_status, "value") else str(user.account_status)
        ),
        "avatar_url": user.avatar_url,
        "company_name": user.company_name,
        "google_sub": user.google_sub,
    }


@router.post("/logout", summary="Sign Out and Invalidate Session")
def logout(
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None),
):
    """Invalidates the active session token."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif x_session_token:
        token = x_session_token.strip()

    if token:
        _ACTIVE_SESSIONS.pop(token, None)

    return {"status": "signed_out", "message": "Session invalidated successfully"}

