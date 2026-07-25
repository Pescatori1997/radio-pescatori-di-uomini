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
- P2: Backend refactor server.py into feature routers/services/models.
- P2: Real radio stream URL wiring (waiting on user URL).

## Implemented (2026-07-24, session 3)
- **WhatsApp premium section** in Home: pannello glassmorphism navy, 3 feature card (Domande Bibliche / Richieste di Preghiera / Testimonianze), pulsante verde con pulse animation → wa.me/393517556255, disclaimer dirette lun/mer/dom.
- **Merchandising module (catalog-only, payment-ready)**:
  - Public: `/merch` catalog (hero + CTA, search istantanea, filtri categoria, griglia responsive glass card con badge Featured/Disponibilità, empty-state) + `/merch/[id]` modal (gallery multi-immagine, colori, taglie, prezzo, disponibilità, pulsante WhatsApp wa.me/393517556255). Linkato da Profilo.
  - Admin `/admin/products`: CRUD completo, upload multi-immagine, categoria/prezzo/colori/taglie/disponibilità (available|coming_soon|sold_out), Featured, mostra/nascondi, riordino (frecce su/giù → order) — tutto gestibile senza toccare il codice.
  - Backend: `products` collection; public GET /products(+search/category/categories/{id}), admin CRUD (+201, validazione availability) + /admin/products/reorder. Tested 17/17 (iteration_7).
- Nota: drag & drop sostituito da controlli freccia su/giù per affidabilità cross-web/native.

## Implemented (2026-07-24, session 4 — RBAC Authentication)
- **Sistema RBAC completo** con 3 ruoli: `administrator` (auto-assegnato dalle email in `ADMIN_EMAILS`), `collaborator` (permessi per-sezione), `listener` (default). Modalità **Ospite** (sola lettura) per navigazione senza account.
- **Backend**: auth endpoints (register/login/session/me) salvano e restituiscono `role`+`permissions`; `get_current_user` normalizza il ruolo (admin allowlist sempre prioritaria). Nuovo `PUT /api/admin/users/{uid}/role` (admin-only) per assegnare Collaboratore + permessi. `GET /api/admin/me` ora ammette anche i collaboratori (con permessi). Endpoint contenuti admin (podcasts/news/merch/schedule/radio/prayers/messages) protetti con `require_perm(section)`; team/utenti/impostazioni/dashboard restano admin-only.
- **Frontend**: schermata gate `/welcome` (login classico + Google + "Continua come Ospite") mostrata al primo avvio finché l'utente non accede o sceglie Ospite (gate in `_layout.tsx`). Flag ospite persistito in `pdu_guest_mode`. Restrizioni Ospite: prompt di login su Preghiere, Messaggi, e preferiti podcast. AuthContext esteso con `role/permissions/guestChosen/isAdmin/isCollaborator/can()`.
- **Admin > Utenti**: badge ruolo + modale per assegnare Collaboratore e selezionare le sezioni gestibili. Sidebar del pannello filtrata per permessi del collaboratore.
- Tested: backend 23/23 (iteration_8), frontend 6/6 flussi. 100% pass. Nessuna regressione.

## Remaining Backlog after session 4 (prioritized)
- P0/tech-debt: refactor `server.py` (~1375 righe) in APIRouter modulari (auth, team, podcast, news, radio, schedule, prayers, messages, merch, users, settings).
- P1: Donazioni reali con Stripe (test mode).
- P2: URL streaming radio reale (configurabile da Admin > Radio, in attesa URL AzuraCast).
- P3: migrare props deprecate RN Web (`shadow*` → `boxShadow`, `pointerEvents`).

## Implemented (2026-07-24, session 5 — User & Roles Management)
- **Welcome**: rimossa la card "Amministrazione" (3 card: Accedi/Registrati/Ospite). Dopo il login di un Amministratore, redirect automatico a `/admin` (gate in `_layout.tsx`).
- **Backend**: campo `status` (active|suspended) + `last_login`; suspended bloccato al login/sessione. `GET /admin/users` con filtri role/status e sort. Nuovi endpoint: `PUT /admin/users/{uid}/status`, inviti (`POST/GET/DELETE /admin/invitations`, pubblici `GET /invitations/{token}` + `POST /invitations/{token}/accept`), `GET /admin/activity`. Email inviti via Emergent Resend (best-effort; `EMERGENT_EMAIL_KEY` vuota in dev → link mostrato). Audit `log_activity()` su ruoli/stato/eliminazione utenti e su create/edit contenuti. PERM_SECTIONS = podcasts,news,merch,schedule,prayers,messages,team,radio; endpoint Team ora `require_perm("team")`.
- **Frontend**: `/admin/users` "Gestione Utenti" (tabella responsive foto/nome/email/ruolo/stato/ultimo accesso/registrato + menu azioni kebab, ricerca, filtri ruolo/stato, ordinamento, modale permessi con toggle, modale invito + inviti pendenti copy/revoke). `/admin/activity` registro attività per giorno. `/invite` accettazione pubblica. AuthContext: `acceptInvite`. AdminShell: voce "Registro Attività".
- Tested: backend 17/17 (test_rbac_v2), frontend 14/14 flussi — 100% pass. Nessuna regressione.

