# SocialConnect — Social Connectivity Platform

A modern dark-themed social media web application for self-expression, discovery, and community connection — featuring stories, a personalized feed, explore grid, direct messaging with voice notes, community events, notifications, and expressive user profiles.

> **Stack:** React 18 + Bootstrap 5 (`data-bs-theme="dark"`) + custom CSS (`src/index.css`, `src/app.css`), Vite 6 for dev/build, and Node.js + `ws` for an optional real-time WebSocket gateway.

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
| Browser APIs | DOM, WebSocket, WebGL, MediaRecorder, Clipboard, localStorage, `<dialog>` |
| Dev / Build | Vite 6 (`dev`, `build`, `preview`) |
| Realtime (optional) | Node.js + `ws` WebSocket gateway on port `4001` |
| Runtime | Node.js 20.19+ or 22.12+ |

## Getting Started

Run from the project root (folder containing `index.html`):

```sh
npm install
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173`).

For live messages, typing indicators, presence, likes, and post broadcasts, install server dependencies once and start the WebSocket gateway in a second terminal:

```sh
cd server && npm install && cd ..
npm run server
```

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run server` | Start realtime gateway (`server/server.js`) |
| `npm test` | Run Node test runner (`node --test test/*.test.js`) |

### Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_WS_URL` | `ws://localhost:4001` | WebSocket endpoint used by frontend |
| `PORT` | `4001` | Port for `server/server.js` gateway |

Example:

```sh
PORT=4001 node server/server.js
VITE_WS_URL=ws://localhost:4001 npm run dev
```

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
│   ├── hooks/                        # useAuth, useSocialPlatform, useSocket
│   ├── services/                     # authService (local demo auth), socketService (WS client)
│   └── utils/                        # toast notifications & media/storage helpers
├── server/
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

- **Auth:** Demo accounts and sessions are stored in browser `localStorage`. OAuth, JWTs, and password-reset dialogs are local UI flows — no external email or identity provider is used.
- **Feed & Stories:** Local seed data merges smoothly with per-account `localStorage` persistence (including posts, likes, comments, follows, saved bookmarks, and seen stories), with live like/post broadcasts when the WebSocket gateway is running.
- **Messaging:** The WebSocket gateway maintains presence and in-memory conversations, with simulated auto-replies from seeded contacts. Offline messages stay marked `LOCAL`.
- **Media:** Post images are validated client-side (≤ 2 MB). Google Fonts and Unsplash sample photos require internet access.

## Algorithms Used in the Codebase

| Algorithm / Technique | Location | Purpose & Complexity |
| --- | --- | --- |
| Truncated Exponential Backoff | `src/services/socketService.js` | Reconnects WebSocket with `min(30000, 2000 * 2^attempt)` ms delay; resets on `auth:success` |
| Fanout-on-Write & Multi-Socket Routing | `server/server.js` | `userId → Set<WebSocket>` O(k) direct routing & O(n) filtered broadcast for posts/likes/presence |
| Canonical Pair Keying | `server/server.js` | `[userA, userB].sort().join('::')` for deterministic O(1) 1:1 conversation `Map` lookup |
| WebSocket Heartbeat Sweep | `server/server.js` | 30s ping/pong liveness check across `wss.clients`, terminating unresponsive sockets |
| Set-Based Seed Merging & Popularity Sort | `src/hooks/useSocialPlatform.js`, `src/components/ExploreView.jsx` | O(N + M) `Set` deduplication on persisted posts; O(N log N) descending like sort + substring filter |
| Unseen-First Story Partitioning | `src/components/StoriesBar.jsx` | Sorts unseen stories first and snapshots playback order when opening `StoryViewer` |
| Rolling 26-Week Heatmap Aggregation | `src/components/ProfileView.jsx` | 182-day `en-CA` date-bucket lookup in O(1) per cell quantized into 5 intensity levels |
| Password Scorer, Base64URL JWT & PKCE | `src/components/AuthView.jsx`, `src/services/authService.js` | 4-rule additive password strength score; Base64URL RS256-structured mock JWT & PKCE params |
| Debounce, Modulo Nav & Tokenization | `src/App.jsx`, `src/components/DialogModal.jsx`, `src/components/FeedView.jsx` | 1400ms typing debounce, circular modulo `(i ± 1 + len) % len` palette nav, `/(#\w+)/g` parsing |
| Procedural Domain-Warped WebGL Shader | `src/background.js` | 4-layer sinusoidal warping, radial twist, exponential tone mapping & 5-octave `grainHash` noise |

- **Truncated Exponential Backoff (`SocketService.scheduleRetry`):** Retries dropped WebSocket connections using `delay = Math.min(30000, 2000 * 2 ** attempt)` ms (`2s → 4s → 8s → 16s → 30s` cap) and resets `attempt = 0` upon `auth:success`.
- **Fanout-on-Write Broadcast & Multi-Socket Routing (`server/server.js`):** Maintains `connectedClients` (`Map<userId, Set<WebSocket>>`) for O(k) multi-tab direct delivery (`sendToUser` for `message:new`, `typing:indicator`, `message:read_receipt`, and notifications) and O(n) filtered `broadcast` fanout (`post:new`, `post:like`, `presence:update`).
- **Canonical Pair Keying (`getConversationKey`):** Sorts `[userA, userB].sort().join('::')` so both participants deterministically map to a single O(1) `Map` bucket regardless of sender/receiver order.
- **WebSocket Heartbeat Sweep:** Runs a 30-second ping/pong sweep across `wss.clients`, marking `isAlive = false`, sending `ws.ping()`, and calling `ws.terminate()` on sockets that fail to respond before the next interval.
- **Feed Ordering, Set-Based Seed Merging & Popularity Ranking:** New posts prepend in reverse-chronological order and filter by `following` + `user.id` on the **Following** tab. `mergeSeedPosts` uses a `Set` of existing post IDs (O(N + M)) to merge new seed posts into `localStorage` without duplicating or overwriting user posts. `ExploreView` sorts popular posts descending by likes (`b.likes - a.likes`, O(N log N)) and performs case-insensitive multi-field substring filtering across `content`, `author.name`, `author.handle`, and `tags`.
- **Stories Unseen-First Partition Sorting (`StoriesBar.jsx`):** Sorts unseen stories before seen ones via `Number(seen.includes(a.id)) - Number(seen.includes(b.id))` and snapshots the list when `StoryViewer` opens so marking a story seen does not reshuffle slides mid-playback.
- **26-Week Rolling Calendar Heatmap Aggregation (`ProfileView.jsx`):** Builds a 182-day rolling window ending today, indexing daily `en-CA` date buckets in O(1) per cell and clamping counts to 5 intensity levels (`Math.min(4, count)`).
- **Password Strength Heuristic, Base64URL JWT & PKCE Generation (`AuthView.jsx`, `authService.js`, `server/server.js`):** Scores passwords on 4 additive checks (length ≥ 8, digit, uppercase letter, special character → `Weak` / `Fair` / `Good` / `Strong`), encodes/decodes Base64URL RS256-structured mock JWT payloads (`iat`/`exp` 15-minute window), and generates demo OAuth 2.0 PKCE parameters (`state`, `codeVerifier`, `codeChallenge`).
- **UI & Text Processing Helpers:** Regex hashtag tokenization (`/(#\w+)/g` in `RichText`), 1400ms trailing typing-indicator debounce (`handleStartTyping` in `App.jsx`), circular modulo indexing (`(i ± 1 + len) % len`) for `Ctrl+K` command palette keyboard navigation, and keyword-matched rule-based auto-replies (`simulatePartnerResponse` in `server/server.js`).
- **Procedural WebGL Domain-Warped Fragment Shader & 5-Octave Grain Noise (`background.js`):** Executes a 4-iteration sinusoidal domain warp with radial polar twist (`atan`/`cos`/`sin`), exponential ridge and glow accumulation, vignette attenuation, exponential tone mapping (`1.0 - exp(-color * 2.0)`), and 5-octave weighted `grainHash` noise to suppress color banding.

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

Deploy the generated `dist/` folder to any static host (Vercel deployments are pre-configured via `vercel.json` with SPA rewrites to `/index.html`). Always serve over HTTP/HTTPS rather than `file://` because the app uses ES modules.

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
