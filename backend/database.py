"""SQLite persistence layer, schema initialization, and seed data for SocialConnect."""

from __future__ import annotations

import json
import os
import sqlite3
import time
import uuid
from collections.abc import Generator
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path

from .security import hash_password


DEFAULT_DB_PATH = Path(__file__).resolve().parent / "socialconnect.db"

DEMO_ADMIN_ID = "usr_demo_admin"
DEMO_ADMIN_EMAIL = "admin@socialconnect.local"
DEMO_ADMIN_PASSWORD = "Admin@12345"


def get_db_path(db_path: str | Path | None = None) -> Path:
    if db_path is not None:
        return Path(db_path)
    env_path = os.getenv("SCP_DB_PATH")
    return Path(env_path) if env_path else DEFAULT_DB_PATH


@contextmanager
def get_connection(db_path: str | Path | None = None) -> Generator[sqlite3.Connection]:
    path = get_db_path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def canonical_conversation_key(user_a: str, user_b: str) -> str:
    """Deterministic key so both participants map to the same 1:1 thread."""
    return "::".join(sorted([user_a, user_b]))


def format_relative_time(created_ms: int, now_ms: int | None = None) -> str:
    current = now_ms if now_ms is not None else int(time.time() * 1000)
    delta_sec = max(0, int((current - created_ms) / 1000))
    if delta_sec < 60:
        return "Just now"
    if delta_sec < 3600:
        return f"{delta_sec // 60}m ago"
    if delta_sec < 86400:
        return f"{delta_sec // 3600}h ago"
    return f"{delta_sec // 86400}d ago"


SEED_PROFILES = [
    {
        "id": "s1",
        "name": "Dr. Sophia Vance",
        "handle": "sophia_ai",
        "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
        "role": "AI Researcher",
        "mutuals": 4,
        "topics": ["ai", "code"],
    },
    {
        "id": "s2",
        "name": "Mateo Rossi",
        "handle": "mateorossi",
        "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
        "role": "Systems Architect",
        "mutuals": 2,
        "topics": ["code", "crypto"],
    },
    {
        "id": "elena_r",
        "name": "Elena Rostova",
        "handle": "elena_r",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        "role": "Verified Creator",
        "mutuals": 3,
        "topics": ["design", "ai"],
    },
    {
        "id": "kaito",
        "name": "Kaito Tanaka",
        "handle": "kaito_dev",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
        "role": "Photographer",
        "mutuals": 3,
        "topics": ["photo", "travel"],
    },
    {
        "id": "amara",
        "name": "Amara Okafor",
        "handle": "amara.designs",
        "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
        "role": "Product Designer",
        "mutuals": 5,
        "topics": ["design"],
    },
    {
        "id": "liam",
        "name": "Liam Carter",
        "handle": "liamcodes",
        "avatar": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
        "role": "Indie Game Dev",
        "mutuals": 1,
        "topics": ["gaming", "code"],
    },
    {
        "id": "noah",
        "name": "Noah Kim",
        "handle": "noah.travels",
        "avatar": "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
        "role": "Travel Creator",
        "mutuals": 2,
        "topics": ["travel", "photo"],
    },
    {
        "id": "zara",
        "name": "Zara Malik",
        "handle": "zara.sound",
        "avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
        "role": "Music Producer",
        "mutuals": 6,
        "topics": ["music"],
    },
]