## Implemented (2026-07-24, session 6 — AzuraCast reale)
- **Radio demo → AzuraCast reale**, production-ready, UI/architettura invariate. Stream `http://84.247.184.136/listen/pescatori/radio.mp3`, Now Playing `http://84.247.184.136/api/nowplaying/pescatori`.
- **Backend**: `/api/live/status` recupera i metadati AzuraCast server-side (titolo/artista/artwork/listeners/is_online) e non lancia mai eccezioni (fallback "In Diretta"). Nuovi proxy HTTPS: `/api/live/stream` (StreamingResponse pass-through dell'MP3, follow_redirects; 503 se offline) e `/api/live/art` (proxy copertina, follow_redirects) — risolvono mixed-content su web e ATS su iOS. Model radio + campo `refresh_interval`; seed migra automaticamente lo stream demo a quello reale.
- **Frontend**: `api.liveStatus()` riscrive l'artwork HTTP nel proxy `/api/live/art`; `liveStreamUrl()` usa il proxy HTTPS. `PolyerContext` fa polling metadati ogni `refresh_interval` (15s), aggiorna titolo/artista/copertina del brano live in tempo reale, e riconnette automaticamente lo stream con stati connessione **online/reconnecting/offline** senza crash. Player mostra titolo, artista, artwork, stato diretta e n° ascoltatori. Admin Radio Settings modificabile (stream/API/intervallo) senza toccare il codice.
- Nota: la stazione è **offline** al momento (stream 502/503) → l'app gestisce tutto in modo graceful; funzionerà appena la radio va in onda.
- Tested: backend 15/15 (test_radio_azuracast), frontend 100% (iteration_10). Nessuna regressione.

## Implemented (2026-07-24, session 7 — Radio Control Center)
- **Radio Control Center** nel pannello admin (`/admin/control`): gestione della stazione AzuraCast senza aprire la dashboard AzuraCast.
- **Stato in tempo reale** (auto-refresh 8s): Radio Online/Offline, Icecast (frontend) e Liquidsoap (backend) running, ascoltatori, brano corrente (titolo/artista/copertina).
- **Controlli**: Avvia / Ferma / Riavvia (Start/Stop idempotenti: controllano prima lo stato). Toast successo/errore senza refresh pagina.
- **Live Mode**: Avvia Diretta (ferma AutoDJ via `backend/stop` + `live_mode=true`) / Termina (riavvia AutoDJ + `live_mode=false`). URL "Watch Live" configurabile dal pannello.
- **App mobile**: con `live_mode=true` → banner rosso "LIVE NOW" + pulsante "Watch Live" (apre l'URL configurato) e la radio player viene nascosta/fermata; con `live_mode=false` → player ripristinato.
- **Backend**: `GET /admin/radio/status`, `POST /admin/radio/control`, `POST /admin/radio/live` (require_perm radio); AzuraCast via `X-API-Key` (env `AZURACAST_API_KEY` + override da pannello); la key è mascherata nelle risposte (`has_api_key`). `/api/live/status` espone `live_mode` + `live_watch_url`. Azioni loggate nell'audit.
- Tested: backend 18/18 (test_radio_control), frontend 100% (iteration_11). Stazione lasciata online, nessuna regressione.

## Implemented (2026-07-25, session 8 — Multi-platform Live Streaming)
- **Estensione Live Mode** (logica esistente invariata): sostituito il singolo "Watch Live URL" con più piattaforme.
- **Nuova sezione admin `/admin/streaming` "Live Streaming"**: URL configurabili per YouTube, Facebook Live, TikTok Live, Instagram Live, Sito Web, Custom. Salvati in `live_status.live_links` via `PUT /api/admin/radio` (campi vuoti scartati). Il Control Center ora rimanda a questa sezione (rimosso l'input singolo).
- **App mobile**: con Live Mode attivo, "Watch Live" apre un modal "Dove vuoi guardare la diretta?" con SOLO le piattaforme configurate; 1 sola → apertura diretta senza modal; 0 → fallback al vecchio `live_watch_url`. Componente riutilizzabile `WatchLiveModal` + config condivisa `src/livePlatforms.ts`.
- `live_links` esposto in `/api/live/status` e `/admin/radio/status`.
- Tested: backend 11/11 (test_live_streaming, run con `-n 0`), frontend 100%. Nessuna regressione.

## Implemented (2026-06, session 9 — Weather Widget + Donazioni Stripe)
- **Weather Widget**: validato e2e (iteration_13, 100%). Open-Meteo keyless, ricerca città manuale, posizione dispositivo, pagina `/weather` con dettagli + previsioni 5 giorni, caching offline. Nessun issue.
- **Donazioni reali con Stripe (TEST MODE)** via `emergentintegrations` (Emergent-managed key `sk_test_emergent`, routing proxy). **Solo one-time** (la lib Emergent non supporta subscription): importi predefiniti €5/€10/€25/€50 + personalizzato (validati server-side, min €1 max €5000).
  - Backend: `POST /api/donations/checkout` (anonimo o auth → success/cancel URL da origin), `GET /api/donations/status/{session_id}` (polling idempotente, aggiorna transazione), `POST /api/webhook/stripe` (handle_webhook idempotente), `GET /api/me/donations` (storico utente, auth), `GET /api/admin/donations` + `/admin/donations/stats` (admin-only: total/count/average/donors/last_30_days). Collezione `donation_transactions`. `/admin/stats` include conteggio `donations`.
  - Frontend: `/donate` (preset + custom + nome/messaggio → checkout), `/donation-success?session_id=` (polling esito, bypassa welcome gate), `/donations-history` (storico utente + totale, linkato da Profilo per utenti loggati), `/admin/donations` (card statistiche + storico, voce sidebar + card dashboard).
  - Su web redirect via `window.location`; su native `WebBrowser.openBrowserAsync` + navigazione a success.
  - NOTA: le donazioni RICORRENTI (mensili) NON sono implementabili con la key Emergent (solo one-time). Richiedono chiavi Stripe reali dell'utente.
  - Tested: backend 13/13 (test_donations), frontend 100%. Nessuna regressione.

## Implemented (2026-06, session 10 — Chi Siamo editabile)
- **Pagina "Chi Siamo"** aggiornata con i nuovi contenuti (titolo, versetto Matteo 4:19, descrizione a 4 paragrafi, 3 feature card, citazione finale) mantenendo layout/hero/animazioni/icone/responsività.
- Tutti i testi ora provengono da `GET /api/settings` (con fallback ai default) e sono **editabili da Admin > Impostazioni** → sezione "Pagina Chi Siamo" (campi: titolo, sottotitolo, descrizione, 3 card titolo+testo, citazione). Modello `GeneralSettings` esteso con campi `about_*`; default seedati allo startup (merge solo delle chiavi mancanti, non sovrascrive gli edit admin). Aggiunta card citazione finale in fondo alla pagina.

## Fixed (2026-06, session 11 — Contatti data-binding)
- **BUG**: la pagina pubblica `/contact` mostrava contatti HARDCODED (email/whatsapp/instagram/facebook fittizi) e ignorava le modifiche fatte da Admin.
- **FIX**: rimosso tutto l'hardcode; `/contact` ora costruisce dinamicamente le righe da `GET /api/settings` (email, telefono, whatsapp, indirizzo, sito web, facebook, instagram, youtube), mostrando solo i campi valorizzati. Azioni corrette (mailto/tel/wa.me/maps/URL). Aggiunto nuovo campo `website` al modello `GeneralSettings`, al seed e al form Admin > Impostazioni. UI/layout invariati.
- Sincronizzazione Admin → pagina pubblica immediata dopo il salvataggio. Tested: backend 8/8 (test_contact_settings, `-n0`), frontend 100% (iteration_15).

## Reviewed (2026-06, session 12 — Revisione linguistica italiana completa)
- Revisione completa di tutte le stringhe utente (schermate pubbliche, admin, componenti, messaggi backend, template email).
- Rimosso testo inglese residuo e uniformata la terminologia: "News"→"Notizie" (tab, header, nav admin, dashboard, permessi, invito), "LIVE NOW"→"IN DIRETTA", "OFFLINE"→"NON IN ONDA", "Watch Live"→"Guarda la diretta", "Radio Control Center"→"Centro di Controllo Radio", "Live Streaming"→"Dirette Streaming", "Admin Panel"→"Pannello Admin", "Live Mode"→"Modalità Diretta", "Radio Online/Offline"→"Radio in onda/non in onda", "DIRETTA LIVE ATTIVA"→"DIRETTA ATTIVA", "Avvia Diretta LIVE"→"Avvia Diretta", "Featured"→"In evidenza", "Card N"→"Scheda N", "Altro / Custom"→"Altro / Personalizzato", "Now Playing"→"brano in onda" (testo UI), versetto Salmo 34:18 reso più naturale ("cuore spezzato").
- Verificato via testing_agent (iteration_16, frontend, mobile 390x844): nessun testo troncato/sovrapposto, stringhe italiane corrette in tutte le schermate. Le 4 stringhe residue segnalate sono state corrette.
