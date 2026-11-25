# SocialConnect — Social Connectivity Platform

A modern dark-themed social media web application for self-expression, discovery, and community connection — featuring stories, a personalized feed, explore grid, direct messaging with voice notes, community events, notifications, and expressive user profiles.

> **Stack:** React 18 + Bootstrap 5 (`data-bs-theme="dark"`) + custom CSS (`src/index.css`, `src/app.css`), Vite 6 for dev/build, and a **Python FastAPI + SQLite + WebSocket** backend (`backend/`, with an optional legacy Node.js + `ws` gateway in `server/`).

## Features

**Accounts, Onboarding & Admin Portal**
-Email sign-up / sign-in with local browser storage, simulated OAuth 2.0 PKCE flow (Google, Apple, GitHub, Discord, X), password strength & visibility toggle, and help/password-reset demo dialog
-3-step profile onboarding: identity & avatar → interests → visibility preferences
-Role-based **Admin portal** for searching, activating/deactivating, and deleting registered user accounts

**Social Feed & Stories**
-Horizontal **Stories** bar with unseen gradient rings, seen-state tracking, and a full-screen interactive `StoryViewer` (auto-advance, hold-to-pause, keyboard controls)
-Post composer with photo uploads (≤ 2 MB), emoji picker tray, and remaining character indicator
-**For you** and **Following** feed tabs with verified badges, inline follow/unfollow, clickable `#hashtags`, double-click heart burst on photos, likes, threaded comments drawer, share/copy, and saved/bookmarked posts
-Discovery sidebar featuring **Suggested for you** creators, **Trending now** hashtags, and **Upcoming events**

**Explore, Events, Profile & Notifications**
-**Explore & Search** with live filtering, topic chips, creator cards, trending hashtags, and a 3-column tile grid
-**Community Events** laid out on a responsive Bootstrap grid with gradient banners, date badges, attendee counts, and RSVP toggles
-**Profile** hero with cover banner, avatar, bio, interest chips, Posts / Following / Likes / Saved stats, **Posts / Media / Saved / Activity** tabs, and a 6-month contribution heatmap
-**Notifications** feed with `All`, `Follows`, and `Comments` filters and one-click follow-back actions

**Direct Messaging**
-Conversation search, live online presence dots, last-message previews, unread badges, typing indicators, and read receipts
-60-second voice notes (`MediaRecorder`, requires `localhost` or HTTPS + microphone permission)
-3 seeded contacts with simulated gateway replies; offline messages are saved as `LOCAL`

**UX & Platform**
-Responsive 240px left sidebar (collapses to an icon rail on tablets and a bottom navigation bar on mobile) and sticky top bar
-Command palette (`Ctrl+K` / `Cmd+K`), accessible dialogs, and toast notifications
-WebGL fiber background + ocean gradient toggle on auth screens and `prefers-reduced-motion` support

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Bootstrap 5 (`bootstrap/dist/css/bootstrap.min.css`), CSS (`src/index.css`, `src/app.css`) |
| Backend | Python 3.13+, FastAPI, Uvicorn (ASGI + WebSockets), SQLite (`backend/socialconnect.db`) |
| Browser APIs | DOM, WebSocket, WebGL, MediaRecorder, Clipboard, localStorage, `<dialog>` |
| Dev / Build | Vite 6 (`dev`, `build`, `preview`) with `/api`, `/health`, `/ws` proxy to `:8000` |
| Realtime | FastAPI WebSocket `/ws` (or optional Node.js `ws` gateway on port `4001`) |
| Runtime | Node.js 20.19+ or 22.12+, Python 3.11+ |

## Getting Started

Run from the project root (folder containing `index.html`):

```sh
npm install
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173`).

To run the **Python FastAPI + SQLite + WebSocket backend** (recommended for persistent API data, ranked feeds, HS256 JWT auth, and live WebSockets), open a second terminal:

```sh
pip install -r backend/requirements.txt
npm run backend
```

