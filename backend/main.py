"""FastAPI application for SocialConnect: REST API + SQLite + WebSocket gateway."""

from __future__ import annotations

import base64
import json
import re
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from fastapi import (
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .database import (
    DEMO_ADMIN_EMAIL,
    DEMO_ADMIN_ID,
    DEMO_ADMIN_PASSWORD,
    SEED_PROFILES,
    canonical_conversation_key,
    create_notification,
    ensure_user_seed_inbox,
    fetch_active_stories,
    fetch_activity,
    fetch_comments_map,
    fetch_events,
    fetch_following,
    fetch_messages,
    fetch_notifications,
    fetch_posts,
    fetch_saved,
    get_connection,
    init_db,
    is_jti_revoked,
    make_id,
    record_activity,
    revoke_access_jti,
    revoke_user_refresh_tokens,
    rotate_refresh_token,
    store_refresh_token,
    user_row_to_dict,
)
from .ranking import rank_feed, rank_search_results, recommend_creators
from .realtime import ConnectionManager
from .security import (
    SlidingWindowRateLimiter,
    create_jwt,
    hash_password,
    sha256_bytes,
    verify_jwt,
    verify_password,
)

rate_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60)


class SignUpRequest(BaseModel):
    name: str
    email: str
    password: str


class SignInRequest(BaseModel):
    email: str
    password: str
    portal: str = "user"


class OAuthRequest(BaseModel):
    provider: str
    name: str = ""
    email: str = ""
    isSignUp: bool = False


class ResetPasswordRequest(BaseModel):
    email: str


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    username: str | None = None
    bio: str | None = None
    avatar: str | None = None
    interests: list[str] | None = None
    privacy: str | None = None
    onboardingCompleted: bool | None = None


class ToggleActiveRequest(BaseModel):
    active: bool


class CreatePostRequest(BaseModel):
    id: str | None = None
    content: str = ""
    image: str = ""
    tags: list[str] = Field(default_factory=list)
    createdAt: int | None = None


class CreateCommentRequest(BaseModel):
    id: str | None = None
    content: str
    replyingToId: str | None = None


class CreateMessageRequest(BaseModel):
    id: str | None = None
    toUserId: str
    text: str = ""
    audio: str = ""


class RefreshTokenRequest(BaseModel):
    refreshToken: str


class CreateStoryRequest(BaseModel):
    image: str
    caption: str = ""


class MediaUploadRequest(BaseModel):
    dataUrl: str


DATA_URL_RE = re.compile(
    r"^data:(image/(?:png|jpeg|webp|gif)|audio/[\w.+-]+);base64,(.+)$",
    re.IGNORECASE | re.DOTALL,
)
SAFE_MEDIA_FILE_RE = re.compile(r"^[a-f0-9]{20}\.[a-z0-9]+$")


