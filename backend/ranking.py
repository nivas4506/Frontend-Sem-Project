"""Feed ranking, weighted search scoring, and creator recommendation algorithms."""

from __future__ import annotations

import math
import re
import time


HASHTAG_RE = re.compile(r"#(\w+)")

TOPIC_KEYWORDS = {
    "ai": {"ai", "machine learning", "llm", "neural"},
    "design": {"design", "ui", "ux", "ui/ux", "uiux", "shader"},
    "photo": {"photography", "film", "camera", "kyoto"},
    "gaming": {"gaming", "indiedev", "gamedev", "roguelike", "interactive"},
    "code": {"engineering", "code", "webgl", "websocket", "systems"},
    "music": {"music", "audio", "producer", "track", "sound"},
    "crypto": {"web3", "cryptography", "defi", "protocol"},
    "travel": {"travel", "expeditions", "azores", "kyoto"},
    "fitness": {"health", "longevity", "fitness", "sports"},
}


def _normalize_interest_tokens(interests: list[str]) -> set[str]:
    tokens: set[str] = set()
    for item in interests or []:
        low = str(item).strip().lower()
        if not low:
            continue
        tokens.add(low)
        tokens.update(TOPIC_KEYWORDS.get(low, ()))
    return tokens


def _extract_post_tokens(post: dict) -> set[str]:
    tokens: set[str] = set()
    for tag in post.get("tags") or []:
        low = str(tag).strip().lower()
        if low:
            tokens.add(low)
            for part in re.split(r"[\s&/]+", low):
                if len(part) > 1:
                    tokens.add(part)
    for match in HASHTAG_RE.findall(post.get("content") or ""):
        tokens.add(match.lower())
    return tokens


def jaccard_similarity(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    union = a | b
    return len(a & b) / len(union) if union else 0.0


def rank_feed(
    posts: list[dict],
    following_ids: set[str],
    user_interests: list[str],
    mode: str = "foryou",
    user_id: str | None = None,
    now_ms: int | None = None,
) -> list[dict]:
    """Rank feed posts using reverse-chronological (following) or time-decay gravity + affinity (foryou)."""
    if mode == "following":
        filtered = [
            p for p in posts
            if p.get("author", {}).get("id") in following_ids
            or (user_id is not None and p.get("author", {}).get("id") == user_id)
        ]
        return sorted(filtered, key=lambda p: p.get("createdAt", 0), reverse=True)

    current_ms = now_ms if now_ms is not None else int(time.time() * 1000)
    interest_tokens = _normalize_interest_tokens(user_interests)

    scored: list[tuple[float, int, dict]] = []
    for post in posts:
        created_at = int(post.get("createdAt") or current_ms)
        age_hours = max(0.0, (current_ms - created_at) / 3_600_000.0)
        likes = max(0, int(post.get("likes") or 0))
        comments = max(0, int(post.get("comments") or 0))

        engagement = 1.0 + 1.5 * likes + 2.5 * comments
        decay = (age_hours + 2.0) ** 1.4

        author_id = post.get("author", {}).get("id")
        follow_boost = 0.45 if author_id in following_ids else 0.0
        topic_overlap = jaccard_similarity(interest_tokens, _extract_post_tokens(post))
        affinity = 1.0 + follow_boost + 0.30 * topic_overlap

        score = round((engagement / decay) * affinity, 4)
        enriched = {**post, "score": score}
        scored.append((score, created_at, enriched))

    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [item[2] for item in scored]


def rank_search_results(posts: list[dict], query: str) -> list[dict]:
    """Score posts by weighted multi-field term matches and popularity tie-breaker."""
    clean = (query or "").lstrip("#").strip().lower()
    if not clean:
        return list(posts)

    terms = [t for t in re.split(r"\s+", clean) if t]
    if not terms:
        return list(posts)

    ranked: list[tuple[float, dict]] = []
    for post in posts:
        author = post.get("author") or {}
        author_text = f"{author.get('name', '')} {author.get('handle', '')}".lower()
        tags_text = " ".join(
            [str(t).lower() for t in (post.get("tags") or [])]
            + [m.lower() for m in HASHTAG_RE.findall(post.get("content") or "")]
        )
        content_text = (post.get("content") or "").lower()

        score = 0.0
        matched_all = True
        for term in terms:
            term_score = 0.0
            if term in author_text:
                term_score += 3.0
            if term in tags_text:
                term_score += 2.5
            if term in content_text:
                term_score += 1.0
            if term_score == 0.0:
                matched_all = False
                break
            score += term_score

        if matched_all:
            score += 0.25 * math.log1p(max(0, int(post.get("likes") or 0)))
            ranked.append((round(score, 4), {**post, "searchScore": round(score, 4)}))

    ranked.sort(key=lambda item: item[0], reverse=True)
    return [item[1] for item in ranked]


def recommend_creators(
    following_ids: set[str],
    user_interests: list[str],
    candidates: list[dict],
    limit: int = 4,
) -> list[dict]:
    """Recommend unfollowed creators using Jaccard interest overlap + mutual connections."""
    interest_tokens = _normalize_interest_tokens(user_interests)
    scored: list[tuple[float, dict]] = []

    for creator in candidates:
        cid = creator.get("id")
        if not cid or cid in following_ids:
            continue
        creator_tokens = {
            part.lower()
            for part in re.split(r"[\s&/]+", f"{creator.get('role', '')} {' '.join(creator.get('topics', []))}")
            if len(part) > 1
        }
        overlap = jaccard_similarity(interest_tokens, creator_tokens)
        mutuals = max(0, int(creator.get("mutuals") or 0))
        score = round(2.0 * overlap + 0.25 * mutuals, 4)
        scored.append((score, {**creator, "matchScore": score}))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [item[1] for item in scored[:limit]]