def _seed_posts_data(now_ms: int) -> list[dict]:
    minute = 60_000
    hour = 3_600_000
    return [
        {
            "id": "p1",
            "author": {**SEED_PROFILES[2], "role": "verified_user"},
            "content": "Just launched the beta of our neural design canvas! 🚀 Built with WebGL shaders and real-time collaborative websockets. Feedback is welcome!",
            "image": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
            "base_likes": 42,
            "tags": ["AI & Machine Learning", "Design & UI/UX"],
            "created_at": now_ms - 25 * minute,
        },
        {
            "id": "p2",
            "author": {**SEED_PROFILES[3], "role": "standard_user"},
            "content": "Morning photography walk in Kyoto. The atmospheric fog through the bamboo forest is unbelievable today.",
            "image": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80",
            "base_likes": 89,
            "tags": ["Photography & Film", "Travel & Expeditions"],
            "created_at": now_ms - 2 * hour,
        },
        {
            "id": "p3",
            "author": {**SEED_PROFILES[6], "role": "verified_user"},
            "content": "Found a hidden beach in the Azores after a 2 hour hike. Totally worth every step 🌊 #travel #azores",
            "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&auto=format&fit=crop&q=80",
            "base_likes": 1204,
            "tags": ["Travel & Expeditions"],
            "created_at": now_ms - 3 * hour,
        },
        {
            "id": "p4",
            "author": {**SEED_PROFILES[0], "role": "verified_user"},
            "content": "Hot take: the best AI products of 2026 will feel invisible. No chat box, no prompt — just software that quietly gets out of your way. #AI",
            "image": "",
            "base_likes": 318,
            "tags": ["AI & Machine Learning"],
            "created_at": now_ms - 4 * hour,
        },
        {
            "id": "p5",
            "author": {**SEED_PROFILES[5], "role": "standard_user"},
            "content": "Our indie roguelike just crossed 10,000 wishlists! 🎮 Thank you all — demo drops next month. #indiedev #gamedev",
            "image": "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=900&auto=format&fit=crop&q=80",
            "base_likes": 642,
            "tags": ["Gaming & Interactive"],
            "created_at": now_ms - 6 * hour,
        },
        {
            "id": "p6",
            "author": {**SEED_PROFILES[4], "role": "standard_user"},
            "content": "Spent the weekend rebuilding our design system from scratch. 48 components, one source of truth, zero regrets ✨ #design #uiux",
            "image": "",
            "base_likes": 276,
            "tags": ["Design & UI/UX"],
            "created_at": now_ms - 8 * hour,
        },
        {
            "id": "p7",
            "author": {**SEED_PROFILES[7], "role": "verified_user"},
            "content": "New track drops Friday. Recorded the whole thing on analog gear in one night 🎧 #music #producer",
            "image": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=900&auto=format&fit=crop&q=80",
            "base_likes": 935,
            "tags": ["Music & Audio"],
            "created_at": now_ms - 10 * hour,
        },
        {
            "id": "p8",
            "author": {**SEED_PROFILES[3], "role": "standard_user"},
            "content": "Sunrise above the clouds. Some mornings make the 4am alarm completely worth it ⛰️ #photography",
            "image": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&auto=format&fit=crop&q=80",
            "base_likes": 2310,
            "tags": ["Photography & Film"],
            "created_at": now_ms - 24 * hour,
        },
    ]