def create_app(db_path=None) -> FastAPI:
    manager = ConnectionManager(db_path=db_path)
    uploads_dir = (
        Path(db_path).parent / "uploads"
        if db_path is not None
        else Path(__file__).resolve().parent / "uploads"
    )

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        init_db(db_path)
        uploads_dir.mkdir(parents=True, exist_ok=True)
        yield

    app = FastAPI(title="SocialConnect API", version="1.0.0", lifespan=lifespan)
    app.state.db_path = db_path
    app.state.manager = manager
    app.state.uploads_dir = uploads_dir

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def _check_rate_limit(request: Request) -> None:
        client_host = request.client.host if request.client else "local"
        if not rate_limiter.allow(client_host):
            raise HTTPException(
                status_code=429,
                detail="Too many authentication attempts. Please wait a moment.",
            )

    def _decode_bearer(authorization: str | None) -> dict:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing bearer token.")
        token = authorization.split(" ", 1)[1].strip()
        payload = verify_jwt(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token.")
        return payload

    def _current_user(authorization: str | None = Header(default=None)) -> dict:
        payload = _decode_bearer(authorization)
        with get_connection(db_path) as conn:
            if is_jti_revoked(conn, payload.get("jti", "")):
                raise HTTPException(status_code=401, detail="Token has been revoked.")
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (payload["sub"],)
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=401, detail="Account no longer exists.")
            user = user_row_to_dict(row)
        if not user["active"]:
            raise HTTPException(
                status_code=403, detail="This account has been deactivated."
            )
        return user

    def _require_admin(user: dict = Depends(_current_user)) -> dict:
        if user["role"] != "admin" or user["id"] != DEMO_ADMIN_ID:
            raise HTTPException(
                status_code=403, detail="Administrator access is required."
            )
        return user

    @app.get("/health")
    def health():
        with get_connection(db_path) as conn:
            users_count = conn.execute("SELECT COUNT(*) AS cnt FROM users").fetchone()[
                "cnt"
            ]
            posts_count = conn.execute("SELECT COUNT(*) AS cnt FROM posts").fetchone()[
                "cnt"
            ]
        return {
            "status": "healthy",
            "service": "SocialConnect Python FastAPI Backend",
            "usersCount": users_count,
            "postsCount": posts_count,
            "connectedSockets": len(manager.socket_user_map),
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }

    @app.get("/api/stats")
    def stats():
        with get_connection(db_path) as conn:
            posts = fetch_posts(conn)
        return {
            "usersOnline": [
                u for u in manager.active_users.values() if u.get("isOnline")
            ],
            "posts": [{"postId": p["id"], "likesCount": p["likes"]} for p in posts],
        }

    @app.post("/api/auth/signup")
    def signup(body: SignUpRequest, request: Request):
        _check_rate_limit(request)
        clean_name = body.name.strip()
        clean_email = body.email.strip().lower()
        if len(clean_name) < 2:
            raise HTTPException(
                status_code=400, detail="Please provide your full name."
            )
        if "@" not in clean_email:
            raise HTTPException(
                status_code=400, detail="Please provide a valid email address."
            )
        if len(body.password) < 6:
            raise HTTPException(
                status_code=400, detail="Password must be at least 6 characters."
            )

        with get_connection(db_path) as conn:
            existing = conn.execute(
                "SELECT id FROM users WHERE lower(email) = ?", (clean_email,)
            ).fetchone()
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail="An account with this email already exists. Please sign in instead.",
                )

            salt, digest = hash_password(body.password)
            user_id = f"usr_{secrets.token_hex(4)}"
            avatar = (
                f"https://api.dicebear.com/7.x/bottts/svg?seed={quote(clean_email)}"
            )
            created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            conn.execute(
                """
                INSERT INTO users (
                    id, name, email, password_hash, password_salt, username, bio,
                    avatar, role, provider, interests, privacy, active, onboarding_completed, created_at
                ) VALUES (?, ?, ?, ?, ?, '', '', ?, 'standard_user', 'local', '[]', 'public', 1, 0, ?)
                """,
                (user_id, clean_name, clean_email, digest, salt, avatar, created_at),
            )
            ensure_user_seed_inbox(conn, user_id)
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()
            user = user_row_to_dict(row)
            jwt_bundle = create_jwt(user)
            store_refresh_token(conn, jwt_bundle["refreshToken"], user["id"])
        return {
            "user": user,
            "jwt": jwt_bundle,
            "authMethod": "email:signup",
            "authenticatedAt": datetime.now(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z"),
        }

    @app.post("/api/auth/signin")
    def signin(body: SignInRequest, request: Request):
        _check_rate_limit(request)
        clean_email = body.email.strip().lower()
        if not clean_email or "@" not in clean_email:
            raise HTTPException(
                status_code=400, detail="Please enter a valid email address."
            )
        if not body.password:
            raise HTTPException(status_code=400, detail="Please enter your password.")

        with get_connection(db_path) as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE lower(email) = ?", (clean_email,)
            ).fetchone()
            if row is None:
                raise HTTPException(
                    status_code=401,
                    detail='No account found with this email. Please click "Create an account" to sign up first.',
                )
            if row["password_hash"] and not verify_password(
                body.password, row["password_salt"], row["password_hash"]
            ):
                raise HTTPException(
                    status_code=401,
                    detail="Incorrect password. Please verify your credentials.",
                )
            if row["active"] == 0:
                raise HTTPException(
                    status_code=403,
                    detail="This account has been deactivated. Contact an administrator.",
                )

            if body.portal == "admin" and (
                row["id"] != DEMO_ADMIN_ID
                or clean_email != DEMO_ADMIN_EMAIL
                or body.password != DEMO_ADMIN_PASSWORD
            ):
                raise HTTPException(
                    status_code=403, detail="Admin portal credentials are required."
                )

            if body.portal != "admin" and row["role"] == "admin":
                raise HTTPException(
                    status_code=403,
                    detail="Select Admin portal mode to sign in as an administrator.",
                )

            conn.execute(
                "UPDATE users SET onboarding_completed = 1 WHERE id = ?", (row["id"],)
            )
            ensure_user_seed_inbox(conn, row["id"])
            refreshed = conn.execute(
                "SELECT * FROM users WHERE id = ?", (row["id"],)
            ).fetchone()
            user = user_row_to_dict(refreshed)
            jwt_bundle = create_jwt(user)
            store_refresh_token(conn, jwt_bundle["refreshToken"], user["id"])
        return {
            "user": user,
            "jwt": jwt_bundle,
            "authMethod": "email:password",
            "authenticatedAt": datetime.now(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z"),
        }

    @app.post("/api/auth/oauth")
    def oauth(body: OAuthRequest, request: Request):
        _check_rate_limit(request)
        provider = body.provider.strip().lower()
        provider_name = provider.capitalize()
        clean_email = (body.email or f"user@{provider}.com").strip().lower()

        with get_connection(db_path) as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE lower(email) = ?", (clean_email,)
            ).fetchone()
            if row is not None:
                conn.execute(
                    "UPDATE users SET onboarding_completed = 1 WHERE id = ?",
                    (row["id"],),
                )
                refreshed = conn.execute(
                    "SELECT * FROM users WHERE id = ?", (row["id"],)
                ).fetchone()
                user = user_row_to_dict(refreshed)
            else:
                user_id = f"usr_{provider[:2]}_{secrets.token_hex(4)}"
                name = body.name.strip() or f"{provider_name} User"
                avatar = f"https://api.dicebear.com/7.x/identicon/svg?seed={quote(provider + str(int(time.time())))}"
                conn.execute(
                    """
                    INSERT INTO users (
                        id, name, email, username, bio, avatar, role, provider,
                        interests, privacy, active, onboarding_completed, created_at
                    ) VALUES (?, ?, ?, '', '', ?, 'verified_user', ?, '[]', 'public', 1, ?, ?)
                    """,
                    (
                        user_id,
                        name,
                        clean_email,
                        avatar,
                        provider,
                        0 if body.isSignUp else 1,
                        datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    ),
                )
                ensure_user_seed_inbox(conn, user_id)
                refreshed = conn.execute(
                    "SELECT * FROM users WHERE id = ?", (user_id,)
                ).fetchone()
                user = user_row_to_dict(refreshed)
            jwt_bundle = create_jwt(user)
            store_refresh_token(conn, jwt_bundle["refreshToken"], user["id"])
        return {
            "user": user,
            "jwt": jwt_bundle,
            "authMethod": f"oauth2:{provider}",
            "authenticatedAt": datetime.now(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z"),
        }

    @app.post("/api/auth/refresh")
    def refresh_session(body: RefreshTokenRequest):
        with get_connection(db_path) as conn:
            rt_row = conn.execute(
                "SELECT user_id FROM refresh_tokens WHERE token = ?",
                (body.refreshToken,),
            ).fetchone()
            if rt_row is None:
                raise HTTPException(status_code=401, detail="Invalid refresh token.")
            user_row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (rt_row["user_id"],)
            ).fetchone()
            if user_row is None or user_row["active"] == 0:
                raise HTTPException(status_code=401, detail="Account is unavailable.")
            user = user_row_to_dict(user_row)
            jwt_bundle = create_jwt(user)
            if not rotate_refresh_token(
                conn, body.refreshToken, jwt_bundle["refreshToken"], user["id"]
            ):
                raise HTTPException(
                    status_code=401, detail="Refresh token expired or already used."
                )
        return {"user": user, "jwt": jwt_bundle}

    @app.post("/api/auth/logout")
    def logout(authorization: str | None = Header(default=None)):
        payload = _decode_bearer(authorization)
        with get_connection(db_path) as conn:
            revoke_access_jti(conn, payload.get("jti", ""), int(payload.get("exp", 0)))
            revoke_user_refresh_tokens(conn, payload["sub"])
        return {"loggedOut": True}

    @app.post("/api/auth/reset-password")
    def reset_password(body: ResetPasswordRequest, request: Request):
        _check_rate_limit(request)
        clean_email = body.email.strip().lower()
        if not clean_email or "@" not in clean_email:
            raise HTTPException(
                status_code=400, detail="Please enter a valid email address."
            )
        return {
            "success": True,
            "message": f"Password reset instructions dispatched to {clean_email}.",
        }

    @app.patch("/api/auth/profile")
    def update_profile(body: ProfileUpdateRequest, user: dict = Depends(_current_user)):
        with get_connection(db_path) as conn:
            updates: list[str] = []
            params: list[str | int] = []
            if body.name is not None:
                updates.append("name = ?")
                params.append(body.name.strip())
            if body.username is not None:
                updates.append("username = ?")
                params.append(body.username.strip().lower())
            if body.bio is not None:
                updates.append("bio = ?")
                params.append(body.bio)
            if body.avatar is not None:
                updates.append("avatar = ?")
                params.append(body.avatar)
            if body.interests is not None:
                updates.append("interests = ?")
                params.append(json.dumps(body.interests))
            if body.privacy is not None:
                updates.append("privacy = ?")
                params.append(body.privacy)
            if body.onboardingCompleted is not None:
                updates.append("onboarding_completed = ?")
                params.append(1 if body.onboardingCompleted else 0)

            if updates:
                params.append(user["id"])
                conn.execute(
                    f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params
                )
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (user["id"],)
            ).fetchone()
            updated_user = user_row_to_dict(row)

        return {"user": updated_user, "jwt": create_jwt(updated_user)}

    @app.get("/api/admin/users")
    def admin_list_users(_admin: dict = Depends(_require_admin)):
        with get_connection(db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM users ORDER BY created_at DESC"
            ).fetchall()
            return {"users": [user_row_to_dict(r) for r in rows]}

    @app.patch("/api/admin/users/{target_id}/active")
    def admin_toggle_active(
        target_id: str,
        body: ToggleActiveRequest,
        _admin: dict = Depends(_require_admin),
    ):
        if target_id == DEMO_ADMIN_ID:
            raise HTTPException(
                status_code=400,
                detail="The seeded admin account cannot be deactivated.",
            )
        with get_connection(db_path) as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (target_id,)
            ).fetchone()
            if row is None:
                raise HTTPException(
                    status_code=404, detail="User account could not be found."
                )
            conn.execute(
                "UPDATE users SET active = ? WHERE id = ?",
                (1 if body.active else 0, target_id),
            )
            updated = conn.execute(
                "SELECT * FROM users WHERE id = ?", (target_id,)
            ).fetchone()
            return {"user": user_row_to_dict(updated)}

    @app.delete("/api/admin/users/{target_id}")
    def admin_delete_user(target_id: str, _admin: dict = Depends(_require_admin)):
        if target_id == DEMO_ADMIN_ID:
            raise HTTPException(
                status_code=400, detail="The seeded admin account cannot be deleted."
            )
        with get_connection(db_path) as conn:
            cur = conn.execute("DELETE FROM users WHERE id = ?", (target_id,))
            if cur.rowcount == 0:
                raise HTTPException(
                    status_code=404, detail="User account could not be found."
                )
        return {"deleted": True}

    @app.get("/api/state")
    def get_state(user: dict = Depends(_current_user)):
        uid = user["id"]
        with get_connection(db_path) as conn:
            ensure_user_seed_inbox(conn, uid)
            raw_posts = fetch_posts(conn, current_user_id=uid)
            following = fetch_following(conn, uid)
            comments = fetch_comments_map(conn, current_user_id=uid)
            events = fetch_events(conn, current_user_id=uid)
            saved = fetch_saved(conn, uid)
            messages = fetch_messages(conn, uid)
            notifications = fetch_notifications(conn, uid)
            activity = fetch_activity(conn, uid)
            stories, seen_stories = fetch_active_stories(conn, current_user_id=uid)

        ranked_posts = rank_feed(
            raw_posts,
            following_ids=set(following),
            user_interests=user.get("interests") or [],
            mode="foryou",
            user_id=uid,
        )
        recommendations = recommend_creators(
            following_ids=set(following),
            user_interests=user.get("interests") or [],
            candidates=SEED_PROFILES,
            limit=4,
        )
        unread_notifications = sum(1 for n in notifications if not n.get("read"))
        return {
            "posts": ranked_posts,
            "comments": comments,
            "events": events,
            "following": following,
            "saved": saved,
            "messages": messages,
            "notifications": notifications,
            "unreadNotifications": unread_notifications,
            "activity": activity,
            "stories": stories,
            "seenStories": seen_stories,
            "recommendations": recommendations,
        }

    @app.get("/api/stories")
    def list_stories(user: dict = Depends(_current_user)):
        with get_connection(db_path) as conn:
            stories, seen_stories = fetch_active_stories(
                conn, current_user_id=user["id"]
            )
        return {"stories": stories, "seenStories": seen_stories}

    @app.post("/api/stories")
    def create_story(body: CreateStoryRequest, user: dict = Depends(_current_user)):
        if not body.image.strip():
            raise HTTPException(status_code=400, detail="Story image is required.")
        now_ms = int(time.time() * 1000)
        expires_at = now_ms + 86_400_000
        handle = user.get("username") or user["email"].split("@")[0]
        group_id = f"st_{user['id']}"
        slide_id = make_id("slide")
        with get_connection(db_path) as conn:
            conn.execute(
                """
                INSERT INTO stories (
                    id, group_id, user_id, user_name, user_handle, user_avatar,
                    image, caption, created_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    slide_id,
                    group_id,
                    user["id"],
                    user["name"],
                    handle,
                    user.get("avatar", ""),
                    body.image.strip(),
                    body.caption.strip(),
                    now_ms,
                    expires_at,
                ),
            )
            record_activity(conn, user["id"])
            stories, seen_stories = fetch_active_stories(
                conn, current_user_id=user["id"]
            )
        return {"stories": stories, "seenStories": seen_stories}

    @app.post("/api/stories/{story_id}/view")
    def mark_story_viewed(story_id: str, user: dict = Depends(_current_user)):
        now_ms = int(time.time() * 1000)
        with get_connection(db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO story_views (group_id, user_id, viewed_at) VALUES (?, ?, ?)",
                (story_id, user["id"], now_ms),
            )
        return {"storyId": story_id, "seen": True}

    @app.get("/api/notifications")
    def list_notifications(user: dict = Depends(_current_user)):
        with get_connection(db_path) as conn:
            items = fetch_notifications(conn, user["id"])
        return {
            "notifications": items,
            "unreadCount": sum(1 for n in items if not n.get("read")),
        }

    @app.post("/api/notifications/read")
    def mark_notifications_read(user: dict = Depends(_current_user)):
        with get_connection(db_path) as conn:
            cur = conn.execute(
                "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
                (user["id"],),
            )
        return {"updated": cur.rowcount}

    @app.post("/api/media/upload")
    def upload_media(body: MediaUploadRequest, _user: dict = Depends(_current_user)):
        match = DATA_URL_RE.match(body.dataUrl.strip())
        if not match:
            raise HTTPException(status_code=400, detail="Unsupported media format.")
        mime = match.group(1).lower()
        b64_data = match.group(2)
        try:
            raw_bytes = base64.b64decode(b64_data, validate=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 payload.")

        max_bytes = 2 * 1024 * 1024 if mime.startswith("image/") else 3 * 1024 * 1024
        if len(raw_bytes) > max_bytes:
            raise HTTPException(
                status_code=400, detail="Media file exceeds maximum allowed size."
            )

        ext_map = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/webp": "webp",
            "image/gif": "gif",
        }
        ext = ext_map.get(mime) or mime.split("/")[-1].split(";")[0].split("+")[0]
        digest = sha256_bytes(raw_bytes)
        filename = f"{digest[:20]}.{ext}"
        uploads_dir.mkdir(parents=True, exist_ok=True)
        target_path = uploads_dir / filename
        if not target_path.exists():
            target_path.write_bytes(raw_bytes)
        return {
            "url": f"/api/media/{filename}",
            "sha256": digest,
            "size": len(raw_bytes),
        }

    @app.get("/api/media/{filename}")
    def get_media(filename: str):
        if not SAFE_MEDIA_FILE_RE.match(filename):
            raise HTTPException(status_code=400, detail="Invalid media filename.")
        target_path = uploads_dir / filename
        if not target_path.is_file():
            raise HTTPException(status_code=404, detail="Media not found.")
        return FileResponse(
            target_path,
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    @app.get("/api/feed")
    def get_feed(mode: str = "foryou", user: dict = Depends(_current_user)):
        uid = user["id"]
        with get_connection(db_path) as conn:
            posts = fetch_posts(conn, current_user_id=uid)
            following = set(fetch_following(conn, uid))
        ranked = rank_feed(
            posts, following, user.get("interests") or [], mode=mode, user_id=uid
        )
        return {"posts": ranked}

    @app.get("/api/search")
    def search_posts(q: str = "", user: dict = Depends(_current_user)):
        with get_connection(db_path) as conn:
            posts = fetch_posts(conn, current_user_id=user["id"])
        return {"posts": rank_search_results(posts, q)}

    @app.post("/api/posts")
    def create_post(body: CreatePostRequest, user: dict = Depends(_current_user)):
        if not body.content.strip() and not body.image:
            raise HTTPException(
                status_code=400, detail="Post content or image is required."
            )
        post_id = body.id or make_id("post")
        now_ms = body.createdAt or int(time.time() * 1000)
        handle = user.get("username") or user["email"].split("@")[0]
        tags = body.tags or user.get("interests") or []

        with get_connection(db_path) as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO posts (
                    id, author_id, author_name, author_handle, author_avatar, author_role,
                    content, image, base_likes, tags, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (
                    post_id,
                    user["id"],
                    user["name"],
                    handle,
                    user.get("avatar", ""),
                    user.get("role", "standard_user"),
                    body.content,
                    body.image,
                    json.dumps(tags),
                    now_ms,
                ),
            )
            record_activity(conn, user["id"])
            posts = fetch_posts(conn, current_user_id=user["id"])
            created = next((p for p in posts if p["id"] == post_id), None)

        return {"post": created}

    @app.post("/api/posts/{post_id}/like")
    def toggle_like(post_id: str, user: dict = Depends(_current_user)):
        uid = user["id"]
        now_ms = int(time.time() * 1000)
        with get_connection(db_path) as conn:
            row = conn.execute(
                "SELECT base_likes, author_id, content FROM posts WHERE id = ?",
                (post_id,),
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Post not found.")
            existing = conn.execute(
                "SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?",
                (post_id, uid),
            ).fetchone()
            if existing:
                conn.execute(
                    "DELETE FROM post_likes WHERE post_id = ? AND user_id = ?",
                    (post_id, uid),
                )
                liked = False
            else:
                conn.execute(
                    "INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)",
                    (post_id, uid, now_ms),
                )
                record_activity(conn, uid)
                snippet = (row["content"] or "")[:36]
                create_notification(
                    conn, row["author_id"], user, f'liked your post: "{snippet}"'
                )
                liked = True
            extra = conn.execute(
                "SELECT COUNT(*) AS cnt FROM post_likes WHERE post_id = ?",
                (post_id,),
            ).fetchone()["cnt"]
        return {
            "postId": post_id,
            "liked": liked,
            "likes": int(row["base_likes"]) + int(extra),
        }

    @app.post("/api/posts/{post_id}/save")
    def toggle_save(post_id: str, user: dict = Depends(_current_user)):
        uid = user["id"]
        now_ms = int(time.time() * 1000)
        with get_connection(db_path) as conn:
            post_exists = conn.execute(
                "SELECT 1 FROM posts WHERE id = ?", (post_id,)
            ).fetchone()
            if post_exists is None:
                raise HTTPException(status_code=404, detail="Post not found.")
            existing = conn.execute(
                "SELECT 1 FROM saved_posts WHERE user_id = ? AND post_id = ?",
                (uid, post_id),
            ).fetchone()
            if existing:
                conn.execute(
                    "DELETE FROM saved_posts WHERE user_id = ? AND post_id = ?",
                    (uid, post_id),
                )
                saved = False
            else:
                conn.execute(
                    "INSERT INTO saved_posts (user_id, post_id, created_at) VALUES (?, ?, ?)",
                    (uid, post_id, now_ms),
                )
                saved = True
        return {"postId": post_id, "saved": saved}

    @app.post("/api/posts/{post_id}/comments")
    def add_comment(
        post_id: str, body: CreateCommentRequest, user: dict = Depends(_current_user)
    ):
        if not body.content.strip():
            raise HTTPException(status_code=400, detail="Comment cannot be empty.")
        comment_id = body.id or make_id("comment")
        now_ms = int(time.time() * 1000)
        handle = user.get("username") or user["email"].split("@")[0]

        with get_connection(db_path) as conn:
            post_row = conn.execute(
                "SELECT author_id FROM posts WHERE id = ?", (post_id,)
            ).fetchone()
            if post_row is None:
                raise HTTPException(status_code=404, detail="Post not found.")
            conn.execute(
                """
                INSERT OR IGNORE INTO comments (
                    id, post_id, parent_id, author_id, author_name, author_handle,
                    author_avatar, content, base_likes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                """,
                (
                    comment_id,
                    post_id,
                    body.replyingToId,
                    user["id"],
                    user["name"],
                    handle,
                    user.get("avatar", ""),
                    body.content.strip(),
                    now_ms,
                ),
            )
            record_activity(conn, user["id"])
            preview = body.content.strip()[:40]
            create_notification(
                conn,
                post_row["author_id"],
                user,
                f'commented on your post: "{preview}"',
            )
            comments = fetch_comments_map(conn, current_user_id=user["id"]).get(
                post_id, []
            )
        return {"postId": post_id, "comments": comments}

    @app.post("/api/comments/{comment_id}/like")
    def toggle_comment_like(comment_id: str, user: dict = Depends(_current_user)):
        uid = user["id"]
        with get_connection(db_path) as conn:
            row = conn.execute(
                "SELECT base_likes FROM comments WHERE id = ?", (comment_id,)
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Comment not found.")
            existing = conn.execute(
                "SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?",
                (comment_id, uid),
            ).fetchone()
            if existing:
                conn.execute(
                    "DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?",
                    (comment_id, uid),
                )
                liked = False
            else:
                conn.execute(
                    "INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)",
                    (comment_id, uid),
                )
                liked = True
            extra = conn.execute(
                "SELECT COUNT(*) AS cnt FROM comment_likes WHERE comment_id = ?",
                (comment_id,),
            ).fetchone()["cnt"]
        return {
            "commentId": comment_id,
            "liked": liked,
            "likes": int(row["base_likes"]) + int(extra),
        }

    @app.delete("/api/comments/{comment_id}")
    def delete_comment(comment_id: str, user: dict = Depends(_current_user)):
        with get_connection(db_path) as conn:
            row = conn.execute(
                "SELECT author_id FROM comments WHERE id = ?", (comment_id,)
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Comment not found.")
            if row["author_id"] != user["id"]:
                raise HTTPException(
                    status_code=403, detail="You can only delete your own comments."
                )
            conn.execute(
                "DELETE FROM comments WHERE id = ? OR parent_id = ?",
                (comment_id, comment_id),
            )
        return {"deleted": True}

    @app.post("/api/users/{target_id}/follow")
    def toggle_follow(target_id: str, user: dict = Depends(_current_user)):
        uid = user["id"]
        now_ms = int(time.time() * 1000)
        with get_connection(db_path) as conn:
            existing = conn.execute(
                "SELECT 1 FROM follows WHERE follower_id = ? AND target_id = ?",
                (uid, target_id),
            ).fetchone()
            if existing:
                conn.execute(
                    "DELETE FROM follows WHERE follower_id = ? AND target_id = ?",
                    (uid, target_id),
                )
                following = False
            else:
                conn.execute(
                    "INSERT INTO follows (follower_id, target_id, created_at) VALUES (?, ?, ?)",
                    (uid, target_id, now_ms),
                )
                record_activity(conn, uid)
                create_notification(conn, target_id, user, "started following you")
                following = True
        return {"targetId": target_id, "following": following}

    @app.post("/api/events/{event_id}/rsvp")
    def toggle_rsvp(event_id: str, user: dict = Depends(_current_user)):
        uid = user["id"]
        with get_connection(db_path) as conn:
            row = conn.execute(
                "SELECT base_attendees FROM events WHERE id = ?", (event_id,)
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Event not found.")
            existing = conn.execute(
                "SELECT 1 FROM event_rsvps WHERE event_id = ? AND user_id = ?",
                (event_id, uid),
            ).fetchone()
            if existing:
                conn.execute(
                    "DELETE FROM event_rsvps WHERE event_id = ? AND user_id = ?",
                    (event_id, uid),
                )
                rsvpd = False
            else:
                conn.execute(
                    "INSERT INTO event_rsvps (event_id, user_id) VALUES (?, ?)",
                    (event_id, uid),
                )
                record_activity(conn, uid)
                rsvpd = True
            extra = conn.execute(
                "SELECT COUNT(*) AS cnt FROM event_rsvps WHERE event_id = ?",
                (event_id,),
            ).fetchone()["cnt"]
        return {
            "eventId": event_id,
            "rsvpd": rsvpd,
            "attendees": int(row["base_attendees"]) + int(extra),
        }

    @app.post("/api/messages")
    def send_message(body: CreateMessageRequest, user: dict = Depends(_current_user)):
        if not body.text.strip() and not body.audio:
            raise HTTPException(
                status_code=400, detail="Message text or audio is required."
            )
        msg_id = body.id or make_id("msg")
        now_ms = int(time.time() * 1000)
        time_label = datetime.now().strftime("%I:%M %p").lstrip("0")
        conv_key = canonical_conversation_key(user["id"], body.toUserId)

        with get_connection(db_path) as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO messages (
                    id, conversation_key, from_user_id, to_user_id, sender_name,
                    text, audio, time_label, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SENT', ?)
                """,
                (
                    msg_id,
                    conv_key,
                    user["id"],
                    body.toUserId,
                    user["name"],
                    body.text.strip(),
                    body.audio,
                    time_label,
                    now_ms,
                ),
            )
            record_activity(conn, user["id"])
            preview = body.text.strip()[:32] or "Voice note"
            create_notification(
                conn, body.toUserId, user, f'sent you a message: "{preview}"'
            )
        return {
            "message": {
                "id": msg_id,
                "fromUserId": user["id"],
                "toUserId": body.toUserId,
                "senderName": user["name"],
                "text": body.text.strip(),
                "audio": body.audio,
                "time": time_label,
                "timestamp": now_ms,
                "status": "SENT",
            }
        }

    @app.post("/api/messages/{partner_id}/read")
    def mark_messages_read(partner_id: str, user: dict = Depends(_current_user)):
        conv_key = canonical_conversation_key(user["id"], partner_id)
        with get_connection(db_path) as conn:
            cur = conn.execute(
                "UPDATE messages SET status = 'READ' WHERE conversation_key = ? AND to_user_id = ? AND status != 'READ'",
                (conv_key, user["id"]),
            )
        return {"updated": cur.rowcount}

    @app.websocket("/ws")
    async def websocket_endpoint(ws: WebSocket):
        await ws.accept()
        try:
            while True:
                data = await ws.receive_json()
                await manager.handle_message(ws, data)
        except WebSocketDisconnect:
            await manager.disconnect(ws)
        except Exception:
            await manager.disconnect(ws)

    return app


app = create_app()
