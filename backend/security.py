"""Security primitives: PBKDF2-HMAC-SHA256 hashing, HS256 JWT, and sliding-window rate limiting."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from collections import defaultdict, deque


PBKDF2_ITERATIONS = 100_000


def _jwt_secret() -> bytes:
    return os.getenv("JWT_SECRET", "socialconnect-dev-secret-2026").encode("utf-8")


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    """Hash a password with PBKDF2-HMAC-SHA256 and a random 16-byte hex salt."""
    salt_hex = salt or secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt_hex.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return salt_hex, derived.hex()


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    """Verify a password against its stored PBKDF2-HMAC-SHA256 digest in constant time."""
    if not salt or not expected_hash:
        return False
    _, candidate = hash_password(password, salt=salt)
    return hmac.compare_digest(candidate, expected_hash)


def sha256_bytes(data: bytes) -> str:
    """Return hex SHA-256 digest for content-addressed media deduplication."""
    return hashlib.sha256(data).hexdigest()


def create_jwt(user: dict, expires_in: int = 900) -> dict:
    """Issue a signed HS256 JWT token bundle matching the frontend session schema."""
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT", "kid": "scp-py-2026-v1"}
    payload = {
        "sub": user["id"],
        "jti": secrets.token_hex(12),
        "name": user["name"],
        "email": user["email"],
        "picture": user.get("avatar", ""),
        "provider": user.get("provider", "local"),
        "role": user.get("role", "standard_user"),
        "token_ver": 1,
        "iss": "https://auth.socialplatform.io",
        "aud": "scp-web-client",
        "iat": now,
        "exp": now + expires_in,
    }

    encoded_header = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_payload = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    signature = hmac.new(_jwt_secret(), signing_input, hashlib.sha256).digest()
    access_token = f"{encoded_header}.{encoded_payload}.{_b64url_encode(signature)}"

    return {
        "accessToken": access_token,
        "refreshToken": f"rt_{secrets.token_urlsafe(24)}",
        "expiresIn": expires_in,
        "tokenType": "Bearer",
        "decoded": payload,
    }


def verify_jwt(token: str) -> dict | None:
    """Validate an HS256 JWT signature and expiration; return payload or None."""
    if not token or token.count(".") != 2:
        return None
    try:
        encoded_header, encoded_payload, encoded_sig = token.split(".")
        signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
        expected_sig = hmac.new(_jwt_secret(), signing_input, hashlib.sha256).digest()
        provided_sig = _b64url_decode(encoded_sig)
        if not hmac.compare_digest(expected_sig, provided_sig):
            return None
        payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
        if int(payload.get("exp", 0)) <= int(time.time()):
            return None
        return payload
    except Exception:
        return None


class SlidingWindowRateLimiter:
    """Per-key sliding-window rate limiter using a bounded-time deque."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        bucket = self._hits[key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= self.max_requests:
            return False
        bucket.append(now)
        return True
