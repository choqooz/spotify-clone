# Resonance — Music Streaming Platform

A full-featured music streaming platform built with React, Node.js, and MongoDB. Stream music from YouTube, manage playlists, download tracks, and enjoy a rich real-time experience — installable as a Progressive Web App.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![CI](https://img.shields.io/github/actions/workflow/status/choqooz/spotify-clone/ci.yml?label=CI&logo=githubactions&logoColor=white)

---

## Features

**Playback**
- YouTube music search and streaming (songs and videos)
- Queue management with shuffle and repeat modes (none / all / one)
- Persistent player preferences — volume, shuffle, and repeat survive page refresh
- Keyboard shortcuts: `Space` play/pause, `←/→` prev/next, `↑/↓` volume, `M` mute, `S` shuffle, `R` repeat, `L` lyrics

**Library**
- Favorites / liked songs
- Playlists — create, edit, add/remove songs
- Album browsing and playback

**Downloads**
- Download songs and videos in multiple formats (mp3, m4a, flac, wav, mp4, webm)
- Format selection with quality info (bitrate, resolution, file size)
- Real-time download progress via WebSocket
- Album batch downloads

**Social**
- Real-time chat between users
- See what others are listening to
- Online/offline status

**Admin**
- Upload songs and albums (Cloudinary storage)
- User management
- Analytics dashboard

**Technical**
- Progressive Web App — installable on mobile and desktop
- Skeleton loading states for perceived performance
- Error boundaries — YouTube crashes don't kill the app
- Offline detection banner
- Accessible: ARIA labels, landmarks, semantic HTML, keyboard navigation, skip link
- API documentation at `/api/docs` (Swagger UI)
- Sentry error tracking (optional)

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript (strict), Zustand 5, Tailwind CSS, Vite 8, Radix UI |
| **Backend** | Node.js 22, Express, MongoDB / Mongoose, Socket.IO, youtubei.js, pino |
| **Auth** | Clerk (JWT) |
| **Infrastructure** | GitHub Actions CI, Docker, Sentry, Swagger/OpenAPI, vitest (89 tests) |
| **Storage** | Cloudinary (media), MongoDB Atlas (data) |

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm
- MongoDB (local or Atlas)
- Clerk account (for authentication)
- Cloudinary account (for media uploads)

### Installation

```bash
git clone https://github.com/choqooz/spotify-clone.git
cd spotify-clone

# Backend
cd backend
cp .env.example .env    # Fill in your values
pnpm install
pnpm dev

# Frontend (new terminal)
cd frontend
cp .env.example .env    # Fill in your values
pnpm install
pnpm dev
```

The frontend runs at `http://localhost:3000`, backend at `http://localhost:5000`.

### Docker

```bash
docker compose up --build
```

Serves everything at `http://localhost:5000`.

---

## API Documentation

Interactive API docs are available at `/api/docs` when the server is running (Swagger UI). All endpoints are documented with request/response schemas.

---

## Testing

```bash
cd backend
pnpm test          # Run all 89 tests
pnpm test:watch    # Watch mode
```

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── controller/       # Route handlers
│   │   ├── lib/              # Shared utilities (db, logger, socket, sentry, swagger)
│   │   ├── middleware/       # Auth, error handling, rate limiting
│   │   ├── models/           # Mongoose schemas
│   │   ├── routes/           # Express routes (annotated with Swagger)
│   │   └── services/         # Business logic (downloadService, formatAnalyzer)
│   └── vitest.config.js
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI (ErrorBoundary, skeletons, OfflineBanner)
│   │   ├── hooks/            # Custom hooks (useKeyboardShortcuts)
│   │   ├── layout/           # MainLayout, AudioPlayer, PlaybackControls, Sidebar
│   │   ├── lib/              # Axios config, utils, sentry
│   │   ├── pages/            # Route pages (home, search, album, favorites, playlist, admin)
│   │   ├── providers/        # Auth provider
│   │   ├── stores/           # Zustand stores (player, download, youtube, music, chat)
│   │   └── types/            # Shared TypeScript interfaces
│   └── vite.config.ts
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` | Previous track |
| `→` | Next track |
| `↑` | Volume up |
| `↓` | Volume down |
| `M` | Mute / Unmute |
| `S` | Toggle shuffle |
| `R` | Cycle repeat (off → all → one) |
| `L` | Toggle lyrics |

---

## License

MIT
