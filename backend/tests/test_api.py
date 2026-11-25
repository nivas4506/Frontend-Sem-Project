"""Comprehensive pytest suite for the SocialConnect Python backend."""

from __future__ import annotations

import asyncio
import json
import time

from backend.database import (
    DEMO_ADMIN_EMAIL,
    DEMO_ADMIN_PASSWORD,
    canonical_conversation_key,
    init_db,
)
from backend.main import create_app
from backend.ranking import rank_feed, rank_search_results, recommend_creators
from backend.security import (
    SlidingWindowRateLimiter,
    create_jwt,
    hash_password,
    verify_jwt,
    verify_password,
)


async def _asgi_request(
    app, method: str, path: str, body: dict | None = None, token: str | None = None
) -> tuple[int, dict[str, str], bytes]:
    raw_path, _, query = path.partition("?")
    payload = json.dumps(body).encode("utf-8") if body is not None else b""
    headers = [(b"host", b"testserver")]
    if body is not None:
        headers.append((b"content-type", b"application/json"))
        headers.append((b"content-length", str(len(payload)).encode("ascii")))
    if token:
        headers.append((b"authorization", f"Bearer {token}".encode("ascii")))

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": raw_path,
        "raw_path": raw_path.encode("ascii"),
        "query_string": query.encode("ascii"),
        "headers": headers,
        "client": ("127.0.0.1", 50000),
        "server": ("testserver", 80),
    }

    sent_body = False
    status_code = 500
    response_headers: dict[str, str] = {}
    response_chunks: list[bytes] = []

    async def receive():
        nonlocal sent_body
        if not sent_body:
            sent_body = True
            return {"type": "http.request", "body": payload, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        nonlocal status_code
        if message["type"] == "http.response.start":
            status_code = message["status"]
            for k, v in message.get("headers", []):
                response_headers[k.decode("latin-1").lower()] = v.decode("latin-1")
        elif message["type"] == "http.response.body":
            response_chunks.append(message.get("body", b""))

    await app(scope, receive, send)
    return status_code, response_headers, b"".join(response_chunks)


def asgi_raw(
    app, method: str, path: str, body: dict | None = None, token: str | None = None
) -> tuple[int, dict[str, str], bytes]:
    return asyncio.run(_asgi_request(app, method, path, body=body, token=token))


def asgi_json(
    app, method: str, path: str, body: dict | None = None, token: str | None = None
) -> tuple[int, dict]:
    status_code, _headers, raw_bytes = asgi_raw(app, method, path, body=body, token=token)
    raw = raw_bytes.decode("utf-8")
    return status_code, json.loads(raw) if raw else {}


async def _asgi_ws(app, path: str, client_messages: list[dict]) -> list[dict]:
    scope = {
        "type": "websocket",
        "asgi": {"version": "3.0"},
        "scheme": "ws",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": b"",
        "headers": [(b"host", b"testserver")],
        "client": ("127.0.0.1", 50000),
        "server": ("testserver", 80),
    }

    events = [{"type": "websocket.connect"}] + [
        {"type": "websocket.receive", "text": json.dumps(msg)}
        for msg in client_messages
    ]
    index = 0
    received_frames: list[dict] = []

    async def receive():
        nonlocal index
        if index < len(events):
            evt = events[index]
            index += 1
            return evt
        await asyncio.sleep(0.05)
        return {"type": "websocket.disconnect", "code": 1000}

    async def send(message):
        if message["type"] == "websocket.send" and "text" in message:
            received_frames.append(json.loads(message["text"]))

    await app(scope, receive, send)
    return received_frames


def asgi_ws_session(app, path: str, client_messages: list[dict]) -> list[dict]:
    return asyncio.run(_asgi_ws(app, path, client_messages))


def make_test_app(tmp_path):
    db_file = tmp_path / "test_social.db"
    init_db(db_file)
    return create_app(db_path=db_file)


def test_security_primitives():
    salt, digest = hash_password("Secret@123")
    assert verify_password("Secret@123", salt, digest) is True
    assert verify_password("WrongPass", salt, digest) is False

    token_bundle = create_jwt(
        {
            "id": "u1",
            "name": "Alice",
            "email": "alice@example.com",
            "role": "standard_user",
        }
    )
    payload = verify_jwt(token_bundle["accessToken"])
    assert payload is not None
    assert payload["sub"] == "u1"

    tampered = token_bundle["accessToken"][:-4] + "abcd"
    assert verify_jwt(tampered) is None

    limiter = SlidingWindowRateLimiter(max_requests=2, window_seconds=60)
    assert limiter.allow("1.2.3.4") is True
    assert limiter.allow("1.2.3.4") is True
    assert limiter.allow("1.2.3.4") is False


def test_ranking_and_recommendations():
    now = int(time.time() * 1000)
    posts = [
        {
            "id": "old_low",
            "author": {"id": "a1", "name": "A1", "handle": "a1"},
            "content": "Quiet post #general",
            "likes": 2,
            "comments": 0,
            "tags": ["general"],
            "createdAt": now - 24 * 3_600_000,
        },
        {
            "id": "fresh_ai",
            "author": {"id": "s1", "name": "Dr. Sophia Vance", "handle": "sophia_ai"},
            "content": "New neural canvas release #AI #design",
            "likes": 80,
            "comments": 12,
            "tags": ["AI & Machine Learning", "Design & UI/UX"],
            "createdAt": now - 15 * 60_000,
        },
    ]

    for_you = rank_feed(
        posts,
        following_ids={"s1"},
        user_interests=["ai", "design"],
        mode="foryou",
        now_ms=now,
    )
    assert for_you[0]["id"] == "fresh_ai"
    assert for_you[0]["score"] > for_you[1]["score"]

    following_only = rank_feed(
        posts, following_ids={"s1"}, user_interests=[], mode="following", user_id="me"
    )
    assert [p["id"] for p in following_only] == ["fresh_ai"]

    search_hits = rank_search_results(posts, "sophia neural")
    assert len(search_hits) == 1
    assert search_hits[0]["id"] == "fresh_ai"

    recs = recommend_creators(
        following_ids={"s1"},
        user_interests=["design", "ai"],
        candidates=[
            {"id": "s1", "role": "AI Researcher", "mutuals": 10, "topics": ["ai"]},
            {
                "id": "amara",
                "role": "Product Designer",
                "mutuals": 5,
                "topics": ["design"],
            },
            {
                "id": "liam",
                "role": "Indie Game Dev",
                "mutuals": 1,
                "topics": ["gaming"],
            },
        ],
    )
    assert [r["id"] for r in recs] == ["amara", "liam"]


def test_canonical_conversation_key():
    assert canonical_conversation_key("user_a", "s1") == canonical_conversation_key(
        "s1", "user_a"
    )


def test_auth_admin_and_social_endpoints(tmp_path):
    app = make_test_app(tmp_path)

    status, health = asgi_json(app, "GET", "/health")
    assert status == 200
    assert health["status"] == "healthy"

    # Sign up standard user
    status, signup = asgi_json(
        app,
        "POST",
        "/api/auth/signup",
        body={
            "name": "Maya Lin",
            "email": "maya@example.com",
            "password": "Password1!",
        },
    )
    assert status == 200
    user_token = signup["jwt"]["accessToken"]

    # Standard user cannot access admin routes
    status, _ = asgi_json(app, "GET", "/api/admin/users", token=user_token)
    assert status == 403

    # Hydrate full state
    status, state = asgi_json(app, "GET", "/api/state", token=user_token)
    assert status == 200
    assert len(state["posts"]) >= 8

    # Create post, like, save, comment, follow, rsvp, message
    status, created = asgi_json(
        app,
        "POST",
        "/api/posts",
        body={"content": "Hello Python backend! #AI"},
        token=user_token,
    )
    assert status == 200
    post_id = created["post"]["id"]

    status, liked = asgi_json(
        app, "POST", f"/api/posts/{post_id}/like", token=user_token
    )
    assert status == 200 and liked["liked"] is True and liked["likes"] == 1

    status, saved = asgi_json(
        app, "POST", f"/api/posts/{post_id}/save", token=user_token
    )
    assert status == 200 and saved["saved"] is True

    status, commented = asgi_json(
        app,
        "POST",
        f"/api/posts/{post_id}/comments",
        body={"content": "Nice!"},
        token=user_token,
    )
    assert status == 200
    comment_id = commented["comments"][0]["id"]

    status, _ = asgi_json(
        app, "DELETE", f"/api/comments/{comment_id}", token=user_token
    )
    assert status == 200

    status, followed = asgi_json(app, "POST", "/api/users/s1/follow", token=user_token)
    assert status == 200 and followed["following"] is True

    status, rsvp = asgi_json(app, "POST", "/api/events/e1/rsvp", token=user_token)
    assert status == 200 and rsvp["rsvpd"] is True

    status, msg = asgi_json(
        app,
        "POST",
        "/api/messages",
        body={"toUserId": "s1", "text": "Hi Sophia"},
        token=user_token,
    )
    assert status == 200 and msg["message"]["text"] == "Hi Sophia"

    # Admin sign-in and user management
    status, admin_signin = asgi_json(
        app,
        "POST",
        "/api/auth/signin",
        body={
            "email": DEMO_ADMIN_EMAIL,
            "password": DEMO_ADMIN_PASSWORD,
            "portal": "admin",
        },
    )
    assert status == 200
    admin_token = admin_signin["jwt"]["accessToken"]

    status, users_res = asgi_json(app, "GET", "/api/admin/users", token=admin_token)
    assert status == 200
    maya = next(u for u in users_res["users"] if u["email"] == "maya@example.com")

    status, deact = asgi_json(
        app,
        "PATCH",
        f"/api/admin/users/{maya['id']}/active",
        body={"active": False},
        token=admin_token,
    )
    assert status == 200 and deact["user"]["active"] is False

    # Deactivated user cannot sign in
    status, _ = asgi_json(
        app,
        "POST",
        "/api/auth/signin",
        body={"email": "maya@example.com", "password": "Password1!", "portal": "user"},
    )
    assert status == 403

    status, _ = asgi_json(
        app, "DELETE", f"/api/admin/users/{maya['id']}", token=admin_token
    )
    assert status == 200


def test_websocket_realtime_flow(tmp_path):
    app = make_test_app(tmp_path)
    status, signup = asgi_json(
        app,
        "POST",
        "/api/auth/signup",
        body={"name": "WS Tester", "email": "ws@example.com", "password": "Password1!"},
    )
    assert status == 200
    token = signup["jwt"]["accessToken"]
    user = signup["user"]

    frames = asgi_ws_session(
        app,
        "/ws",
        [
            {"type": "auth", "token": token, "user": user},
            {"type": "post:like", "postId": "p1", "action": "like"},
            {
                "type": "message:send",
                "toUserId": "s2",
                "text": "Ping!",
                "tempId": "tmp_1",
            },
        ],
    )

    auth_resp = next(f for f in frames if f.get("type") == "auth:success")
    assert auth_resp["userId"] == user["id"]

    assert any(f.get("type") == "presence:update" for f in frames)

    like_evt = next(f for f in frames if f.get("type") == "post:like_update")
    assert like_evt["postId"] == "p1"
    assert like_evt["likesCount"] == 43

    sent_evt = next(f for f in frames if f.get("type") == "message:sent")
    assert sent_evt["tempId"] == "tmp_1"


def test_stories_notifications_media_search_and_token_lifecycle(tmp_path):
    import base64

    app = make_test_app(tmp_path)

    # Create two users so actions trigger persistent notifications on the author
    status, alice_signup = asgi_json(
        app, "POST", "/api/auth/signup",
        body={"name": "Alice Dev", "email": "alice_dev@example.com", "password": "Password1!"},
    )
    assert status == 200
    alice_token = alice_signup["jwt"]["accessToken"]
    alice_id = alice_signup["user"]["id"]

    status, bob_signup = asgi_json(
        app, "POST", "/api/auth/signup",
        body={"name": "Bob Builder", "email": "bob_b@example.com", "password": "Password1!"},
    )
    assert status == 200
    bob_token = bob_signup["jwt"]["accessToken"]
    bob_refresh = bob_signup["jwt"]["refreshToken"]

    # Bob uploads content-addressed media (twice to verify deduplication)
    sample_png = base64.b64encode(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR").decode("ascii")
    data_url = f"data:image/png;base64,{sample_png}"
    status, up1 = asgi_json(app, "POST", "/api/media/upload", body={"dataUrl": data_url}, token=bob_token)
    status2, up2 = asgi_json(app, "POST", "/api/media/upload", body={"dataUrl": data_url}, token=bob_token)
    assert status == 200 and status2 == 200
    assert up1["url"] == up2["url"] and up1["sha256"] == up2["sha256"]

    status, media_headers, media_bytes = asgi_raw(app, "GET", up1["url"])
    assert status == 200
    assert media_bytes.startswith(b"\x89PNG")
    assert "immutable" in media_headers.get("cache-control", "")

    status, _ = asgi_json(app, "POST", "/api/media/upload", body={"dataUrl": "data:text/plain;base64,SGk="}, token=bob_token)
    assert status == 400

    # Stories CRUD & view tracking
    status, stories_res = asgi_json(app, "GET", "/api/stories", token=bob_token)
    assert status == 200 and len(stories_res["stories"]) >= 7

    status, created_story = asgi_json(
        app, "POST", "/api/stories",
        body={"image": up1["url"], "caption": "My 24h story"},
        token=bob_token,
    )
    assert status == 200
    assert any(s["id"] == f"st_{bob_signup['user']['id']}" for s in created_story["stories"])

    status, viewed = asgi_json(app, "POST", "/api/stories/st_elena/view", token=bob_token)
    assert status == 200 and viewed["seen"] is True

    # Alice posts; Bob likes, comments, and follows Alice -> persistent notifications on Alice
    status, alice_post = asgi_json(
        app, "POST", "/api/posts",
        body={"content": "Exploring FastAPI search ranking #python"},
        token=alice_token,
    )
    assert status == 200
    alice_post_id = alice_post["post"]["id"]

    status, _ = asgi_json(app, "POST", f"/api/posts/{alice_post_id}/like", token=bob_token)
    assert status == 200
    status, _ = asgi_json(app, "POST", f"/api/posts/{alice_post_id}/comments", body={"content": "Great post!"}, token=bob_token)
    assert status == 200
    status, _ = asgi_json(app, "POST", f"/api/users/{alice_id}/follow", token=bob_token)
    assert status == 200

    status, notifs = asgi_json(app, "GET", "/api/notifications", token=alice_token)
    assert status == 200
    assert notifs["unreadCount"] >= 3
    actions_text = " ".join(n["action"] for n in notifs["notifications"])
    assert "started following you" in actions_text
    assert "commented on your post" in actions_text
    assert "liked your post" in actions_text

    status, _ = asgi_json(app, "POST", "/api/notifications/read", token=alice_token)
    assert status == 200
    status, notifs_after = asgi_json(app, "GET", "/api/notifications", token=alice_token)
    assert notifs_after["unreadCount"] == 0

    # Weighted search endpoint
    status, search_res = asgi_json(app, "GET", "/api/search?q=fastapi%20python", token=bob_token)
    assert status == 200
    assert any(p["id"] == alice_post_id for p in search_res["posts"])

    # Refresh token rotation + reuse rejection
    status, rotated = asgi_json(app, "POST", "/api/auth/refresh", body={"refreshToken": bob_refresh})
    assert status == 200
    new_bob_token = rotated["jwt"]["accessToken"]
    assert rotated["jwt"]["refreshToken"] != bob_refresh

    status, _ = asgi_json(app, "POST", "/api/auth/refresh", body={"refreshToken": bob_refresh})
    assert status == 401

    # Logout revokes current access JTI
    status, _ = asgi_json(app, "POST", "/api/auth/logout", token=new_bob_token)
    assert status == 200
    status, _ = asgi_json(app, "GET", "/api/stories", token=new_bob_token)
    assert status == 401


def test_admin_portal_extra_features(tmp_path):
    app = make_test_app(tmp_path)

    # Create a standard user for permission checks & notification broadcast target
    status, member_signup = asgi_json(
        app,
        "POST",
        "/api/auth/signup",
        body={
            "name": "Nina Patel",
            "email": "nina@example.com",
            "password": "Password1!",
        },
    )
    assert status == 200
    member_token = member_signup["jwt"]["accessToken"]

    # Non-admin user must be blocked from extra admin routes
    for path in (
        "/api/admin/overview",
        "/api/admin/posts",
        "/api/admin/stories",
        "/api/admin/events",
        "/api/admin/audit-logs",
    ):
        s, _ = asgi_json(app, "GET", path, token=member_token)
        assert s == 403
    s, _ = asgi_json(
        app,
        "POST",
        "/api/admin/announcements",
        body={"message": "Unauthorized broadcast", "target": "all"},
        token=member_token,
    )
    assert s == 403

    # Sign in as administrator
    status, admin_signin = asgi_json(
        app,
        "POST",
        "/api/auth/signin",
        body={
            "email": DEMO_ADMIN_EMAIL,
            "password": DEMO_ADMIN_PASSWORD,
            "portal": "admin",
        },
    )
    assert status == 200
    admin_token = admin_signin["jwt"]["accessToken"]
    admin_id = admin_signin["user"]["id"]

    # Overview metrics
    status, overview = asgi_json(app, "GET", "/api/admin/overview", token=admin_token)
    assert status == 200
    assert overview["metrics"]["totalUsers"] >= 2
    assert overview["metrics"]["totalPosts"] >= 8
    assert len(overview["recentActivity"]) == 7

    # Create user + duplicate/role validation
    status, created_user_res = asgi_json(
        app,
        "POST",
        "/api/admin/users",
        body={
            "name": "Owen Brooks",
            "email": "owen@example.com",
            "password": "Password1!",
            "role": "verified_user",
        },
        token=admin_token,
    )
    assert status == 200
    owen_id = created_user_res["user"]["id"]
    assert created_user_res["user"]["role"] == "verified_user"

    status, _ = asgi_json(
        app,
        "POST",
        "/api/admin/users",
        body={
            "name": "Owen Dup",
            "email": "owen@example.com",
            "password": "Password1!",
            "role": "standard_user",
        },
        token=admin_token,
    )
    assert status == 409

    status, _ = asgi_json(
        app,
        "POST",
        "/api/admin/users",
        body={
            "name": "Bad Role",
            "email": "badrole@example.com",
            "password": "Password1!",
            "role": "superadmin",
        },
        token=admin_token,
    )
    assert status == 400

    # Role change + protected admin check
    status, promoted = asgi_json(
        app,
        "PATCH",
        f"/api/admin/users/{owen_id}/role",
        body={"role": "moderator"},
        token=admin_token,
    )
    assert status == 200 and promoted["user"]["role"] == "moderator"

    status, _ = asgi_json(
        app,
        "PATCH",
        f"/api/admin/users/{admin_id}/role",
        body={"role": "moderator"},
        token=admin_token,
    )
    assert status == 400

    # Content moderation: list posts/comments, delete comment & post
    status, mod_posts = asgi_json(app, "GET", "/api/admin/posts", token=admin_token)
    assert status == 200 and len(mod_posts["posts"]) >= 8
    target_post = mod_posts["posts"][0]
    first_comment = mod_posts["commentsByPost"].get("p1", [])[0]

    status, del_c = asgi_json(
        app, "DELETE", f"/api/admin/comments/{first_comment['id']}", token=admin_token
    )
    assert status == 200 and del_c["deleted"] is True

    status, del_p = asgi_json(
        app, "DELETE", f"/api/admin/posts/{target_post['id']}", token=admin_token
    )
    assert status == 200 and del_p["deleted"] is True

    # Stories moderation
    status, mod_stories = asgi_json(app, "GET", "/api/admin/stories", token=admin_token)
    assert status == 200 and len(mod_stories["stories"]) >= 1
    first_story_id = mod_stories["stories"][0]["id"]
    status, del_s = asgi_json(
        app, "DELETE", f"/api/admin/stories/{first_story_id}", token=admin_token
    )
    assert status == 200 and del_s["deleted"] is True

    # Events create & delete
    status, created_evt = asgi_json(
        app,
        "POST",
        "/api/admin/events",
        body={
            "title": "Admin Ops Townhall",
            "date": "Dec 12, 2026 • 5:00 PM UTC",
            "location": "Virtual Main Stage",
            "tag": "Operations",
        },
        token=admin_token,
    )
    assert status == 200
    evt_id = created_evt["event"]["id"]

    status, evt_list = asgi_json(app, "GET", "/api/admin/events", token=admin_token)
    assert status == 200 and any(e["id"] == evt_id for e in evt_list["events"])

    status, del_evt = asgi_json(
        app, "DELETE", f"/api/admin/events/{evt_id}", token=admin_token
    )
    assert status == 200 and del_evt["deleted"] is True

    # Broadcast announcement -> delivered to member's persistent notifications
    status, broadcast = asgi_json(
        app,
        "POST",
        "/api/admin/announcements",
        body={"message": "Scheduled maintenance tonight at 02:00 UTC.", "target": "active"},
        token=admin_token,
    )
    assert status == 200 and broadcast["sentCount"] >= 2

    status, member_notifs = asgi_json(app, "GET", "/api/notifications", token=member_token)
    assert status == 200
    assert any("Scheduled maintenance tonight" in n["action"] for n in member_notifs["notifications"])

    # Audit log captures all operations
    status, audit_res = asgi_json(app, "GET", "/api/admin/audit-logs?limit=50", token=admin_token)
    assert status == 200
    actions = {entry["action"] for entry in audit_res["logs"]}
    assert {
        "user.create",
        "user.role_change",
        "comment.delete",
        "post.delete",
        "story.delete",
        "event.create",
        "event.delete",
        "announcement.broadcast",
    }.issubset(actions)