def init_db(db_path: str | Path | None = None) -> None:
    with get_connection(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                password_salt TEXT,
                username TEXT,
                bio TEXT DEFAULT '',
                avatar TEXT DEFAULT '',
                role TEXT NOT NULL DEFAULT 'standard_user',
                provider TEXT NOT NULL DEFAULT 'local',
                interests TEXT NOT NULL DEFAULT '[]',
                privacy TEXT NOT NULL DEFAULT 'public',
                active INTEGER NOT NULL DEFAULT 1,
                onboarding_completed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                author_id TEXT NOT NULL,
                author_name TEXT NOT NULL,
                author_handle TEXT NOT NULL,
                author_avatar TEXT NOT NULL,
                author_role TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                image TEXT NOT NULL DEFAULT '',
                base_likes INTEGER NOT NULL DEFAULT 0,
                tags TEXT NOT NULL DEFAULT '[]',
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS post_likes (
                post_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (post_id, user_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS saved_posts (
                user_id TEXT NOT NULL,
                post_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, post_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL,
                parent_id TEXT,
                author_id TEXT NOT NULL,
                author_name TEXT NOT NULL,
                author_handle TEXT NOT NULL,
                author_avatar TEXT NOT NULL,
                content TEXT NOT NULL,
                base_likes INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS comment_likes (
                comment_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                PRIMARY KEY (comment_id, user_id),
                FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS follows (
                follower_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (follower_id, target_id)
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_key TEXT NOT NULL,
                from_user_id TEXT NOT NULL,
                to_user_id TEXT NOT NULL,
                sender_name TEXT NOT NULL,
                text TEXT NOT NULL,
                audio TEXT NOT NULL DEFAULT '',
                time_label TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'SENT',
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                date_label TEXT NOT NULL,
                location TEXT NOT NULL,
                base_attendees INTEGER NOT NULL DEFAULT 0,
                tag TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS event_rsvps (
                event_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                PRIMARY KEY (event_id, user_id),
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                actor_id TEXT NOT NULL,
                name TEXT NOT NULL,
                handle TEXT NOT NULL,
                avatar TEXT NOT NULL,
                action TEXT NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS stories (
                id TEXT PRIMARY KEY,
                group_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                user_name TEXT NOT NULL,
                user_handle TEXT NOT NULL,
                user_avatar TEXT NOT NULL,
                image TEXT NOT NULL,
                caption TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS story_views (
                group_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                viewed_at INTEGER NOT NULL,
                PRIMARY KEY (group_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS refresh_tokens (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                revoked INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS revoked_tokens (
                jti TEXT PRIMARY KEY,
                expires_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS activity_log (
                user_id TEXT NOT NULL,
                day TEXT NOT NULL,
                count INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, day)
            );

            CREATE TABLE IF NOT EXISTS admin_audit_logs (
                id TEXT PRIMARY KEY,
                admin_id TEXT NOT NULL,
                admin_name TEXT NOT NULL,
                action TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                details TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_key, created_at);
            CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at, created_at);
            CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs(created_at DESC);
            """
        )
        try:
            conn.execute("ALTER TABLE notifications ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        seed_database(conn)


def seed_database(conn: sqlite3.Connection) -> None:
    now_ms = int(time.time() * 1000)

    # Seed protected admin account with PBKDF2-HMAC-SHA256 hash
    admin_row = conn.execute("SELECT id FROM users WHERE id = ?", (DEMO_ADMIN_ID,)).fetchone()
    if admin_row is None:
        salt, digest = hash_password(DEMO_ADMIN_PASSWORD)
        conn.execute(
            """
            INSERT INTO users (
                id, name, email, password_hash, password_salt, username,
                bio, avatar, role, provider, interests, privacy, active,
                onboarding_completed, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                DEMO_ADMIN_ID,
                "Platform Administrator",
                DEMO_ADMIN_EMAIL,
                digest,
                salt,
                "admin",
                "SocialConnect administrator",
                "https://api.dicebear.com/7.x/initials/svg?seed=Admin",
                "admin",
                "local",
                json.dumps(["ai", "code"]),
                "public",
                1,
                1,
                datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            ),
        )

    # Seed posts p1..p8
    for item in _seed_posts_data(now_ms):
        conn.execute(
            """
            INSERT OR IGNORE INTO posts (
                id, author_id, author_name, author_handle, author_avatar, author_role,
                content, image, base_likes, tags, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item["id"],
                item["author"]["id"],
                item["author"]["name"],
                item["author"]["handle"],
                item["author"]["avatar"],
                item["author"]["role"],
                item["content"],
                item["image"],
                item["base_likes"],
                json.dumps(item["tags"]),
                item["created_at"],
            ),
        )

    # Seed comments for p1 and p2
    seed_comments = [
        (
            "c1", "p1", None, SEED_PROFILES[0]["id"], SEED_PROFILES[0]["name"],
            SEED_PROFILES[0]["handle"], SEED_PROFILES[0]["avatar"],
            "The fluid wave mathematics in this canvas are exceptional. Are you doing the raymarching pass entirely in fragment shaders?",
            6, now_ms - 18 * 60_000,
        ),
        (
            "c1_r1", "p1", "c1", SEED_PROFILES[2]["id"], SEED_PROFILES[2]["name"],
            SEED_PROFILES[2]["handle"], SEED_PROFILES[2]["avatar"],
            "Thank you Sophia! It runs on WebGL2 fragment shaders to keep the experience fluid on mobile GPUs.",
            0, now_ms - 12 * 60_000,
        ),
        (
            "c2", "p1", None, SEED_PROFILES[1]["id"], SEED_PROFILES[1]["name"],
            SEED_PROFILES[1]["handle"], SEED_PROFILES[1]["avatar"],
            "Tested the collaborative cursor sync on our local cluster. Sub-30ms round-trip latency over the WebSocket gateway. Huge milestone! 🚀",
            4, now_ms - 8 * 60_000,
        ),
        (
            "c3", "p2", None, SEED_PROFILES[2]["id"], SEED_PROFILES[2]["name"],
            SEED_PROFILES[2]["handle"], SEED_PROFILES[2]["avatar"],
            "The depth of field and misty atmospheric gradient is stunning Kaito. Which focal length did you shoot this with?",
            8, now_ms - 60 * 60_000,
        ),
        (
            "c3_r1", "p2", "c3", SEED_PROFILES[3]["id"], SEED_PROFILES[3]["name"],
            SEED_PROFILES[3]["handle"], SEED_PROFILES[3]["avatar"],
            "35mm f/1.4 wide open with a diffusion filter to soften the bamboo forest highlights!",
            0, now_ms - 45 * 60_000,
        ),
    ]
    for c in seed_comments:
        conn.execute(
            """
            INSERT OR IGNORE INTO comments (
                id, post_id, parent_id, author_id, author_name, author_handle,
                author_avatar, content, base_likes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            c,
        )

    # Seed events
    seed_events = [
        ("e1", "Global Social Architecture Summit 2026", "Sept 24, 2026 • 6:00 PM UTC", "Virtual Auditorium & London Studio", 342, "Engineering"),
        ("e2", "Interactive UI & Creative Coding Showcase", "Oct 02, 2026 • 7:30 PM UTC", "San Francisco, CA & Stream", 512, "Design"),
    ]
    for ev in seed_events:
        conn.execute(
            """
            INSERT OR IGNORE INTO events (id, title, date_label, location, base_attendees, tag)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ev,
        )

    # Seed 24-hour stories matching src/data.js
    hour = 3_600_000
    minute = 60_000
    ttl = 24 * hour
    shot = lambda pid: f"https://images.unsplash.com/{pid}?w=900&auto=format&fit=crop&q=80"
    seed_stories = [
        ("st_elena_1", "st_elena", SEED_PROFILES[2], shot("photo-1618005182384-a83a8bd57fbe"), "Neural canvas beta is live 🚀", now_ms - hour),
        ("st_elena_2", "st_elena", SEED_PROFILES[2], shot("photo-1488590528505-98d2b5aba04b"), "Late night shader tuning", now_ms - 45 * minute),
        ("st_kaito_1", "st_kaito", SEED_PROFILES[3], shot("photo-1503899036084-c55cdd92da26"), "Kyoto mornings 🌫️", now_ms - 2 * hour),
        ("st_noah_1", "st_noah", SEED_PROFILES[6], shot("photo-1507525428034-b723cf961d3e"), "Found paradise in the Azores", now_ms - 3 * hour),
        ("st_noah_2", "st_noah", SEED_PROFILES[6], shot("photo-1501785888041-af3ef285b470"), "Next stop: the lakes", now_ms - 2 * hour),
        ("st_zara_1", "st_zara", SEED_PROFILES[7], shot("photo-1470225620780-dba8ba36b745"), "Studio session — new track Friday 🎧", now_ms - 4 * hour),
        ("st_liam_1", "st_liam", SEED_PROFILES[5], shot("photo-1542751371-adc38448a05e"), "Playtest night 🎮", now_ms - 5 * hour),
        ("st_sophia_1", "st_sophia", SEED_PROFILES[0], shot("photo-1517694712202-14dd9538aa97"), "Paper draft #3 done ✍️", now_ms - 6 * hour),
        ("st_amara_1", "st_amara", SEED_PROFILES[4], shot("photo-1506905925346-21bda4d32df4"), "Weekend reset ⛰️", now_ms - 8 * hour),
    ]
    for sid, gid, profile, image, caption, created_at in seed_stories:
        conn.execute(
            """
            INSERT OR IGNORE INTO stories (
                id, group_id, user_id, user_name, user_handle, user_avatar,
                image, caption, created_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                sid, gid, profile["id"], profile["name"], profile["handle"], profile["avatar"],
                image, caption, created_at, now_ms + ttl,
            ),
        )


def user_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "username": row["username"] or "",
        "bio": row["bio"] or "",
        "avatar": row["avatar"] or "",
        "role": row["role"],
        "provider": row["provider"],
        "interests": json.loads(row["interests"] or "[]"),
        "privacy": row["privacy"] or "public",
        "active": bool(row["active"]),
        "onboardingCompleted": bool(row["onboarding_completed"]),
        "createdAt": row["created_at"],
    }


def ensure_user_seed_inbox(conn: sqlite3.Connection, user_id: str) -> None:
    """Seed initial messages & notifications for newly hydrated user if empty."""
    existing_msgs = conn.execute(
        "SELECT 1 FROM messages WHERE from_user_id = ? OR to_user_id = ? LIMIT 1",
        (user_id, user_id),
    ).fetchone()
    now_ms = int(time.time() * 1000)
    if existing_msgs is None:
        conv_key = canonical_conversation_key("s1", user_id)
        conn.execute(
            """
            INSERT INTO messages (id, conversation_key, from_user_id, to_user_id, sender_name, text, audio, time_label, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, '', ?, 'READ', ?)
            """,
            (
                f"m_init_1_{user_id}", conv_key, "s1", user_id, "Dr. Sophia Vance",
                "Hey! I reviewed your architecture proposal for the fanout feed.",
                "10:14 AM", now_ms - 1_800_000,
            ),
        )
        conn.execute(
            """
            INSERT INTO messages (id, conversation_key, from_user_id, to_user_id, sender_name, text, audio, time_label, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, '', ?, 'READ', ?)
            """,
            (
                f"m_init_2_{user_id}", conv_key, user_id, "s1", "You",
                "Thanks Sophia! We are adopting the WebSocket Gateway with Fanout-on-Write.",
                "10:18 AM", now_ms - 1_500_000,
            ),
        )

    existing_notifs = conn.execute(
        "SELECT 1 FROM notifications WHERE user_id = ? LIMIT 1",
        (user_id,),
    ).fetchone()
    if existing_notifs is None:
        seed_notifs = [
            (SEED_PROFILES[2], "liked your post about WebGL Shaders", now_ms - 12 * 60_000),
            (SEED_PROFILES[0], "started following you", now_ms - 60 * 60_000),
            (SEED_PROFILES[4], 'commented on your post: "This is so clean! 🔥"', now_ms - 3 * 3_600_000),
            (SEED_PROFILES[6], "started following you", now_ms - 5 * 3_600_000),
            (SEED_PROFILES[7], "liked your profile update", now_ms - 24 * 3_600_000),
        ]
        for idx, (actor, action, ts) in enumerate(seed_notifs, start=1):
            conn.execute(
                """
                INSERT INTO notifications (id, user_id, actor_id, name, handle, avatar, action, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"n{idx}_{user_id}",
                    user_id,
                    actor["id"],
                    actor["name"],
                    actor["handle"],
                    actor["avatar"],
                    action,
                    ts,
                ),
            )


def record_activity(conn: sqlite3.Connection, user_id: str, delta: int = 1) -> None:
    if not user_id:
        return
    day = date.today().isoformat()
    conn.execute(
        """
        INSERT INTO activity_log (user_id, day, count) VALUES (?, ?, ?)
        ON CONFLICT(user_id, day) DO UPDATE SET count = count + excluded.count
        """,
        (user_id, day, delta),
    )


def fetch_posts(conn: sqlite3.Connection, current_user_id: str | None = None) -> list[dict]:
    now_ms = int(time.time() * 1000)
    rows = conn.execute("SELECT * FROM posts ORDER BY created_at DESC").fetchall()

    like_counts = {
        r["post_id"]: r["cnt"]
        for r in conn.execute("SELECT post_id, COUNT(*) AS cnt FROM post_likes GROUP BY post_id").fetchall()
    }
    comment_counts = {
        r["post_id"]: r["cnt"]
        for r in conn.execute("SELECT post_id, COUNT(*) AS cnt FROM comments GROUP BY post_id").fetchall()
    }
    user_liked = set()
    if current_user_id:
        user_liked = {
            r["post_id"]
            for r in conn.execute("SELECT post_id FROM post_likes WHERE user_id = ?", (current_user_id,)).fetchall()
        }

    result = []
    for row in rows:
        pid = row["id"]
        result.append(
            {
                "id": pid,
                "author": {
                    "id": row["author_id"],
                    "name": row["author_name"],
                    "handle": row["author_handle"],
                    "avatar": row["author_avatar"],
                    "role": row["author_role"],
                },
                "content": row["content"],
                "image": row["image"],
                "likes": int(row["base_likes"]) + int(like_counts.get(pid, 0)),
                "comments": int(comment_counts.get(pid, 0)),
                "liked": pid in user_liked,
                "timestamp": format_relative_time(int(row["created_at"]), now_ms),
                "tags": json.loads(row["tags"] or "[]"),
                "createdAt": int(row["created_at"]),
            }
        )
    return result


def fetch_comments_map(conn: sqlite3.Connection, current_user_id: str | None = None) -> dict[str, list[dict]]:
    now_ms = int(time.time() * 1000)
    rows = conn.execute("SELECT * FROM comments ORDER BY created_at ASC").fetchall()

    like_counts = {
        r["comment_id"]: r["cnt"]
        for r in conn.execute("SELECT comment_id, COUNT(*) AS cnt FROM comment_likes GROUP BY comment_id").fetchall()
    }
    user_liked = set()
    if current_user_id:
        user_liked = {
            r["comment_id"]
            for r in conn.execute("SELECT comment_id FROM comment_likes WHERE user_id = ?", (current_user_id,)).fetchall()
        }

    by_id: dict[str, dict] = {}
    roots_by_post: dict[str, list[dict]] = {}

    for row in rows:
        cid = row["id"]
        item = {
            "id": cid,
            "author": {
                "id": row["author_id"],
                "name": row["author_name"],
                "handle": row["author_handle"],
                "avatar": row["author_avatar"],
            },
            "content": row["content"],
            "timestamp": format_relative_time(int(row["created_at"]), now_ms),
            "likes": int(row["base_likes"]) + int(like_counts.get(cid, 0)),
            "liked": cid in user_liked,
            "replies": [],
        }
        by_id[cid] = item
        if row["parent_id"] and row["parent_id"] in by_id:
            by_id[row["parent_id"]]["replies"].append(item)
        else:
            roots_by_post.setdefault(row["post_id"], []).append(item)

    return roots_by_post


def fetch_events(conn: sqlite3.Connection, current_user_id: str | None = None) -> list[dict]:
    rows = conn.execute("SELECT * FROM events ORDER BY id ASC").fetchall()
    counts = {
        r["event_id"]: r["cnt"]
        for r in conn.execute("SELECT event_id, COUNT(*) AS cnt FROM event_rsvps GROUP BY event_id").fetchall()
    }
    user_rsvps = set()
    if current_user_id:
        user_rsvps = {
            r["event_id"]
            for r in conn.execute("SELECT event_id FROM event_rsvps WHERE user_id = ?", (current_user_id,)).fetchall()
        }
    return [
        {
            "id": row["id"],
            "title": row["title"],
            "date": row["date_label"],
            "location": row["location"],
            "attendees": int(row["base_attendees"]) + int(counts.get(row["id"], 0)),
            "rsvpd": row["id"] in user_rsvps,
            "tag": row["tag"],
        }
        for row in rows
    ]


def fetch_following(conn: sqlite3.Connection, user_id: str) -> list[str]:
    rows = conn.execute("SELECT target_id FROM follows WHERE follower_id = ?", (user_id,)).fetchall()
    return [r["target_id"] for r in rows]


def fetch_saved(conn: sqlite3.Connection, user_id: str) -> list[str]:
    rows = conn.execute("SELECT post_id FROM saved_posts WHERE user_id = ?", (user_id,)).fetchall()
    return [r["post_id"] for r in rows]


def fetch_messages(conn: sqlite3.Connection, user_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM messages WHERE from_user_id = ? OR to_user_id = ? ORDER BY created_at ASC",
        (user_id, user_id),
    ).fetchall()
    return [
        {
            "id": r["id"],
            "fromUserId": r["from_user_id"],
            "toUserId": r["to_user_id"],
            "senderName": r["sender_name"],
            "text": r["text"],
            "audio": r["audio"],
            "time": r["time_label"],
            "timestamp": int(r["created_at"]),
            "status": r["status"],
        }
        for r in rows
    ]


def fetch_notifications(conn: sqlite3.Connection, user_id: str) -> list[dict]:
    now_ms = int(time.time() * 1000)
    rows = conn.execute(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    ).fetchall()
    return [
        {
            "id": r["id"],
            "userId": r["actor_id"],
            "name": r["name"],
            "handle": r["handle"],
            "avatar": r["avatar"],
            "action": r["action"],
            "read": bool(r["is_read"]),
            "time": format_relative_time(int(r["created_at"]), now_ms),
        }
        for r in rows
    ]


def create_notification(conn: sqlite3.Connection, target_user_id: str, actor: dict, action: str) -> None:
    if not target_user_id or target_user_id == actor["id"]:
        return
    handle = actor.get("username") or actor.get("handle") or actor.get("email", "user").split("@")[0]
    conn.execute(
        """
        INSERT INTO notifications (id, user_id, actor_id, name, handle, avatar, action, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        """,
        (
            make_id("notif"),
            target_user_id,
            actor["id"],
            actor["name"],
            handle,
            actor.get("avatar", ""),
            action,
            int(time.time() * 1000),
        ),
    )


def fetch_active_stories(conn: sqlite3.Connection, current_user_id: str | None = None) -> tuple[list[dict], list[str]]:
    now_ms = int(time.time() * 1000)
    rows = conn.execute(
        "SELECT * FROM stories WHERE expires_at > ? ORDER BY created_at ASC",
        (now_ms,),
    ).fetchall()
    groups: dict[str, dict] = {}
    for r in rows:
        gid = r["group_id"]
        if gid not in groups:
            groups[gid] = {
                "id": gid,
                "user": {
                    "id": r["user_id"],
                    "name": r["user_name"],
                    "handle": r["user_handle"],
                    "avatar": r["user_avatar"],
                },
                "slides": [],
            }
        delta_sec = max(0, int((now_ms - int(r["created_at"])) / 1000))
        time_str = "Just now" if delta_sec < 60 else (f"{delta_sec // 60}m" if delta_sec < 3600 else f"{delta_sec // 3600}h")
        groups[gid]["slides"].append(
            {
                "id": r["id"],
                "image": r["image"],
                "caption": r["caption"],
                "time": time_str,
            }
        )

    seen_ids: list[str] = []
    if current_user_id:
        seen_rows = conn.execute(
            "SELECT group_id FROM story_views WHERE user_id = ?",
            (current_user_id,),
        ).fetchall()
        seen_ids = [r["group_id"] for r in seen_rows]
    return list(groups.values()), seen_ids


def store_refresh_token(conn: sqlite3.Connection, token: str, user_id: str, ttl_seconds: int = 604800) -> None:
    expires_at = int(time.time()) + ttl_seconds
    conn.execute(
        "INSERT OR REPLACE INTO refresh_tokens (token, user_id, expires_at, revoked) VALUES (?, ?, ?, 0)",
        (token, user_id, expires_at),
    )


def rotate_refresh_token(conn: sqlite3.Connection, old_token: str, new_token: str, user_id: str, ttl_seconds: int = 604800) -> bool:
    now_sec = int(time.time())
    row = conn.execute(
        "SELECT user_id, expires_at, revoked FROM refresh_tokens WHERE token = ?",
        (old_token,),
    ).fetchone()
    if row is None or row["revoked"] or int(row["expires_at"]) <= now_sec or row["user_id"] != user_id:
        return False
    conn.execute("UPDATE refresh_tokens SET revoked = 1 WHERE token = ?", (old_token,))
    store_refresh_token(conn, new_token, user_id, ttl_seconds=ttl_seconds)
    return True


def revoke_user_refresh_tokens(conn: sqlite3.Connection, user_id: str) -> None:
    conn.execute("UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?", (user_id,))


def revoke_access_jti(conn: sqlite3.Connection, jti: str, expires_at: int) -> None:
    if not jti:
        return
    conn.execute(
        "INSERT OR REPLACE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)",
        (jti, expires_at),
    )


def is_jti_revoked(conn: sqlite3.Connection, jti: str) -> bool:
    if not jti:
        return False
    row = conn.execute("SELECT 1 FROM revoked_tokens WHERE jti = ?", (jti,)).fetchone()
    return row is not None


def fetch_activity(conn: sqlite3.Connection, user_id: str) -> dict[str, int]:
    rows = conn.execute("SELECT day, count FROM activity_log WHERE user_id = ?", (user_id,)).fetchall()
    return {r["day"]: int(r["count"]) for r in rows}


def record_admin_audit(
    conn: sqlite3.Connection,
    admin: dict,
    action: str,
    target_type: str,
    target_id: str,
    details: str = "",
) -> dict:
    audit_id = make_id("audit")
    now_ms = int(time.time() * 1000)
    conn.execute(
        """
        INSERT INTO admin_audit_logs (
            id, admin_id, admin_name, action, target_type, target_id, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            audit_id,
            admin["id"],
            admin["name"],
            action,
            target_type,
            target_id,
            details,
            now_ms,
        ),
    )
    return {
        "id": audit_id,
        "adminId": admin["id"],
        "adminName": admin["name"],
        "action": action,
        "targetType": target_type,
        "targetId": target_id,
        "details": details,
        "createdAt": now_ms,
        "time": "Just now",
        "isoTime": datetime.fromtimestamp(now_ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def fetch_admin_audit_logs(conn: sqlite3.Connection, limit: int = 50) -> list[dict]:
    now_ms = int(time.time() * 1000)
    rows = conn.execute(
        "SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [
        {
            "id": r["id"],
            "adminId": r["admin_id"],
            "adminName": r["admin_name"],
            "action": r["action"],
            "targetType": r["target_type"],
            "targetId": r["target_id"],
            "details": r["details"],
            "createdAt": int(r["created_at"]),
            "time": format_relative_time(int(r["created_at"]), now_ms),
            "isoTime": datetime.fromtimestamp(int(r["created_at"]) / 1000, tz=timezone.utc)
            .isoformat()
            .replace("+00:00", "Z"),
        }
        for r in rows
    ]


def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"
