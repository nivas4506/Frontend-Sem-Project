# Social Connectivity Platform — Project Document

## 1. Business Idea
Social Connectivity Platform is a community application for self-expression, social connection, and community participation. Users create expressive profiles, publish posts, discover relevant people and topics, communicate privately, and participate in events in one place.

Value proposition:
- Help people share moments and ideas.
- Help users discover relevant connections outside their existing network.
- Provide reliable one-to-one communication with understandable delivery status.
- Support community participation through events and RSVP.

## 2. Target Users
- Everyday sharer: profile, posts, reactions, comments, messages.
- Community organizer: events, attendance, updates.
- Discoverer: personalized feed, suggestions, search, events.
- Private communicator: direct messages with privacy control.
- Moderator: safety, reporting, and account controls.

## 3. Core Features
- Account registration and sign-in with local demo storage.
- Provider OAuth 2.0 demo flow with PKCE parameter display.
- Three-step onboarding: identity, interests, visibility preference.
- Feed with text/image posts, likes, threaded comments, share/copy.
- People suggestions and connect/remove connection.
- Creator/topic/content search with empty-result handling.
- Community events with RSVP and attendee count.
- Notifications/activity feed with live gateway events.
- Editable profile with avatar, bio, interests, and activity heatmap.
- Direct messaging with presence, typing indicators, read receipts, and voice notes.
- Command palette with `Ctrl+K` / `Cmd+K`.
- WebGL fiber background with alternate ocean-gradient mode and reduced-motion support.
- Responsive desktop navigation rail and mobile bottom navigation.

## 4. Tech Stack
- Frontend: HTML, CSS, plain JavaScript ES modules.
- No frontend UI framework or runtime UI libraries.
- Styling: `src/index.css`, `src/app.css`.
- Browser APIs: DOM, WebSocket, WebGL, MediaRecorder, Clipboard, localStorage, native `dialog`.
- Development/build tool: Vite 6 for `dev`, `build`, `preview`.
- Optional real-time gateway: Node.js with `ws` package.
- Required runtime: Node.js 20.19+ or 22.12+.

## 5. Project Structure
| File | Purpose |
| --- | --- |
| `index.html` | Entry, stylesheets, background canvas, dialog, notifications |
| `src/main.js` | Application state, navigation, events, persistence |
| `src/views.js` | HTML templates for screens and dialogs |
| `src/data.js` | Seed posts, contacts, topics, events, comments |
| `src/ui.js` | Escaping, SVG icons, avatars, toasts |
| `src/background.js` | Native WebGL background |
| `src/services/authService.js` | Local demo accounts and sessions |
| `src/services/socketService.js` | Native WebSocket connection and reconnect |
| `server/server.js` | Optional real-time gateway |
| `README.md` | Local setup and feature notes |

## 6. Local Setup
Run from the project root containing `index.html`:

```sh
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

For live presence, messages, typing indicators, likes, broadcasts, and simulated contact replies:

```sh
npm run server
```

The gateway defaults to port `4001`. Set `VITE_WS_URL` for another endpoint.

Production build:

```sh
npm run build
npm run preview
```

## 7. Demo Scope and Limits
- Accounts and per-account demo data use browser `localStorage`.
- Original auth storage keys are retained.
- OAuth, JWT, password reset, and visibility preferences are demo flows.
- Password reset does not send email.
- Seeded messaging contacts use simulated gateway replies.
- Without the gateway, messages are marked `LOCAL` and are not auto-sent later.
- Gateway data is in memory and resets on restart.
- Voice recording needs localhost or HTTPS, microphone permission, and is limited to 60 seconds.
- Post images are limited to 2 MB.
- Remote fonts and sample images require internet access.
