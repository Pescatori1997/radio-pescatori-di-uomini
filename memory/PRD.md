# PRD — Pescatori di Uomini (Radio Evangelica)

## Problem Statement
Web + mobile app for an Italian evangelical Christian radio "Pescatori di Uomini" launching in September. Modern, elegant, minimal style; navy/white/light-blue. Spotify/YouTube-Music fluidity. Sections: Home, Radio Player, Podcast, News, Palinsesto, Prayer Requests, Messages, Donations, Merchandising, About, Contact, Notifications, Account, Admin panel.

## User Choices
- Phase 1: Home + Player + Podcast + News + Palinsesto + Prayer + About/Contact + Account
- Auth: Emergent Google Auth + email/password
- Donations/Merch: informational only (no real payments yet)
- Push notifications: deferred
- Radio stream: demo Icecast placeholder (user will provide real URL later)

## Architecture
- Frontend: Expo SDK 54, expo-router (tabs + modals), expo-audio (persistent player context), expo-image, expo-blur, expo-linear-gradient, @gorhom/bottom-sheet installed.
- Backend: FastAPI + MongoDB (motor), all routes under /api. Session-token auth (7d) + Emergent Google OAuth session exchange.
- Persistent global PlayerProvider + AuthProvider in root layout; floating BlurView mini-player above bottom tabs.

## Implemented (2026-07-24)
- **Administrator Panel** (added, secure): Google-login restricted by backend env allowlist `ADMIN_EMAILS` (server-side validated; 401 unauth, 403 non-admin, "Accesso Negato" page). Dark CMS UI with sidebar (Dashboard, Team, + Coming Soon for Podcast/News/Palinsesto/Radio/Preghiere/Utenti/Impostazioni). Dashboard stat cards (pending apps, approved members, users, prayers, news, podcasts). **Team management fully functional**: applications list with status filters/sort/search, full application detail, edit-before-publish, Approve/Reject/Edit/Delete, member editor with official portrait upload + published toggle. Approve auto-creates & publishes the member in public L'Equipaggio; edits sync; reject/delete remove from public. Endpoints under /api/admin/*. Tested 58/58 backend pass; admin UI visually verified. Admin link appears in Profilo only for admins.
- **L'Equipaggio (crew) page** (added): premium character-card style, large vertical portrait cards (no circular avatars), tap → full profile (bio, ministero, programmi, versetto preferito, testimonianza). Founder **Luigi Volpe** as first member (pre-designed poster, `poster=true` renders full-bleed). "Entra nell'Equipaggio" section → application form (name, cognome, età, città, email, phone, ruolo, testimonianza, motivazione, esperienza, foto ritratto opz. via expo-image-picker). Applications stored in `crew_applications` (not public). Endpoints: GET /api/crew, GET /api/crew/{id}, POST /api/crew/applications. Removed old collaborators list from Chi Siamo → CTA to L'Equipaggio; Home teaser + Profilo menu link added.
- Design/branding sprint: official logo, cross-free Christian imagery, real studio hero background, premium cards/shadows, PressableScale + FadeInDown animations.
- Home: hero + logo/slogan, LIVE indicator (green/red), Ascolta la Diretta, now-playing, horizontal podcasts/news, weekly programs, prayer CTA.
- Player: full-screen modal (big artwork, play/pause, volume bar, seek bar for podcasts, LIVE tag, share) + persistent mini-player.
- Podcast: search + category chips filter, 2-col grid, tap-to-play.
- News: card feed + detail screen with share.
- Palinsesto: day-chip selector, program rows (name/time/host/description).
- Prayer Requests: form with anonymous toggle -> backend.
- Messages/Testimonies: text form (voice deferred).
- Account: email register/login + Google OAuth, profile with favorites & history, menu.
- About, Contact (channels + form), Donate (informational).
- Backend: live/status, podcasts(+search/category/categories), news(+detail), programs, prayer-requests, messages, contact, auth(register/login/me/logout/session), favorites toggle/list/ids, history add/list. Seed data on startup.
- Tested: 26/26 backend endpoints pass; frontend flows verified.

## Backlog (prioritized)
- P0: Real radio stream URL + now-playing metadata polling; favorite/download buttons on podcast cards; connect history tracking on play.
- P1: Donations via Stripe; Merchandising shop; Admin dashboard (podcasts/news/programs/messages/prayer/users); Notifications (Emergent push) on live/podcast/news.
- P1: Podcast download for offline; Apple Sign-In.
- P2: Voice messages (recording), search across news, tablet/desktop responsive polish, dark mode.

## Next Tasks
1. Wire real stream URL + metadata when provided.
2. Add favorite/download actions to podcast cards + play-history recording.
3. Build Admin panel + Merchandising + Stripe donations.

## Implemented (2026-07-24, session 2 — Admin sections completed)
- **Admin Palinsesto (Schedule)**: full CRUD of programs (`/api/admin/programs`, POST=201), day-based UI, editor screen.
- **Admin Radio**: configurable stream settings (station_name, stream_url, backup_url, metadata_url, is_live, now-playing title/artist/artwork) persisted to `live_status`; ready to accept real stream URL without code changes. Public `/api/live/status` reflects it.
- **Admin Prayer Requests**: workflow statuses new|in_progress|prayed|archived, internal admin_notes (private), list+search+filters, detail editor, delete. Public submission unchanged.
- **Admin Messages & Testimonies**: statuses new|reviewed|published|archived, type filter, editable text, internal notes. Published testimonies auto-appear in public `messages.tsx` via `GET /api/testimonies` (admin_notes stripped).
- **Admin Users**: list+search, is_admin flag, delete (admins protected, 400).
- **Admin Settings**: general contact/social/about persisted (`/api/admin/settings`), public `GET /api/settings`.
- **Quick fixes**: create_podcast/news/program return HTTP 201; testIDs on all new admin forms.
- Dashboard cards now route to real sections + added testimonies/messages/programs metrics.
- Tested: backend 26/26 new endpoints pass (iteration_6). Removed all "Coming Soon" placeholders.

## Remaining Backlog (prioritized)
- P1: Real Donations via Stripe (one-time + recurring, predefined + custom amounts, donation history, admin donations dashboard, test mode).
- P1: Merchandising module (admin CRUD catalog with images/prices/categories/sizes/colors/stock; public catalog "Available Soon", payment-ready data model).
- P2: Backend refactor server.py into feature routers/services/models.
- P2: Real radio stream URL wiring (waiting on user URL).
