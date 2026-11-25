"""Async WebSocket connection manager and real-time event router."""

from __future__ import annotations

import asyncio
import time
from datetime import datetime

from fastapi import WebSocket

from .database import (
    SEED_PROFILES,
    canonical_conversation_key,
    fetch_posts,
    get_connection,
    make_id,
    record_activity,
)
from .security import verify_jwt


SIMULATED_PARTNER_IDS = {"s1", "s2", "elena_r"}


class ConnectionManager:
    """Manages active WebSocket connections, user presence, and fanout broadcasts."""

    def __init__(self, db_path=None) -> None:
        self.db_path = db_path
        self.connected_clients: dict[str, set[WebSocket]] = {}
        self.socket_user_map: dict[WebSocket, dict] = {}
        self.active_users: dict[str, dict] = {
            p["id"]: {
                "userId": p["id"],
                "name": p["name"],
                "avatar": p["avatar"],
                "role": p["role"],
                "isOnline": True,
                "lastSeen": int(time.time() * 1000),
            }
            for p in SEED_PROFILES[:3]
        }

    async def broadcast(self, payload: dict, exclude_user_id: str | None = None) -> None:
        dead: list[WebSocket] = []
        for ws, meta in list(self.socket_user_map.items()):
            if exclude_user_id and meta.get("userId") == exclude_user_id:
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)

    async def send_to_user(self, user_id: str, payload: dict) -> bool:
        sockets = list(self.connected_clients.get(user_id, ()))
        if not sockets:
            return False
        delivered = False
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_json(payload)
                delivered = True
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)
        return delivered

    async def disconnect(self, ws: WebSocket) -> None:
        meta = self.socket_user_map.pop(ws, None)
        if not meta:
            return
        user_id = meta["userId"]
        sockets = self.connected_clients.get(user_id)
        if sockets and ws in sockets:
            sockets.discard(ws)
        if sockets is not None and len(sockets) == 0:
            self.connected_clients.pop(user_id, None)
            if user_id in self.active_users:
                self.active_users[user_id]["isOnline"] = False
                self.active_users[user_id]["lastSeen"] = int(time.time() * 1000)
            await self.broadcast(
                {
                    "type": "presence:update",
                    "userId": user_id,
                    "isOnline": False,
                    "lastSeen": int(time.time() * 1000),
                    "activeUsers": list(self.active_users.values()),
                }
            )

    async def handle_message(self, ws: WebSocket, data: dict) -> None:
        msg_type = data.get("type")

        if msg_type == "auth":
            token = data.get("token")
            fallback = data.get("user") or {}
            decoded = verify_jwt(token) if token else None

            user_id = (decoded or {}).get("sub") or fallback.get("id") or f"anon_{int(time.time() * 1000)}"
            name = (decoded or {}).get("name") or fallback.get("name") or "Community Member"
            avatar = (decoded or {}).get("picture") or fallback.get("avatar") or ""
            role = (decoded or {}).get("role") or fallback.get("role") or "standard_user"

            meta = {"userId": user_id, "name": name, "avatar": avatar, "role": role}
            self.socket_user_map[ws] = meta
            self.connected_clients.setdefault(user_id, set()).add(ws)
            self.active_users[user_id] = {
                "userId": user_id,
                "name": name,
                "avatar": avatar,
                "role": role,
                "isOnline": True,
                "lastSeen": int(time.time() * 1000),
            }

            with get_connection(self.db_path) as conn:
                posts = fetch_posts(conn, current_user_id=user_id)
            post_likes = {
                p["id"]: {"likes": p["likes"], "liked": p["liked"]}
                for p in posts
            }

            await ws.send_json(
                {
                    "type": "auth:success",
                    "userId": user_id,
                    "activeUsers": list(self.active_users.values()),
                    "postLikes": post_likes,
                }
            )
            await self.broadcast(
                {
                    "type": "presence:update",
                    "userId": user_id,
                    "isOnline": True,
                    "user": self.active_users[user_id],
                    "activeUsers": list(self.active_users.values()),
                }
            )
            return

        sender_meta = self.socket_user_map.get(ws)
        if not sender_meta:
            await ws.send_json({"type": "error", "message": "Unauthorized. Please authenticate first."})
            return

        sender_id = sender_meta["userId"]

        if msg_type == "message:send":
            to_user_id = data.get("toUserId")
            text = (data.get("text") or "").strip()
            audio = data.get("audio") or ""
            temp_id = data.get("tempId")
            if not to_user_id or (not text and not audio):
                return

            conv_key = canonical_conversation_key(sender_id, to_user_id)
            now_ms = int(time.time() * 1000)
            time_label = datetime.now().strftime("%I:%M %p").lstrip("0")
            is_recipient_online = bool(self.connected_clients.get(to_user_id))
            status = "DELIVERED" if is_recipient_online else "SENT"
            message_id = make_id("msg")

            with get_connection(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO messages (
                        id, conversation_key, from_user_id, to_user_id, sender_name,
                        text, audio, time_label, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (message_id, conv_key, sender_id, to_user_id, sender_meta["name"], text, audio, time_label, status, now_ms),
                )
                record_activity(conn, sender_id)

            new_msg = {
                "id": message_id,
                "conversationId": conv_key,
                "fromUserId": sender_id,
                "toUserId": to_user_id,
                "senderName": sender_meta["name"],
                "text": text,
                "audio": audio,
                "time": time_label,
                "timestamp": now_ms,
                "status": status,
            }

            await ws.send_json(
                {
                    "type": "message:sent",
                    "message": new_msg,
                    "tempId": temp_id,
                    "status": status,
                }
            )

            if is_recipient_online:
                await self.send_to_user(to_user_id, {"type": "message:new", "message": new_msg})
                preview = text[:32] + ("..." if len(text) > 32 else "")
                await self.send_to_user(
                    to_user_id,
                    {
                        "type": "notification:new",
                        "notification": {
                            "id": make_id("notif"),
                            "name": sender_meta["name"],
                            "avatar": sender_meta["avatar"],
                            "action": f'sent you a message: "{preview}"',
                            "time": "Just now",
                            "type": "message",
                        },
                    },
                )

            if to_user_id in SIMULATED_PARTNER_IDS:
                asyncio.create_task(self._simulate_partner_reply(ws, sender_id, to_user_id, text, conv_key))
            return

        if msg_type == "message:read":
            partner_id = data.get("toUserId")
            if not partner_id:
                return
            conv_key = canonical_conversation_key(sender_id, partner_id)
            with get_connection(self.db_path) as conn:
                cur = conn.execute(
                    """
                    UPDATE messages SET status = 'READ'
                    WHERE conversation_key = ? AND to_user_id = ? AND status != 'READ'
                    """,
                    (conv_key, sender_id),
                )
                changed = cur.rowcount > 0
            if changed:
                await self.send_to_user(
                    partner_id,
                    {
                        "type": "message:read_receipt",
                        "conversationId": conv_key,
                        "readByUserId": sender_id,
                    },
                )
            return

        if msg_type in ("typing:start", "typing:stop"):
            to_user_id = data.get("toUserId")
            if not to_user_id:
                return
            await self.send_to_user(
                to_user_id,
                {
                    "type": "typing:indicator",
                    "fromUserId": sender_id,
                    "senderName": sender_meta["name"],
                    "isTyping": msg_type == "typing:start",
                },
            )
            return

        if msg_type == "post:like":
            post_id = data.get("postId")
            action = data.get("action")
            if not post_id:
                return
            now_ms = int(time.time() * 1000)
            with get_connection(self.db_path) as conn:
                row = conn.execute("SELECT base_likes FROM posts WHERE id = ?", (post_id,)).fetchone()
                if row is None:
                    return
                already = conn.execute(
                    "SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?",
                    (post_id, sender_id),
                ).fetchone()
                should_like = action == "like" or (action is None and already is None)
                if should_like:
                    conn.execute(
                        "INSERT OR IGNORE INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)",
                        (post_id, sender_id, now_ms),
                    )
                    record_activity(conn, sender_id)
                else:
                    conn.execute(
                        "DELETE FROM post_likes WHERE post_id = ? AND user_id = ?",
                        (post_id, sender_id),
                    )
                extra = conn.execute(
                    "SELECT COUNT(*) AS cnt FROM post_likes WHERE post_id = ?",
                    (post_id,),
                ).fetchone()["cnt"]
                total_likes = int(row["base_likes"]) + int(extra)

            await self.broadcast(
                {
                    "type": "post:like_update",
                    "postId": post_id,
                    "likesCount": total_likes,
                    "byUserId": sender_id,
                    "action": "liked" if should_like else "unliked",
                }
            )
            if should_like:
                await self.broadcast(
                    {
                        "type": "notification:new",
                        "notification": {
                            "id": make_id("notif_like"),
                            "name": sender_meta["name"],
                            "avatar": sender_meta["avatar"],
                            "action": "liked your post",
                            "time": "Just now",
                            "type": "like",
                        },
                    },
                    exclude_user_id=sender_id,
                )
            return

        if msg_type == "post:new":
            post = data.get("post")
            if not post or not post.get("id"):
                return
            author = post.get("author") or {}
            now_ms = int(post.get("createdAt") or time.time() * 1000)
            with get_connection(self.db_path) as conn:
                import json

                conn.execute(
                    """
                    INSERT OR IGNORE INTO posts (
                        id, author_id, author_name, author_handle, author_avatar, author_role,
                        content, image, base_likes, tags, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                    """,
                    (
                        post["id"],
                        author.get("id", sender_id),
                        author.get("name", sender_meta["name"]),
                        author.get("handle", "user"),
                        author.get("avatar", sender_meta["avatar"]),
                        author.get("role", sender_meta["role"]),
                        post.get("content", ""),
                        post.get("image", ""),
                        json.dumps(post.get("tags") or []),
                        now_ms,
                    ),
                )
            await self.broadcast({"type": "post:broadcast", "post": post})

    async def _simulate_partner_reply(
        self,
        ws: WebSocket,
        sender_user_id: str,
        partner_id: str,
        user_msg: str,
        conv_key: str,
    ) -> None:
        partner = self.active_users.get(partner_id)
        if not partner:
            return
        try:
            await asyncio.sleep(0.5)
            await ws.send_json(
                {
                    "type": "typing:indicator",
                    "fromUserId": partner_id,
                    "senderName": partner["name"],
                    "isTyping": True,
                }
            )
            await asyncio.sleep(1.5)
            await ws.send_json(
                {
                    "type": "typing:indicator",
                    "fromUserId": partner_id,
                    "senderName": partner["name"],
                    "isTyping": False,
                }
            )

            lower = user_msg.lower()
            if any(k in lower for k in ("hello", "hi", "hey")):
                reply_text = "Hello! Great to connect with you on SocialConnect. How is your project going?"
            elif any(k in lower for k in ("feed", "architecture", "design", "python", "ranking")):
                reply_text = "The Python FastAPI backend ranks the feed with time-decay gravity and pushes live updates over WebSockets!"
            elif any(k in lower for k in ("like", "socket", "realtime")):
                reply_text = "Notice how likes, typing indicators, and notifications stream live through the FastAPI WebSocket gateway!"
            else:
                reply_text = "Thanks for your message! Looking forward to diving deeper into this."

            now_ms = int(time.time() * 1000)
            time_label = datetime.now().strftime("%I:%M %p").lstrip("0")
            reply_id = make_id("msg_reply")

            with get_connection(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO messages (
                        id, conversation_key, from_user_id, to_user_id, sender_name,
                        text, audio, time_label, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, '', ?, 'DELIVERED', ?)
                    """,
                    (reply_id, conv_key, partner_id, sender_user_id, partner["name"], reply_text, time_label, now_ms),
                )

            await ws.send_json(
                {
                    "type": "message:new",
                    "message": {
                        "id": reply_id,
                        "conversationId": conv_key,
                        "fromUserId": partner_id,
                        "toUserId": sender_user_id,
                        "senderName": partner["name"],
                        "senderAvatar": partner["avatar"],
                        "text": reply_text,
                        "time": time_label,
                        "timestamp": now_ms,
                        "status": "DELIVERED",
                    },
                }
            )
            await ws.send_json(
                {
                    "type": "notification:new",
                    "notification": {
                        "id": make_id("notif"),
                        "name": partner["name"],
                        "avatar": partner["avatar"],
                        "action": f'replied to your message: "{reply_text[:32]}..."',
                        "time": "Just now",
                        "type": "message",
                    },
                }
            )
        except Exception:
            pass