Vite automatically proxies `/api`, `/health`, and `/ws` to `http://localhost:8000`. Without the backend running, the frontend seamlessly falls back to browser `localStorage`.

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run backend` | Start Python FastAPI + WebSocket backend (port 8000) |
| `npm run test:backend` | Run Python backend `pytest` suite (`backend/tests`) |
| `npm run server` | Start optional legacy Node.js realtime gateway (`server/server.js`) |
| `npm test` | Run Node test runner (`node --test test/*.test.js`) |

### Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | `""` (Vite proxy) | Base URL for REST API calls in production |
| `VITE_WS_URL` | `ws(s)://<host>/ws` | WebSocket endpoint used by frontend |
| `JWT_SECRET` | `socialconnect-dev-secret-2026` | HMAC-SHA256 signing secret for Python JWTs |
| `SCP_DB_PATH` | `backend/socialconnect.db` | SQLite database file path |
| `PORT` | `4001` | Port for legacy `server/server.js` gateway |

## Project Structure

```text
.
├── index.html                        # Entry HTML (data-bs-theme="dark"), canvas bg, toasts
├── package.json                      # Dependencies (react, react-dom, bootstrap) & scripts
├── vite.config.js                    # Vite 6 + React plugin config
├── vercel.json                       # Vercel build & SPA rewrite configuration
├── public/                           # Static fallback assets (logo, ocean gradient)
├── src/
│   ├── main.jsx                      # React root, Bootstrap CSS, index.css, app.css
│   ├── App.jsx                       # Auth/onboarding gate, socket handlers, view routing
│   ├── data.js                       # Seed posts, stories, creators, trending, events, contacts
│   ├── background.js                 # WebGL fiber & silk gradient background
│   ├── index.css / app.css           # Auth/modal tokens & SocialConnect dark theme
│   ├── assets/                       # Bundled logo.png & ocean-gradient.jpg
│   ├── components/
│   │   ├── Shell.jsx                 # Left sidebar, sticky topbar, mobile bottom nav
│   │   ├── FeedView.jsx              # Feed tabs, composer, PostCard, discovery sidebar
│   │   ├── StoriesBar.jsx            # Stories strip & fullscreen StoryViewer
│   │   ├── ExploreView.jsx           # Search, topic chips, creators, explore tile grid
│   │   ├── MessagesView.jsx          # DM contacts, thread, typing, voice recorder
│   │   ├── NotificationsView.jsx     # Filterable activity list & follow-back actions
│   │   ├── EventsView.jsx            # Bootstrap-grid community events & RSVP cards
│   │   ├── ProfileView.jsx           # Profile hero, Posts/Media/Saved/Activity tabs, heatmap
│   │   ├── DialogModal.jsx           # Comments drawer, command palette, profile/OAuth/help dialogs
│   │   ├── AuthView.jsx              # Sign-in / sign-up & User/Admin portal switch
│   │   ├── OnboardingView.jsx        # 3-step profile setup wizard
│   │   ├── AdminView.jsx             # Protected admin user-management dashboard
│   │   └── Icons.jsx                 # SVG icons, VerifiedBadge, Avatar, OAuth provider marks
│   ├── hooks/                        # useAuth, useSocialPlatform (API sync + offline fallback), useSocket
│   ├── services/                     # apiService (REST client), authService (auth + fallback), socketService (WS)
│   └── utils/                        # toast notifications & media/storage helpers
├── backend/
│   ├── main.py                       # FastAPI REST endpoints, media serving, auth guards, /ws route
│   ├── database.py                   # SQLite schema (stories, tokens, notifications), seeding & CRUD
│   ├── ranking.py                    # Time-decay feed ranking, search scoring & creator recommendations
│   ├── security.py                   # PBKDF2-HMAC-SHA256, HS256 JWT (JTI), SHA-256 media, rate limiter
│   ├── realtime.py                   # Async WebSocket connection manager & fanout router
│   ├── Dockerfile                    # Container build for Render / cloud deployment
│   ├── requirements.txt              # Python dependencies
│   └── tests/test_api.py             # Pytest suite (security, ranking, stories, media, REST, WS)
├── render.yaml                       # Render blueprint for backend API + SQLite persistent disk
├── server/                           # Optional legacy Node.js WebSocket gateway
│   ├── package.json
│   ├── server.js                     # Optional in-memory WebSocket gateway
│   └── test_realtime.js              # Realtime gateway test script
├── docs/                             # Design specs & implementation plans
├── PROJECT_DOCUMENT.md
├── Product Requirements Document.md
├── System Design Document.md
└── dist/                             # Production build output (generated)
```

## How It Works

- **Python Backend + Offline Fallback:** When `npm run backend` (port `8000`) is running, auth, admin management, posts, likes, bookmarks, comments, follows, events, and messages persist to SQLite (`backend/socialconnect.db`) with HS256 JWT authentication and real-time `/ws` broadcasts. If the backend is unreachable (such as a static Vercel preview), `apiService` triggers a seamless fallback to browser `localStorage`.
- **Feed & Stories:** `GET /api/state` and `GET /api/feed` rank the **For you** feed via the Python time-decay gravity + affinity scorer (`backend/ranking.py`), while local seed data merges cleanly with per-account `localStorage` state.
- **Messaging:** The WebSocket gateway maintains presence and persistent SQLite conversations (`backend/realtime.py`), with simulated auto-replies from seeded contacts. Offline messages stay marked `LOCAL`.
- **Media:** Post images are validated client-side (≤ 2 MB). Google Fonts and Unsplash sample photos require internet access.

## Algorithms Used in the Codebase

| Algorithm / Technique | Location | Purpose & Complexity |
| --- | --- | --- |
| Time-Decay Gravity + Affinity Feed Ranking | `backend/ranking.py` | Scores **For you** posts by `(engagement / (age_hours + 2)^1.4) * (1 + follow_boost + 0.30 * jaccard)` in O(N log N) |
| Weighted Multi-Field Token Search Ranking | `backend/ranking.py` | Scores posts by author (`3.0`), tags/hashtags (`2.5`), content (`1.0`) + `0.25 * log1p(likes)` tie-breaker |
| Jaccard Creator Recommendation | `backend/ranking.py` | Ranks unfollowed creators via `2.0 * jaccard(interests, creator_topics) + 0.25 * mutuals` |
| PBKDF2-HMAC-SHA256 Password Hashing | `backend/security.py` | 100,000-iteration salted SHA-256 KDF with constant-time `hmac.compare_digest` verification |
| HMAC-SHA256 Signed JWT & Refresh Rotation | `backend/security.py`, `backend/database.py` | Signs HS256 JWTs with `jti`; rotates single-use refresh tokens and revokes JTIs on logout |
| SHA-256 Content-Addressed Media Storage | `backend/security.py`, `backend/main.py` | Hashes uploaded image/audio bytes (`sha256[:20].ext`) for O(1) deduplicated disk storage |
| 24-Hour TTL Story Grouping & Partitioning | `backend/database.py`, `src/components/StoriesBar.jsx` | Filters active stories (`expires_at > now_ms`), groups slides by user, and sorts unseen first |
| Sliding-Window Rate Limiter (`deque`) | `backend/security.py` | Per-IP `collections.deque` eviction protecting auth routes in amortized O(1) per request |
| Truncated Exponential Backoff | `src/services/socketService.js` | Reconnects WebSocket with `min(30000, 2000 * 2^attempt)` ms delay; resets on `auth:success` |
| Fanout-on-Write & Multi-Socket Routing | `backend/realtime.py`, `server/server.js` | `userId → Set<WebSocket>` O(k) direct routing & O(n) filtered broadcast for posts/likes/presence |
| Canonical Pair Keying | `backend/database.py`, `server/server.js` | `"::".join(sorted([userA, userB]))` for deterministic O(1) 1:1 conversation lookups |
| WebSocket Heartbeat Sweep | `server/server.js` | 30s ping/pong liveness check across `wss.clients`, terminating unresponsive sockets |
| Set-Based Seed Merging & Popularity Sort | `src/hooks/useSocialPlatform.js`, `src/components/ExploreView.jsx` | O(N + M) `Set` deduplication on persisted posts; O(N log N) descending like sort + substring filter |
| Unseen-First Story Partitioning | `src/components/StoriesBar.jsx` | Sorts unseen stories first and snapshots playback order when opening `StoryViewer` |
| Rolling 26-Week Heatmap Aggregation | `src/components/ProfileView.jsx` | 182-day `en-CA` date-bucket lookup in O(1) per cell quantized into 5 intensity levels |
| Password Scorer & PKCE Generator | `src/components/AuthView.jsx`, `src/services/authService.js` | 4-rule additive password strength score & OAuth 2.0 PKCE demo parameters |
| Debounce, Modulo Nav & Tokenization | `src/App.jsx`, `src/components/DialogModal.jsx`, `src/components/FeedView.jsx` | 1400ms typing debounce, circular modulo `(i ± 1 + len) % len` palette nav, `/(#\w+)/g` parsing |
| Procedural Domain-Warped WebGL Shader | `src/background.js` | 4-layer sinusoidal warping, radial twist, exponential tone mapping & 5-octave `grainHash` noise |

- **Time-Decay Gravity + Affinity Feed Ranking (`backend/ranking.py`):** Computes `engagement = 1.0 + 1.5 * likes + 2.5 * comments`, `decay = (age_hours + 2.0) ** 1.4`, and `affinity = 1.0 + follow_boost + 0.30 * jaccard(user_interests, post_tokens)` to balance freshness, engagement, followed creators, and topic overlap.
- **Weighted Multi-Field Token Search Ranking (`backend/ranking.py`):** Tokenizes queries and requires all terms to match across post fields, weighting author matches (`3.0`), tags/hashtags (`2.5`), and body text (`1.0`) plus a `0.25 * log1p(likes)` popularity tie-breaker.
- **Jaccard Creator Recommendation (`backend/ranking.py`):** Filters out already-followed accounts and ranks candidate creators by `2.0 * jaccard(interests, creator_topics) + 0.25 * mutuals`.
- **PBKDF2-HMAC-SHA256, HS256 JWT & Sliding-Window Rate Limiter (`backend/security.py`):** Hashes user passwords with 100,000 PBKDF2-HMAC-SHA256 iterations and 16-byte random salts (`hmac.compare_digest` verification), signs/verifies HS256 JWTs, and enforces per-client auth rate limits using `collections.deque`.
- **Truncated Exponential Backoff (`SocketService.scheduleRetry`):** Retries dropped WebSocket connections using `delay = Math.min(30000, 2000 * 2 ** attempt)` ms (`2s → 4s → 8s → 16s → 30s` cap) and resets `attempt = 0` upon `auth:success`.
- **Fanout-on-Write Broadcast & Multi-Socket Routing (`backend/realtime.py`, `server/server.js`):** Maintains `userId → Set<WebSocket>` for O(k) multi-tab direct delivery (`message:new`, `typing:indicator`, `message:read_receipt`, notifications) and O(n) filtered broadcast fanout (`post:new`, `post:like`, `presence:update`).
- **Canonical Pair Keying (`canonical_conversation_key` / `getConversationKey`):** Sorts `[userA, userB]` and joins with `'::'` so both participants deterministically map to a single conversation bucket regardless of sender/receiver order.
- **Feed Seed Merging, Stories Partitioning & Heatmap Aggregation:** `mergeSeedPosts` performs O(N + M) `Set` deduplication on persisted `localStorage` posts; `StoriesBar` partitions unseen stories first and snapshots playback order; `ProfileView` aggregates a 182-day rolling window into 5 intensity levels.
- **UI Helpers & Procedural WebGL Shader:** Regex hashtag tokenization (`/(#\w+)/g`), 1400ms trailing typing debounce, circular modulo `(i ± 1 + len) % len` command palette navigation, and a 4-iteration domain-warped WebGL fragment shader with 5-octave `grainHash` noise.

## Admin Demo Access

Select **Admin portal** on the shared sign-in card to open the protected user-management dashboard.

| Field | Demo value |
| --- | --- |
| Email | `admin@socialconnect.local` |
| Password | `Admin@12345` |

This is a local demo account. Authentication, passwords, and role enforcement currently use browser `localStorage` and mock JWTs; do not use these credentials in production.

## Build & Deploy

```sh
npm run build
npm run preview
```

Deploy the generated `dist/` folder to any static host (Vercel deployments are pre-configured via `vercel.json` with SPA rewrites to `/index.html`). To deploy the Python FastAPI + SQLite + WebSocket backend, use `backend/Dockerfile` and `render.yaml` (setting `VITE_API_URL` and `VITE_WS_URL` on the frontend). Always serve over HTTP/HTTPS rather than `file://` because the app uses ES modules.

## Demo Scope & Limits

- Accounts and per-account data are stored in per-browser `localStorage`.
- WebSocket gateway data is in-memory and resets when the server restarts.
- Visibility preferences, password reset, and OAuth flows are local UI demos only.
- Voice recording requires `localhost` or HTTPS plus microphone permission (60s limit).
- Post images are limited to 2 MB; remote fonts and sample photos require internet access.

## Docs

- `PROJECT_DOCUMENT.md` — business idea, users, features, stack, setup
- `Product Requirements Document.md` — MVP PRD (personas, FR-001…FR-083, ranking, metrics, release plan)
- `System Design Document.md` — target distributed architecture (feed fanout, messaging, media pipeline, schema, APIs)

The SDD describes the broader production target; the current implementation is the React 18 + Bootstrap 5 + Vite 6 client with an optional `ws` gateway.

## Requirements

- Node.js 20.19+ or 22.12+
- Modern desktop/mobile browser with ES modules, WebSocket, and WebGL support
- Internet access for Google Fonts and Unsplash sample photos (optional)
- Microphone permission for voice notes (optional)

## License

Private / academic demo — no license file included. Add one if you plan to distribute.
