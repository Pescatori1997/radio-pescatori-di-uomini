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

## Implemented (2026-06, session 13 — Sistema Account Utente completo + Notifiche Push)
**Audit account:** già presenti registrazione, login, logout, Google OAuth, ruoli/permessi RBAC, gestione utenti admin.
**Aggiunto (Fase A — testabile):**
- Recupero password: `POST /auth/forgot-password` (fallback: mostra il codice a schermo finché Resend non è attivo) + `POST /auth/reset-password` (codice 6 cifre, scadenza 30 min, invalida sessioni). Schermata `/reset-password` (2 step) + link "Password dimenticata?" su /auth.
- Cambio password: `POST /auth/change-password`. Modifica profilo (nome + avatar via image picker): `PUT /auth/profile`. Schermata `/account`. AuthContext esteso con `updateProfile`/`refreshUser`.
- Preferenze notifiche: `GET/PUT /me/notifications` (7 categorie, default ON). Schermata `/notifications-settings` con toggle. Voci Profilo "Il mio account" e "Notifiche".
**Aggiunto (Fase B — Push, verificabile solo dopo Deploy+build):**
- Integrazione Emergent managed push (SuprSend) per playbook: `POST /register-push` (relay), helper `send_push` (chunk 100), `notify_category` (rispetta preferenze + status), log in `notifications_log`.
- Auto-notifiche: nuovo podcast/meditazione (category con 'meditaz'), nuova notizia (published), avvio diretta. Hook non bloccanti (try/except).
- Admin: `POST /admin/notifications/send` (invio manuale), `GET /admin/notifications` (storico), `GET /admin/notifications/audience` (conteggio per categoria). Schermata `/admin/notifications` (chip categoria, anteprima live, destinatari, storico) + voce sidebar + card dashboard.
- Frontend: `_layout.tsx` con setNotificationHandler + channel (module scope), tap handler warm/cold + nudge settimanale; `src/utils/push.ts` registerForPush (native-only, non bloccante) chiamato al login; `app.json` con plugin expo-notifications + `android.googleServicesFile` (placeholder) + permesso POST_NOTIFICATIONS.
- `EMERGENT_PUSH_KEY=placeholder` in backend/.env (sostituito automaticamente al Deploy). L'invio push reale funziona SOLO dopo Deploy + build iOS/Android; in preview lo stato dei log è 'failed' (atteso).
- Tested: backend 28/28 (test_notifications_account, iteration_17), frontend tutti i flussi Fase A OK. Push native-only non testabile in Expo Go/web.
**PENDING utente:** fornire `google-services.json` (Android) prima del build; Google service account JSON + APNs .p8 (iOS) durante la generazione build.

## Implemented (2026-06, session 14 — Sezione Meditazioni)
- Nuova sezione dedicata **Meditazioni** (video meditazioni cristiane), entità separata dai podcast.
- **CMS Admin** (`/admin/meditations`): CRUD completo (crea/modifica/elimina), video YouTube o link diretto, miniatura (image picker), titolo, oratore, versetto (opzionale), descrizione, categoria, data pubblicazione, Bozza/Pubblica, **programmazione** (publish_date futura → visibile e notificata alla data), ricerca e filtro per stato. Permesso RBAC `meditations` (aggiunto a PERM_SECTIONS).
- **App pubblica**: nuovo tab **Meditazioni** con card responsive (miniatura/titolo/oratore/versetto/data/descrizione), ricerca per titolo, filtro per categoria; dettaglio `/meditazioni/[id]` con player video (WebView su native, iframe su web via `VideoEmbed.web.tsx`), condivisione e "Apri su YouTube".
- **Notifiche**: invio automatico categoria `meditations` alla pubblicazione (immediata o programmata via `_flush_scheduled_meditations`), rispettando le preferenze utente. Push reale attiva dopo Deploy (key placeholder → log 'failed' in preview, atteso).
- Backend: collezione `meditations`, endpoint public (`/meditations`, `/meditations/categories`, `/meditations/{id}`) e admin CRUD; `/admin/stats` include conteggio `meditations`.
- Navigazione: tab pubblico, voce sidebar admin, card dashboard admin, label permesso in Utenti/Inviti, tipo `PermSection` esteso.
- Tested: backend 14/14 (test_meditations, iteration_18), frontend tutti i flussi OK (incluso flusso E2E crea→pubblica→visibile). Player web via iframe verificato.

## Fixed (2026-06, session 15 — Eliminazione Meditazioni + confirm cross-platform)
- **BUG**: l'eliminazione delle meditazioni (e l'eliminazione account) non funzionava nel preview web perché `Alert.alert` è un no-op su react-native-web → la conferma e la callback non partivano mai.
- **FIX**: nuovo helper `src/utils/confirm.ts` — `confirmAsync` (window.confirm su web / Alert.alert su native) + `alertMessage` (window.alert/Alert). Usato in `/admin/meditations/[id].tsx` (eliminazione con conferma + messaggio di successo, e feedback validazione/errore del salvataggio) e in `/account.tsx` (eliminazione account).
- Miniature salvate come base64 nel documento Mongo (nessun file storage separato) → eliminando il record si rimuove anche l'immagine: nessun file orfano. Lista admin già in refresh su focus → aggiornamento automatico dopo delete.
- Tested: backend 14/14 + UI E2E (crea/modifica/elimina, DB pulito, 404 dopo delete, nessun residuo, non-regressione pubblico) — iteration_22. Grafica/UX invariate.

## Implemented (2026-06, session 16 — Segnala un problema / Feedback)
- Nuova sezione **"Segnala un problema"** (feedback/bug report). Gli utenti (anche Ospiti) inviano segnalazioni con categoria (Bug/Suggerimento/Problema tecnico/Altro), titolo, descrizione e allegati facoltativi (screenshot + video via image picker, base64).
- **Backend**: `POST /api/reports` (auth opzionale; validazione categoria/titolo/descrizione => 400; allegati > 12MB => 413; cattura utente se loggato altrimenti "Ospite"). Admin (require_admin): `GET /admin/reports` (filtri stato/categoria/ricerca, sort, esclude base64 pesanti dalla lista), `GET /admin/reports/unread-count`, `GET /admin/reports/{id}` (segna letto), `PATCH /admin/reports/{id}` (stato new|in_progress|resolved|closed, log attività), `DELETE /admin/reports/{id}`. Collezione `reports`; `/admin/stats` include `reports` + `reports_new`.
- **Frontend**: form pubblico `/report` (chip categoria, validazione, allegati, success state) linkato dal menu Profilo ("Segnala un problema"). Admin `/admin/reports` (lista con badge non letti, filtri, ricerca, sort) + `/admin/reports/[id]` (cambio stato, render screenshot/video base64 via VideoEmbed, elimina con confirmAsync). Voce sidebar "Segnalazioni" in AdminShell + card dashboard con badge nuove.
- Tested: backend 19/19 (test_reports, iteration_23), frontend flusso pubblico E2E OK (Ospite → Profilo → Segnala → invio → success). Nessun bug. Admin UI dietro gate Google (coperta a livello API).

## Implemented (2026-06, session 17 — PWA web installabile + deploy Vercel)
- La web app (Expo web / react-native-web) è ora una **PWA installabile**. L'app mobile nativa Expo resta invariata (nessuna modifica a feature/UI/logica nativa).
- **File PWA** (in `frontend/public/`): `manifest.json` (tema navy #0A1128, display standalone, lingua IT, categorie), icone `icons/` 192/512 + maskable + apple-touch-icon (generate dal logo), `sw.js` service worker.
- **Service worker**: navigazioni network-first (contenuti freschi online + fallback app-shell offline), asset statici stale-while-revalidate, cache versionata. NON intercetta mai cross-origin → API, streaming AzuraCast, YouTube e Stripe passano sempre dalla rete.
- **Injection tag `<head>`**: produzione via `scripts/inject-pwa.js` (post `expo export -p web`, poiché in output "single" `+html.tsx` è ignorato); dev/anteprima via `src/utils/pwa.web.ts` (chiamato da `_layout.tsx`, no-op su nativo, idempotente).
- **Deploy Vercel**: `frontend/vercel.json` (root=frontend, install `yarn --ignore-scripts`, build `expo export -p web && inject-pwa`, output `dist`, rewrite SPA, header SW/manifest/icons). Backend su Emergent full-stack; frontend punta a `EXPO_PUBLIC_BACKEND_URL`. Guida completa in `/app/DEPLOY_PWA_VERCEL.md`.
- Verificato: build `dist` corretto (manifest/sw/icone + tag head iniettati), service worker registrato (scope "/", active) nell'anteprima, manifest valido, CORS cross-origin OK (preflight echo origin per il dominio Vercel), Stripe success/cancel URL su origin frontend.

## Implemented (2026-06, session 18 — Meditazioni multi-formato)
- Rifacimento completo delle **Meditazioni** (retrocompatibile): oltre ai link YouTube, ora supporta **upload diretti** (video MP4/MOV/WEBM fino a 1GB, audio MP3/M4A/WAV, PDF) e **embed** YouTube/Vimeo/Facebook/Instagram/TikTok/Spotify. Nessuna funzionalità rimossa.
- **Backend**: GridFS bucket `media`; **upload a blocchi** (`/admin/uploads/init|chunk|complete`); **streaming Range** su `GET /api/media/{id}` (206) + `?download=1`. **ffmpeg/ffprobe** installati -> copertina auto dal video + durata. Modello esteso (subtitle, duration, media_id/type/mime/filename, downloadable, attachments); `content_type`+`provider` calcolati; sostituzione media elimina il vecchio GridFS; delete pulisce i media. Bozza/Pubblica/Programma mantenuti.
- **Frontend**: editor admin upload-o-link + progress + sostituzione file + tutti i campi; **player unificato in-app** (MeditationPlayer web=DOM, native=WebView: video/audio HTML5, PDF via Google gview, embed provider); schermata utente con Riproduci/Scarica/Condividi + metadati; badge tipo+durata sulle card.
- Tested: **backend 22/22** (iteration_24, tests/test_meditations_media.py) + flusso pubblico Ospite E2E OK. Nessun bug. Admin UI dietro gate Google (coperta a livello API). Copertina auto server-side con ffmpeg su richiesta utente.

## Implemented (2026-06, session 19 — Donazioni LIVE + Merch checkout)
- **Pagamenti reali Stripe (SDK ufficiale, solo variabili ambiente, nessuna chiave hardcoded)**. Tutti i flussi migrati sull'SDK ufficiale così gli incassi vanno sull'account Stripe del proprietario.
- **Donazioni**: singola 5/10/25/50/100€ + Altro importo; nuova sezione "Sostieni la radio ogni mese" con abbonamenti 5/10/20 €/mese (subscription, Price auto-creati idempotenti). Rimossa ogni dicitura demo/"modalità test".
- **Merchandising**: catalogo invariato; su ogni prodotto quantità + taglia/colore; pulsante "Acquista ora" al posto di WhatsApp; checkout con consegna Spedizione (nome,cognome,via,cap,città,provincia,telefono) o Ritiro (nome,telefono, su appuntamento). Prezzo SEMPRE ricalcolato lato server dal DB (sicurezza).
- **Dopo il pagamento**: pagina "Ordine confermato" (numero, data, prodotti, quantità, totale, consegna) + "Invia dettagli ordine su WhatsApp" (msg precompilato, 393517556255). Ordini salvati in `orders` + endpoint admin GET/PATCH (status/tracking/note) pronti per futura dashboard.
- Backend: /api/donations/checkout|subscribe, /api/orders/checkout|status, /api/admin/orders. Webhook con construct_event + STRIPE_WEBHOOK_SECRET (opzionale; conferma primaria via polling). Tutte le chiamate Stripe in try/except -> 400/404 puliti.
- Tested: **backend 23/23** (iteration_25, tests/test_payments_overhaul.py) validazione/sicurezza/no-orphan-order/guard; frontend verificato via screenshot (design invariato). NOTA: la chiave placeholder del pod (`sk_test_emergent`) funziona solo col proxy Emergent, non con l'SDK ufficiale -> creazione sessione reale NON testabile nel pod (400 by design). Il proprietario deve impostare la propria `sk_live_...` come `STRIPE_API_KEY` in produzione.

## Implemented (2026-06, session 20 — CMS Universale Fase 1)
- **Motore CMS generico riutilizzabile** per gestire piu' sezioni di contenuti senza scrivere codice. Fase 1 attiva su **Studi Biblici, Predicazioni, Video** (config scalabile in `src/utils/sections.ts` — aggiungere una sezione la abilita ovunque: Admin + Biblioteca pubblica).
- **Editor admin unico** `/admin/content/[section]/[id]`: copertina auto (ffmpeg), titolo/sottotitolo/autore/categoria/tag/durata, `MediaUpload` (upload file audio/video/immagine/PDF a blocchi fino 1GB **oppure** URL esterno con provider auto), descrizione, download on/off, stato Bozza/Pubblica/Archivia, programmazione data futura, ordine, **duplica**, **anteprima**, **elimina**. Voci CMS aggiunte alla sidebar AdminShell (generate da CMS_SECTIONS).
- **Pubblico**: hub `/biblioteca` (Podcast, Meditazioni, Studi Biblici, Predicazioni, Video) linkato da Home (banner) e Profilo; lista generica `/c/[section]` (ricerca + chip categorie derivate) e dettaglio `/c/[section]/[id]` con **player unificato** (video/audio/PDF/embed via MeditationPlayer), meta pill, tag, Condividi/Scarica (se abilitato), **contenuti correlati** e navigazione **precedente/successivo**.
- **Fix**: `api.ts` scartava male i parametri `undefined` (serializzati come stringa "undefined") -> ora rimossi, la lista pubblica filtra correttamente.
- Backend generico (routes /api/contents, /api/admin/contents CRUD+duplicate+delete, 6 sezioni) gia' presente e ora pienamente cablato.
- Tested: backend 10/10 (iteration_26, test_cms_universal.py) + flusso pubblico Ospite E2E OK. Admin editor dietro gate Google (coperto a livello API). Nessun bug.
- **Prossimo**: estendere il CMS a Eventi/Galleria/Download PDF (backend pronto), poi News/Merch nel CMS, Media Library avanzata (cartelle/ricerca/filtri).

## Implemented (2026-06, session 21 — Web Push (PWA / VAPID))
- **Web Push standard self-hosted** per la PWA installata (canale indipendente da quello nativo Emergent/SuprSend). Le notifiche manuali admin e le auto-notifiche (podcast/meditazioni/notizie/dirette/CMS) ora raggiungono anche il web.
- **Backend**: chiavi VAPID generate una sola volta e salvate in `app_config` (stabili per ambiente). Endpoint `GET /api/webpush/public-key`, `POST /api/webpush/subscribe` (upsert per endpoint), `POST /api/webpush/unsubscribe`. `send_web_push()` (pywebpush, invio in thread, prune subs 404/410) integrato in `notify_category` (loggato `web_delivered`). Aggiunto `import json`; dipendenze `pywebpush`/`py-vapid` in requirements.txt.
- **Service Worker** (`public/sw.js`): handler `push` (mostra la notifica con icona/badge) e `notificationclick` (focus/navigazione all'`action_url`).
- **Frontend**: `src/utils/webpush.web.ts` (subscribe/unsubscribe/stato, conversione VAPID key) + no-op nativo `webpush.ts`; metodi in `api.ts`. Card "Notifiche su questo dispositivo" in `/notifications-settings` (solo web: Attiva/Impostazioni/stato Attive); re-subscribe silenzioso al login se il permesso è già concesso (nessun prompt automatico).
- Verificato: endpoint OK (public-key, subscribe dedup, unsubscribe, invalid→400), admin send E2E (recipients 40, `web_delivered` loggato, nessun crash), card web renderizzata. NOTA: la consegna reale richiede un browser/PWA con permesso concesso (non automatizzabile headless) e funziona sul sito **deployato** (il SW con gli handler push viaggia col deploy). Su **iOS** il Web Push funziona solo per PWA aggiunte alla Home (iOS 16.4+), avviate dall'icona (standalone), non in scheda Safari.

## Pre-launch verification (2026-06, session — iteration 27)
- Verifica E2E completa pre-lancio: backend 31/31 pytest (test_pre_launch.py), frontend tutti i flussi automatizzabili verdi (390px + 1280px). Nessun bug critico.
- Verificati: auth (register/login/logout/admin/redirect), password reset (email no-op → code), invio notifica admin (fix confirmAsync), notifiche prefs + Web Push endpoints, timezone offset created_at, CMS 6 sezioni + CRUD + Biblioteca, meditazioni/podcast/radio/meteo, donazioni/merch (no 500), team/preghiere/messaggi, gestione utenti/inviti/activity, UI ospite senza red-screen. Nessun pacchetto deprecato.
- Non automatizzabili (manuali/deploy): consegna push nativa & web reale, email reale, Stripe LIVE e2e, audio background post-lock, install PWA su device fisici.
- Residui non bloccanti (web-only console warnings): shadow* → boxShadow, props.pointerEvents → style.pointerEvents. Radio path: backend usa /api/live/status (funzionante).

## Implemented (2026-06, session — Bibbia Fase 3: Piani di Lettura)
- **Piani di Lettura** (Reading Plans) self-hosted. 2 piani precaricati (seed idempotente per `seed_key`): "Incontra Gesù – 7 giorni nei Vangeli" (7 gg) e "Le Promesse di Dio – 30 giorni di speranza" (30 gg).
- **Backend**: collezioni `reading_plans` + `plan_enrollments`. Public: GET `/api/reading-plans` (solo pubblicati, trimmed), GET `/api/reading-plans/{id}` (giorni completi + enrollment se auth). Utente (auth): GET `/api/me/reading-plans` (progresso%), POST `/enroll`, POST `/day/{day}` toggle (segna completed_at al 100%), DELETE (reset). Admin (require_perm "verses"): GET list, GET/POST(201)/PUT/DELETE `/api/admin/reading-plans/{id}`. `reading_plans_seed.py`.
- **Frontend**: Home card "📚 Leggi la Bibbia" (BibleCard) come feature principale + rimosso il pulsantino Bibbia dal Versetto del Giorno. `/lettore` con card+icona "Piani di Lettura"; `/lettore/piani` (I miei piani con barra progresso + piani disponibili); `/lettore/piano/[id]` (dettaglio, Inizia il piano/enroll, checkbox per giorno con update ottimistico, letture che aprono il lettore con highlight versetto; ospite → /login). Admin: voce sidebar "Piani di Lettura" + `/admin/reading-plans` lista + editor nested (giorni & letture, book picker, cap/versetti, bozza/pubblicato, in evidenza, elimina).
- Tested: backend 15/15 (iteration_31/test_reading_plans.py), frontend tutti i flussi OK (iteration_32). Fix: redirect ospite enroll → /login. Nessuna regressione.

## Implemented (2026-06, session — Condivisione Share Card completa)
- **Condivisione reale** completata per Versetto del Giorno + Piani di Lettura (giorno singolo incluso). Util condiviso `src/utils/shareImage.ts`: `shareCard` (native expo-sharing → WhatsApp/Telegram/Instagram/Mail/…; web Web Share API con fallback download automatico se non supportato) + `saveCard` (native expo-media-library "Salva in galleria" con flusso permessi; web download). Aggiunto pacchetto `expo-media-library` + plugin/permessi app.json (NSPhotoLibraryAddUsageDescription, savePhotosPermission).
- **ShareVerseSheet**: grafica INVARIATA (logo, sfondo, colori, tipografia, riferimento, layout); aggiunti pulsanti "Condividi" + "Salva/Scarica" e link diretto (`/bibbia?verseId=`).
- **SharePlanSheet** (nuovo, tema marino coordinato): card Piano (copertina/icona, titolo, sottotitolo, descrizione, badge N giorni, logo) e card Giorno (titolo piano, "Giorno X di Y", riferimento biblico, meditazione opz., logo). Link diretti `/lettore/piano/{id}` e `/lettore/piano/{id}?day=X`.
- Pulsanti Condividi: su ogni card in `/lettore/piani` (miei piani + disponibili), nel dettaglio piano (header) e su ogni giorno.
- NOTE: apertura diretta in-app dal link (universal/app links) richiede config associated-domains al deploy; per ora i link https aprono il sito/PWA (con contenuto) → invito a installare l'app. Share sheet nativo e salvataggio in galleria testabili solo su device reale/build (non in Expo Go/web headless); su web verificati graficamente tutti e 3 i formati.

## Fixed (2026-06, session — Condivisione non funzionante su iPhone/web)
- **BUG**: il pulsante "Condividi" non apriva il menu di condivisione (iPhone Safari/PWA). Due cause: (1) su web `react-native-view-shot` usa `findNodeHandle`, non più supportato in react-native-web → la cattura falliva in silenzio; (2) iOS Safari richiede che `navigator.share()` sia invocata subito dentro il gesto utente, mentre il codice faceva cattura+fetch (async) prima → perdita di "user activation".
- **FIX**: nuovo hook `useShareCard` in `src/utils/shareImage.ts`. Su web l'immagine viene PRE-GENERATA all'apertura della card con `html2canvas` direttamente sul nodo DOM (`cardRef.current`, scale 2); al tocco `navigator.share({files,text})` è chiamata immediatamente (attivazione preservata) → menu nativo iOS/Android; fallback a download se Web Share non disponibile. Il pulsante Condividi mostra un loader finché la cattura non è pronta (`ready`). Nativo invariato (expo-sharing + salvataggio galleria via expo-media-library). Verificato su web: pulsanti pronti, download OK, nessun errore. Condivisione nativa reale su device/build.

## Implemented (2026-06, session — Bacheca Richieste di Preghiera moderata)
- ESTESO (non riscritto) il sistema Richieste di Preghiera. Invio: scelta 📢 Bacheca / 🔒 Solo admin; se Bacheca → "Mostra il mio nome" o "Anonima". Le richieste board arrivano SEMPRE in stato "In attesa" (published=false) e compaiono sulla Bacheca pubblica solo dopo approvazione admin (anti-spam).
- Backend: prayer_requests con visibility/show_name/published/praying_count/author_*; endpoint pubblici GET /api/prayer-board (solo approvate; display_name = nome o 'Anonimo') e POST /api/prayer-board/{id}/pray ("Sto pregando" unico per user_id o client_id device, contatore $inc). Admin GET /api/admin/prayers?filter=pending|published|private|archived (+search testo/nome/autore), PATCH published+text+status (publish→published_at + notify_category('prayers')), DELETE rimuove anche i pray marks. Indice unico prayer_prayers(prayer_id,key).
- Frontend: prayer.tsx (radio visibilità + nome condizionale, login richiesto), nuova /prayer-board.tsx (lista ❤️ nome/anonimo, testo, data, pulsante 🙏 Sto pregando one-shot + contatore), Home card "Bacheca delle Richieste di Preghiera", clientId util (AsyncStorage). Admin: filtri + badge (Bacheca/Privata, stato, Nome/Anonima, autore, data, contatore) + dettaglio con Approva/Rimuovi/Rifiuta-Archivia/Ripristina/Modifica/Elimina.
- Notifica push all'approvazione: "🙏 Nuova richiesta di preghiera / Un fratello ha chiesto il sostegno della comunità...". V1 senza commenti.
- Tested: backend 9/9 pytest (iteration_33), frontend verificato (Sto pregando + contatore + admin). Nessun bug.

## Implemented (2026-06, session — Trasparenza Economica)
- Nuova sezione admin "Trasparenza Economica" (sidebar, perm "finance").
- Backend: finance_entries (income/expense: data, descrizione, categoria, importo €, metodo/provenienza o pagato da, allegato base64, note, inserito da, auto/ref), finance_decisions, finance_audit_log (IMMUTABILE, insert-only, con IP). Endpoint /api/admin/finance: categories, summary (saldo, entrate/uscite mese, totale offerte, andamento 12 mesi), entries CRUD (+audit), entries/{id}/attachment, ledger (saldo progressivo), decisions CRUD (+audit), audit (solo super admin). admin/me ora ritorna is_super.
- RBAC: super admin (email allowlist) = tutto + Audit Log; administrator = tutto tranne Audit; collaborator con perm "finance" = sola lettura (POST/PUT/DELETE → 403); listener → 403.
- Automazioni: record_auto_income (idempotente per session_id) registra automaticamente in Entrate le donazioni (Donazione), abbonamenti mensili (Abbonamento Premium) e ordini shop (Merchandising) al completamento del pagamento Stripe. Estensibile per nuovi canali.
- Frontend: tab Dashboard (4 card + grafico mensile), Entrate/Uscite (filtri mese/anno/categoria/ricerca, modal add/edit con allegato via image-picker), Registro cronologico (saldo progressivo), Decisioni Amministrative, Audit Log (solo super). Export CSV (BOM Excel) e PDF (expo-print con logo, periodo, data, riepilogo saldo iniziale/entrate/uscite/finale). Azioni di scrittura/export nascoste ai collaboratori read-only.
- Tested: backend 31/31 pytest (iteration_34); frontend dashboard + tab Entrate + modal verificati via screenshot. Importi formattati in € (it-IT).

## Fixed (2026-06, session — Timoteo UX/affidabilità)
- **#1 Primo tentativo fallisce**: aggiunto retry automatico (fino a 3 tentativi con backoff) in `_run_llm` (timoteo.py) — il gateway LLM a volte droppa la prima chiamata (cold start / risposta lunga). Ora l'errore "riprova più tardi" non compare più al primo messaggio.
- **#3 Chat cancellata alla chiusura**: la conversazione ora è persistita su AsyncStorage (`timoteo_chat_v1`, ultimi 40 msg) — sopravvive a chiusura pannello, navigazione e riavvio app. Aggiunto tasto "nuova conversazione" (icona) nell'header per azzerare intenzionalmente.
- **#4 Blocco/impossibile chiudere dopo background (iOS)**: sostituito il `Modal` nativo RN (che su iOS può bloccarsi dopo background) con un overlay in-tree (`Animated.View` SlideInDown/SlideOutDown, absoluteFill, zIndex 100) sempre chiudibile via X o backdrop. Verificato su web: overlay apre/chiude, persistenza OK, reset OK.
- **#2 Latenza**: RISOLTO con **streaming SSE**. Nuovo endpoint `POST /api/timoteo/stream` (StreamingResponse, `X-Accel-Buffering: no`) che usa `LlmChat.stream_message()` (TextDelta/StreamDone) di emergentintegrations con GPT-5.5. Formato output cambiato: testo + sentinella `[[AZIONI]]` + array JSON azioni; il backend streama solo il testo prima della sentinella (hold-back per non far trapelare sentinelle parziali) e valida le azioni a fine stream (evento `done`). `answer()` non-stream resta come fallback. Frontend: `api.timoteoStream()` via XMLHttpRequest+onprogress (cross-platform web/native, RN fetch non ha ReadableStream); Timoteo.tsx mostra il testo che compare progressivamente (bolla `streaming`), azioni al termine. Verificato E2E in anteprima: testo cresce 1.6k→5k caratteri in ~20s, azioni OK, nessun leak sentinella.

## Fixed (2026-06, session — Logo sgranato nella condivisione)
- **BUG**: condividendo il Versetto del Giorno (Instagram Story ecc.) l'emblema del logo appariva sgranato/piccolo. Causa: `logo.png` è un'immagine VERTICALE 1415×2000 con l'emblema circolare al centro e ampio padding trasparente; nel badge circolare piccolo con `contentFit:contain` l'emblema veniva rimpicciolito troppo → non nitido una volta catturato per la card.
- **FIX**: generato `assets/images/logo-badge.png` (emblema quadrato ritagliato 1100×1100, alta risoluzione) e usato in `Logo.tsx` (unica sorgente per Home/Admin/welcome/card di condivisione). Ora l'emblema riempie il badge in modo nitido ovunque. Nessuna modifica a layout/dimensioni. Verificato in anteprima (ShareVerseSheet).

## Implemented (2026-06, session — Stato "Sostenitore" da abbonamento mensile)
- **Analisi**: l'abbonamento esistente è GIÀ un vero Stripe recurring (`mode="subscription"`, price mensile idempotente `pdu_monthly_{5,10,20}`). Mancava: tracciamento ciclo di vita (rinnovi/cancellazione/scadenza), stato `isSupporter` derivato, badge profilo.
- **Backend (fonte di verità = collezione `subscriptions`, sincronizzata con Stripe)**:
  - Nuova collezione `subscriptions` (upsert per user_id): `{stripe_subscription_id, stripe_customer_id, plan, status, cancel_at_period_end, current_period_end, updated_at}`.
  - `_is_supporter()`: supporter se status active/trialing, oppure past_due entro current_period_end (grazia). Stripe mantiene active con cancel_at_period_end fino a fine periodo, poi subscription.deleted→canceled → benefici mantenuti fino alla reale scadenza, poi rimossi automaticamente.
  - Webhook esteso: gestisce `checkout.session.completed` (mode subscription → link+sync), `customer.subscription.created/updated/deleted`, `invoice.paid/payment_succeeded` (rinnovo → income idempotente solo per billing_reason=subscription_cycle, evita doppio conteggio col primo pagamento), `invoice.payment_failed` (→ past_due). Firma verificata con STRIPE_WEBHOOK_SECRET; idempotente.
  - `subscription_data.metadata.user_id` sul checkout → gli eventi subscription.* si collegano all'utente anche senza il nostro doc.
  - Sync on-demand: `GET /api/me/subscription` (auth) recupera la subscription da Stripe e aggiorna il DB (verità cross-device dopo cancellazione/rinnovo/scadenza). `donation_status` linka la subscription anche in dev senza webhook.
  - `/auth/me` ora include `is_supporter` + `subscription` (dal DB, mai dal client).
- **Frontend**: User type esteso (`is_supporter`, `subscription`); nuovo `SupporterBadge` (medaglia circolare navy→sky con spunta, tag "Sostenitore attivo" — identità marina, discreta, no robot/no badge IG). Profilo: badge accanto al nome + tag sotto per i sostenitori; per i non sostenitori invito discreto "Sostieni il progetto" → /donate. Al focus del profilo: `api.mySubscription()` (sync Stripe) → `refreshUser()`.
- **Sicurezza**: is_supporter mai da client; verificato solo server-side dalla subscription live. Webhook firmato+idempotente.
- **Test**: backend 10/10 (tests/test_supporter.py: no-sub, active, cancel-at-period-end mantiene, canceled rimuove, rinnovo, past_due grazia→scadenza, riattivazione, stato server-side/cross-device, client non può falsificare, /me/subscription richiede auth). UI verificata (badge "Sostenitore attivo" nel Profilo). NOTA: checkout/subscribe reale non testabile nel pod (placeholder key, 400 by design) — richiede chiave Stripe reale + webhook secret in produzione.

## Implemented (2026-06, session — Statistiche, attività community & social proof)
- **Modulo backend `analytics.py`** (router iniettato, no crescita del monolite; incluso in server.py con init+ensure_indexes in startup). Additivo/retrocompatibile.
- **Tracking (solo utenti registrati; nessun ID anonimo)**: `last_active_at` su users; `analytics_daily_active` (1 write/giorno/utente); `content_views` (indice unico {kind,id,action,user} → dedup refresh); `radio_sessions` (start/beat 60s/stop, TTL 120gg, riuso sessione aperta su refresh, conteggio solo a riproduzione LIVE reale via PlayerContext).
- **Definizioni**: attivo = azione reale (foreground/sezione/ascolto/apertura contenuto, ping throttled ~90s client + 1 write/min/utente server); online = attività ultimi 5 min; ascoltatore = sessione radio con beat < 90s.
- **Endpoint pubblici (solo aggregati, cache in-memory)**: `GET /community/stats` (members/active_today/new_this_week/online_now, 60s), `GET /community/radio-listeners` (10s), `GET /content/stats?kind&id` (60s). `POST /track/active|content|radio/start|beat|stop`.
- **Admin**: `GET /admin/analytics?range=7|30|90|all` (protetto require_admin): utenti (totali/nuovi/attivi oggi-7-30, online, crescita% 30gg vs prec.), serie registrazioni (da users.created_at, storico) + attivi/giorno (da ora), radio (current/stream AzuraCast/unici/picco sweep-line/durata media/ore totali), contenuti (top meditazioni viste, top predicazioni ascoltate, unici), community (preghiere/amen/testimonianze/messaggi).
- **Frontend**: Admin "📊 Statistiche" (nav + `/admin/statistiche`, filtri tempo, `MiniLineChart` SVG leggero coerente col tema). Home banda "Una comunità che cresce insieme" con `AnimatedCounter` (rAF, rispetta reduce-motion). Player "🎧 N persone stanno ascoltando con te" (solo durante ascolto reale, nascosto se 0). Social proof contenuti (👁 letture meditazioni / 🎧 ascolti predicazioni) + tracking view/play. Ping attività in AuthContext (foreground/interval, throttled).
- **Privacy/perf/sicurezza**: pubblici solo aggregati (mai nomi/email/IP/ID); admin dietro permessi esistenti (normale utente → 403); cache TTL; throttling scritture; TTL index per limitare crescita DB. Nessun dato inventato: metriche non ricostruibili partono da ora, registrazioni storiche da created_at.
- **Test**: backend tests/test_analytics.py (6) + test_supporter.py (10) verdi; regressione core admin OK (fallimenti residui = 429 rate-limit e seed pollution da run ampio, non del codice). UI verificata (Home banda + dashboard admin con dati reali).

## Implemented (2026-06, session — Meditazioni: player continuo verticale + interazioni)
- **Scelte utente**: 1b (mantiene lista+ricerca+categorie; toccando una meditazione si apre il player continuo partendo da quella e si scorre verticalmente tutte le altre), 2a (like/pregare/commenti lettura+scrittura/condivisione), 3a (autoplay muto quando necessario, tap per audio; autoplay pieno dove consentito). NON stile TikTok, design attuale mantenuto.
- **Backend (nuovo, additivo)**: collezioni `meditation_likes`/`meditation_prayers` (indice unico {mid,uid} → toggle per-utente, no inflazione), `meditation_comments`; contatori `likes_count/praying_count/comments_count` su doc meditazione via $inc. Endpoint: `GET /meditations/{id}/interactions` (auth opzionale → conteggi + liked/praying), `POST /meditations/{id}/like` (toggle), `POST /meditations/{id}/pray` (toggle), `GET /meditations/{id}/comments`, `POST /meditations/{id}/comments` (auth), `DELETE /meditations/comments/{cid}` (autore o admin). Indici creati in startup.
- **Frontend**: nuova route `app/meditazioni/player.tsx` — FlatList verticale pagingEnabled (snap a schermo intero), autoplay solo card attiva, preload finestra [active-1..active+1], `MeditationPlayer` con props `active`/`autoplay` (WebView keyed su active → stop audio allo swipe, no overlap; embed con `autoplay=1&mute=1`, self-hosted `autoplay muted`). Action bar coerente (❤️ like, 🙏 Sto pregando, 💬 commenti, 📤 condividi) + hint "Scorri per la prossima". `MeditationComments` bottom-sheet (lettura+scrittura, login gate per ospiti). Tab meditazioni: card → push a `/meditazioni/player?start&q&cat`. Tracking vista deduplicato per card attiva.
- **Compatibilità**: funziona web + PWA/mobile (FlatList paging + WebView). Design invariato, nessuna modifica ad auth/altre sezioni. Vecchia route dettaglio `/meditazioni/[id]` mantenuta come fallback.
- **Test**: backend interazioni verificate via curl (like toggle 1→0, pray toggle, commento crea/leggi, interactions coerenti, dedup via indice unico). UI player verificata (fullscreen, controlli, action bar con conteggi reali). NON verificabile: swipe/preload tra più meditazioni (nel DB pod è presente 1 sola meditazione).

## Updated (2026-06, session — Meditazioni fullscreen diretto)
- Su richiesta utente: il tab **Meditazioni** ora apre DIRETTAMENTE il player fullscreen verticale (formato TikTok, video object-fit cover), rimosso il passaggio dalla lista. Estratto componente riutilizzabile `src/components/meditations/ContinuousMeditationPlayer.tsx` (usato dal tab `isTab` e dalla route deep-link `/meditazioni/player` con `showBack`). `MeditationPlayer` ha ora prop `fill` (cover + no chrome + autoplay muted+loop + tap per audio/pausa via JS). Overlay: gradient top/bottom, titolo/speaker/versetto in basso-sx, rail azioni a destra sopra la tab bar, hint swipe. Design colori app mantenuto. Vecchia lista rimossa dal tab (ricerca/categorie non più mostrate nel tab; il componente accetta ancora q/cat per i deep-link).

## Implemented (2026-06/08, session — Traguardi del Cammino / Bacheca Fase 1)
- Nuova sezione **"Traguardi del Cammino"**: bacheca personale a forma di **armadio antico in legno** che si apre (ante animate, rispetta reduce-motion) rivelando medaglie **appese a ganci in ottone** raggruppate per categoria (mensole con targhette incise). Medaglie a doppia faccia: fronte = logo emblema + rim tier (Bronzo/Argento/Oro); tap → overlay in primo piano con **flip 3D** che mostra il retro (statistica, descrizione, data di ottenimento). Slot bloccati in grigio con lucchetto + progresso; targhetta finale "Il cammino continua…". Principio "NON È UNA GARA. È UN CAMMINO.".
- **Sblocco automatico** da metriche reali (nessuna assegnazione manuale necessaria): `plans` (piani completati), `podcasts` (history), `meditations` (like/pray/comment distinti), `verses` (bookmarks). Storico immutabile in `user_achievements` ($setOnInsert): resta anche se l'admin modifica soglie/impostazioni. Architettura pronta per metriche future (ore radio, preghiere, ecc.) aggiungendo righe al seed + estendendo `_user_metric_counts`.
- **Seed** idempotente `achievements_seed.py`: 12 medaglie default (4 categorie × Bronzo/Argento/Oro) + `walk_board` default. Soglie/testi/tier tutti modificabili da Admin.
- **Accessi**: card Home compatta `BachecaCard` (mostra "N traguardi su M") + voce Profilo "Traguardi del Cammino" (solo utenti loggati) → route `/traguardi` (ospite → gate login).
- **Admin** (`/admin/achievements`, perm `achievements`): impostazioni bacheca (titolo, principio, intro, testo slot vuoti, legno noce/rovere/mogano/ebano, toggle animazione/attiva) + lista medaglie con **reorder** (frecce), toggle attivo, **duplica**, elimina; editor `[id]` con tier/metric/soglia/emoji/descrizione/etichetta retro/immagine custom/attivo + **assegna/revoca** manuale per email. Voce sidebar aggiunta in AdminShell.
- Backend (già scaffolded in fork precedente, ora testato): `GET /api/me/achievements`, admin CRUD `/api/admin/achievements(+/{id}/order/assign/unassign)`, `GET/PATCH /api/admin/walk-board`.
- Verificato screenshot: armadio, medaglie tier, lucchetti+progresso, overlay flip 3D fronte/retro. Test backend/frontend via testing_agent in corso.

## Performance (2026-06 — ottimizzazione immagini / PWA lenta)
- Problema segnalato: PWA lenta su tutte le schermate. Causa: immagini salvate come base64 INLINE nei documenti e restituite dentro gli ELENCHI (payload da MB).
- Soluzione (nessuna migrazione dati, nessun cambio visivo):
  - Nuovo endpoint `GET /api/img/{coll}/{id}/{field}?v=<hash>[&i=<idx>]` (`backend/imageopt.py` + `server.py`) che decodifica il base64 e serve i byte reali con `Cache-Control: public, max-age=31536000, immutable`.
  - Le LISTE/DETAIL pubbliche (podcasts, news, programs, crew, showcase, meditations, contents, reading-plans, favorites, history) ora restituiscono URL RELATIVI `/api/img/...?v=<hash>` al posto del base64. Il `?v=` è l'hash del contenuto → cache-busting automatico quando l'admin modifica l'immagine.
  - Gli endpoint ADMIN NON toccati: gli editor ricevono ancora il base64 completo per modifica/salvataggio.
  - Frontend `api.ts` → `absolutizeImages()` antepone `EXPO_PUBLIC_BACKEND_URL` agli URL `/api/img/...` (funziona su web same-origin e nativo). BachecaCard Home ora fetch una sola volta (useEffect).
  - Service Worker (`public/sw.js`): caching cache-first per `/api/img/...` (sicuro grazie all'URL con hash) → aperture successive rapide anche se Cloudflare rimuove gli header di cache.
- Testato: 24/24 pytest backend (`iteration_42_image_opt.xml`) + frontend (Notizie/Team con immagini base64 renderizzate correttamente). Regressione admin (base64 intatto) e Traguardi del Cammino OK.
- Nota infra: sull'ingress pubblico Cloudflare riscrive Cache-Control a no-store; il caching cross-sessione è affidato al Service Worker della PWA.

## Timoteo — immagine + FAB trascinabile (2026-06)
- Cambiata l'immagine dell'assistente Timoteo: dalla lampada SVG all'illustrazione ufficiale del pescatore ("IL TIMOTEO"), ritagliata su cerchio pulito (assets/images/timoteo.png). Usata nel pulsante flottante e nell'header del pannello.
- Il pulsante flottante (cerchio) è ora trascinabile liberamente su tutte le schermate (PanResponder + RNAnimated.ValueXY), con vincolo ai bordi (safe-area) e posizione memorizzata (AsyncStorage `timoteo_fab_pos_v1`). Tap = apre Timoteo, trascinamento = sposta. Risolve il problema del cerchio che copriva alcune funzioni.

## Visibilità sezioni (2026-06)
- Nuovo controllo admin: in Admin > Impostazioni > "Visibilità sezioni" ogni sezione del sito ha un interruttore ON/OFF. Spegnendo una sezione sparisce ovunque: barra tab in basso (href:null), card Home e voci del menu Profilo.
- Backend: `section_visibility` (mappa) in GeneralSettings; default `SECTION_DEFAULTS` (tutto ON tranne **merch OFF**) unito nelle risposte `/settings` e `/admin/settings`; PUT persiste. Chiavi: podcast, meditazioni, news, palinsesto, meteo, community, vetrina, team, verse, bibbia, piani, traguardi, prayer, donate, about, contact, merch.
- Frontend: `SettingsProvider` (una sola fetch `/settings` all'avvio → nessun peso extra) espone `sectionVisible(key)`. Usato in `(tabs)/_layout`, Home `index`, `profilo`. **Merchandising nascosto di default** come richiesto.
- I cambi si applicano alla riapertura dell'app (il provider carica all'avvio).

## Layout desktop (2026-06)
- Fix effetto "stirato" su desktop: `DesktopFrame` (web-only) centra l'app in una colonna da max 640px con cornice/letterbox navy ai lati quando la finestra supera 640px. Mobile e native invariati. Il FAB Timoteo e la barra tab restano allineati alla colonna. Scelta utente: opzione A, larghezza media ~640px.

## Timoteo: pallina piccola trascinabile (2026-06)
- Il pulsante flottante trascinabile causava conflitto con lo scroll (la pagina scorreva invece di spostare il cerchio). Sostituito con una LINGUETTA fissa sul bordo sinistro (avatar Timoteo + testo verticale "TIMOTEO") che al tocco apre l'assistente. Rimossa la logica di drag (PanResponder). Non copre i contenuti e non interferisce con lo scorrimento.

## 4 migliorie UX (2026-06)
- Visibilità sezioni in tempo reale: dopo il salvataggio in Admin Impostazioni viene chiamato `refresh()` di `SettingsContext` -> tab/Home/Profilo si aggiornano senza riavvio.
- Home a 2 colonne su desktop: `BibleCard`, `ReadingPlansCard`, `BachecaCard` accettano prop `inGrid`; su web >640px vengono disposte in griglia 2 colonne (celle 50%) per non sembrare stirate. Mobile invariato.
- Bolla Timoteo semi-trasparente durante la lettura: opacità animata a 0.35 nei root `lettore`, `c` (articoli CMS), `news`; torna piena al tocco/drag.
- Edge-snapping: al rilascio la bolla scivola (spring) al bordo laterale piu vicino (sinistra/destra).

## Live Hub — LivePlayer configurabile (2026-06)
- Nuovo LivePlayer generico e modulare (provider-based), NON legato a YouTube. Provider: youtube, twitch, embed (URL iframe), audio (stream), none. Aggiungere provider = aggiornare `src/livePlayer.ts` senza toccare la UI.
- File: `src/livePlayer.ts` (config/type + buildLiveEmbedUrl + provider list), `src/components/live/FishingNetFrame.tsx` (cornice SVG a rete da pesca: corde, nodi angoli, galleggianti, angoli irregolari), `src/components/live/LivePlayer.tsx` (native WebView) + `.web.tsx` (iframe), `app/live.tsx` (Live Hub).
- Pagina `/live`: stato LIVE (badge "SIAMO IN DIRETTA", player incorporato in cornice, caption, pulsante "Guarda sulla piattaforma" + pulsanti per-piattaforma dai `live_links`); stato OFFLINE ("Al momento non siamo in diretta" + card "Prossima diretta" con data/ora/titolo/cover + "🔔 Ricordamelo" collegato a `updateNotifPrefs({live:true})`, predisposto per push reali).
- Home: quando `live_mode` ON, il pulsante "Guarda la diretta" apre `/live` (rimosso il vecchio WatchLiveModal esterno dalla Home; file WatchLiveModal.tsx resta inutilizzato).
- Backend: aggiunto campo `live_player` (Dict) al modello RadioSettings; esposto in `/api/live/status` e `/admin/radio/status`. Nessun dato esistente rimosso; Radio Player/AzuraCast intatti.
- Admin: pagina "Gestione Live" (`/admin/streaming`, ex Dirette Streaming) estesa con selettore provider, ID/URL sorgente, titolo, sottotitolo, copertina, link esterno + label, prossima diretta (titolo/data/cover). `live_links` esistenti mantenuti.
- Verificato: LIVE (YouTube embed su desktop+mobile, cornice rete, no scroll orizzontale), OFFLINE (prossima diretta + Ricordamelo), round-trip Admin API (provider twitch persistito e pubblicato).

## Personalizzazione Layout Home (2026-06)
- Nuova pagina Admin "Layout Home" (`/admin/home-layout`): riordino sezioni (frecce su/giù), Larghezza (Intera / Metà — due "Metà" consecutive si affiancano), Dimensione (Compatta / Normale / Grande). Salva in settings `home_layout`.
- Modello: `src/homeLayout.ts` (HOME_SECTIONS canoniche, mergeHomeLayout, scaleFor). Wrapper `src/components/home/ScaleBox.tsx` (scala uniforme con transformOrigin top-center e riserva altezza).
- Home (`app/(tabs)/index.tsx`) riscritta: hero fisso + motore di layout dinamico (ordine + pairing metà + scala). Le card Bibbia/Piani/Traguardi usano prop `inGrid` quando a metà. Rimossa la vecchia auto-2col desktop (sostituita dal controllo manuale di larghezza).
- Backend: aggiunto `home_layout: Optional[List[Dict[str,Any]]]` a GeneralSettings; servito da `/api/settings` e `/api/admin/settings` (nessun default lato server; il merge/ordinamento avviene sul client).
- Verificato: Home default (full), affiancamento metà (Meteo+Community, Bibbia+Piani), riordino, scala compatta; round-trip Admin API (save→read pubblico).

## Mini-player X + Barra di navigazione globale (2026-06)
- MiniPlayer: aggiunta X (angolo alto-dx della card) che chiama `stop()` del PlayerContext → ferma audio e nasconde la barra. Spostati borderRadius/overflow sul BlurView così la X sporgente non viene tagliata.
- GlobalTabBar (`src/components/GlobalTabBar.tsx`): barra inferiore persistente identica alla GlassTabBar, renderizzata nel root `_layout.tsx` su TUTTE le schermate stack (Bibbia, Preghiera, Live, Donazioni, ecc.). Nascosta su root: (tabs) [usa la barra nativa], welcome/auth/login/invite/reset-password/admin/player. Rispetta section_visibility. Navigazione via `router.navigate` (cambia tab e chiude la schermata stack). Verificato: /bibbia→tab Podcast, X mini-player ferma la riproduzione.

## Fix riproduzione Podcast + Upload file audio (2026-06)
- Causa: expo-audio sul web non riproduce audio cross-origin senza header CORS (la radio funziona perché proxata). I podcast con URL esterni non partivano sul web.
- Proxy audio: nuovo `GET /api/audio-proxy?src=` (same-origin, Range/206) in server.py. Helper `audioSrc()` in api.ts: sul web instrada gli URL esterni tramite il proxy; su native e per gli URL same-origin (/api/media) resta invariato. Applicato in: podcast/[id], Home card, profilo.
- Upload file nel pannello Admin: `app/admin/podcasts/[id].tsx` ora usa `<MediaUpload accept={["audio/*"]}>` (Carica file | URL esterno). I file caricati vanno su GridFS (`/api/media/{id}`, Range) e sono riproducibili ovunque. Aggiunti campi `media_id/media_type/media_filename` a PodcastIn/PodcastEdit.
- Verificato: proxy 206 con Range; su web la riproduzione podcast passa dal proxy (log backend 206). Upload UI riusa il componente CMS già in produzione.

## Team: griglia "personaggi" + Gradi configurabili (2026-06)
- Pagina Equipaggio (`app/equipaggio/index.tsx`) ridisegnata: griglia di quadrati piccoli (3 per riga, tap → dettaglio `equipaggio/[id]`), raggruppati per GRADO. Ogni grado è una riga con intestazione; ordinati per `level` (1 in alto). Membri senza grado sotto "Equipaggio".
- Gradi configurabili: nuova collection `crew_ranks` {id,name,level}. Endpoint: pubblico `GET /crew/ranks`; admin `GET/POST/PATCH/DELETE /admin/crew/ranks` (perm team). Delete rimuove il grado dai membri (cascade rank_id=None). Aggiunto `rank_id` a CrewEdit.
- Admin Team: nuovo tab "Gradi" (aggiungi/rinomina/livello/elimina). Editor membro (`admin/member/[id]`): selettore grado (chips) + salvataggio `rank_id`. Badge grado nella lista membri.
- API frontend: crewRanks, adminCrewRanks, adminCreateRank/EditRank/DeleteRank.
- Default seed: gradi "Responsabili"(1) e "Collaboratori"(2); Luigi Volpe → Responsabili (modificabili/eliminabili dall'admin).
- Verificato: griglia render (tile foto+nome+ruolo), round-trip API gradi completo.

## Sostieni il Progetto configurabile da Admin (2026-06)
- `src/donateConfig.ts`: DEFAULT_DONATE + mergeDonate. Campi: title, subtitle, body, amounts_title, presets[], default_amount, message_title, secure_note, monthly_enabled, monthly_title, monthly_sub, monthly_plans[{plan,label,desc}].
- `app/donate.tsx`: legge la config da `api.settings().donate_config` (merge coi default) e la usa per TUTTI i testi/importi/piani mensili. Nessun valore hardcoded.
- Admin: nuova pagina `app/admin/donate-config.tsx` ("Sostieni il Progetto" nel menu) per modificare tutto; salva via `adminUpdateSettings({donate_config})`. Gestione piani mensili dinamici (aggiungi/elimina, importo/etichetta/descrizione).
- Backend: `donate_config` aggiunto a GeneralSettings (servito da /settings e /admin/settings). Piani mensili Stripe ora derivati da qualunque importo (`_plan_cents`), non più dal dict fisso MONTHLY_PLANS (rimosso). `_get_or_create_monthly_price` e `/donations/subscribe` aggiornati con validazione €1–€5000.
- Verificato: pagina donate riflette config personalizzata (titolo/testi/presets/default/mensili) via screenshot; lettura da /settings pubblico.

## Fix Contatti → Messaggi admin + notifica push admin (2026-06)
- Causa: `/contact` scriveva in `contact_messages`, ma l'admin legge `messages`. Ora `/contact` salva in `db.messages` (type "message", campi text/name/email/status/source="contact"), così compare in "Messaggi e testimonianze".
- Notifica push admin: nuova `notify_admins(title,message,action_url)` (send_push + send_web_push) verso utenti role administrator/admin o con permesso "messages". Chiamata su nuovo messaggio contatti (action_url /admin/messages). Logga in notifications_log; non solleva mai.
- Admin: dettaglio messaggio ora mostra l'email del mittente.
- Rimosso il dict fisso non più usato; le push reali si vedono solo su build nativa/PWA con push abilitate.
- Verificato: POST /contact → appare in /admin/messages con email e source.

## Bibbia: UX evidenziazione (2026-06)
- Pannello azioni (evidenzia/nota/condividi) ora si apre col TAP sul NUMERO del versetto (`verse-num-{n}`), non più con long-press. Riga versetto convertita da Pressable a View + numero tappabile.
- Header lettore: sostituita la "A" con due pulsanti +/− (`font-inc`/`font-dec`, clamp su FONT_SIZES).
- Sezione salvati (`lettore/salvati.tsx`): "Preferiti" → "Evidenziati" (titolo pagina "Evidenziati e note" + tab). Testi aggiornati (empty/login) → "clicca sul numero del versetto per evidenziarlo". Aggiunto pulsante elimina (cestino) per rimuovere evidenziato/nota direttamente dalla lista senza aprire il capitolo (api.bibleDeleteBookmark/DeleteNote + update stato).
- Testo prompt login lettore aggiornato (rimosso "salvarli nei preferiti").
- Verificato: tap sul numero apre pannello; +/− ridimensionano; testi aggiornati.

## Le mie offerte: tipo offerta + disattiva abbonamento (2026-06)
- Ogni offerta ora mostra un badge "Una tantum" o "Abbonamento mensile" (in base a `frequency`), con icona coerente.
- Card gestione abbonamento in cima (se attivo): mostra piano + data rinnovo; pulsante "Disattiva abbonamento" → `POST /me/subscription/cancel` (Stripe cancel_at_period_end=true: resta attivo fino a fine periodo pagato, poi non si rinnova). Dopo l'annullamento mostra "Attivo fino al … Non verrà rinnovato".
- Backend: nuovo endpoint `/me/subscription/cancel`; api frontend `cancelSubscription`.
- Verificato: endpoint protetto (401 senza auth), pagina si carica; badge/card dipendono da dati reali con auth+Stripe.

## Sicurezza reset password (2026-06)
- BUG sicurezza corretto: `/auth/forgot-password` NON restituisce più il codice nella risposta (prima esposto come fallback e auto-compilato dal frontend). Il codice arriva SOLO via email (Emergent Resend).
- Email non registrata → 404 "Nessun account trovato con questa email." (scelta esplicita del proprietario di rivelare l'esistenza). Account Google senza password → messaggio "usa Google".
- Fallimento invio email → 400 (non 502) così il JSON sopravvive all'ingress Cloudflare. Frontend `reset-password.tsx`: rimosso l'auto-fill del codice, catch robusto per body non-JSON.
- `EMERGENT_EMAIL_KEY` provisionata in `/app/backend/.env`.
- Verificato dal testing_agent (iter 43+44): 404 messaggio, nessun `code` in risposta, flusso completo reset+login, UI (unregistered mostra messaggio pulito, registered avanza con campo codice VUOTO). Test: `/app/backend/tests/test_password_reset_security.py`.

## Piani biblici: lista "I miei piani" compatta (2026-06)
- `app/lettore/piani.tsx`: sezione "I miei piani" convertita da card grandi 16:9 a righe compatte (thumbnail quadrata 76px a sinistra + titolo + barra progresso + share), per ridurre lo scroll. Aggiunti stili myRow/thumb/doneBadgeSm/myRowTitle/progressTrackSm/progressFillSm/progressTextSm/shareIconLight. La lista "Piani disponibili" (discover) è rimasta invariata come richiesto.

## Fixed (2026-06, session fork — Reset password "Impossibile inviare l'email")
- SINTOMO: la schermata "Password dimenticata" mostrava SEMPRE "Impossibile inviare l'email in questo momento" all'utente.
- CAUSA REALE: NON era l'email. Il backend nel fork restituiva momentaneamente 502 Bad Gateway (reload/avvio); `request()` in api.ts e reset-password.tsx mascheravano QUALSIASI risposta HTML/gateway con il messaggio generico dell'email → fuorviante. `EMERGENT_EMAIL_KEY` è valida e l'endpoint Resend accetta (202 → delivered:true).
- FIX: `src/api.ts` `request()` ora distingue: fetch fallita → "Nessuna connessione al server..."; 502/503/504 → "Server momentaneamente non raggiungibile. Riprova tra qualche secondo."; altrimenti usa il detail JSON reale. `reset-password.tsx` fallback generico neutro ("Si è verificato un problema...").
- Verificato: POST /api/auth/forgot-password → 200 {delivered:true} via localhost e URL preview; Resend 202.
- NOTA: su build DEPLOYATA serve `EMERGENT_EMAIL_KEY` nei secrets del deployment, altrimenti l'invio fallisce in produzione.

## Fixed (2026-06, session fork — Traguardi del Cammino: 3 richieste utente)
1. BAGLIORE DECENTRATO: il glow dietro la medaglia era in posizione assoluta senza centratura (Medal.tsx small + MedalDetailOverlay overlay). FIX: wrapper dimensionato esattamente come il glow + `StyleSheet.absoluteFillObject` → glow perfettamente centrato dietro il disco in entrambi i componenti.
2. MEDAGLIA PERMANENTE: `GET /api/me/achievements` ricalcolava `earned` LIVE dai conteggi → deselezionando versetti (<soglia) la medaglia spariva. FIX: se esiste già il record immutabile in `user_achievements` → `earned=True` e `progress=100` PER SEMPRE, indipendentemente dal conteggio attuale. Verificato: azzerati i bookmark del demo → "Primo Tesoro" resta earned=True/100%.
3. NOTIFICA PUSH ALLO SBLOCCO: nuovo helper `notify_user(uid,...)` (native + web push a singolo utente). In `me_achievements`, quando un nuovo record viene inserito (upserted_id, quindi UNA SOLA volta), invia push "🏅 Nuovo traguardo sbloccato!" con action_url /traguardi. Non blocca mai. NOTA: la push reale funziona solo su build DEPLOYATA (EMERGENT_PUSH_KEY placeholder in preview → log 'failed', atteso).

## Meditazioni — restyle Reels + fix audio + rimozione "Prego" (2026-06, session fork)
- FIX AUDIO (bug utente): l'audio continuava a suonare uscendo dalla sezione (es. verso Home). Aggiunto `useIsFocused()` in ContinuousMeditationPlayer → la card attiva riceve `active={index===active && isFocused}`; alla perdita di focus il video si mette in pausa (MeditationVideo native/web fa pause(); WebView si rimonta in stato "off"). Verificato su web: dopo aver lasciato la sezione nessun video in riproduzione.
- RIMOSSO tasto "Prego" (rail ora: ❤️ like, 💬 commenti, ✈️ Invia/condividi). Rimossa anche funzione togglePray.
- RESTYLE stile Instagram Reels (blueprint da mobile_design_agent): rail con icone pulite bianche + drop shadow (niente cerchi scuri), icone più grandi (33); caption con avatar circolare (thumbnail o logo) + handle speaker in grassetto, titolo, versetto con barra laterale marina; gradiente inferiore più alto/morbido (#040A18); hint "Tocca per l'audio" mostrato ~4.5s sulla card attiva finché l'audio è muto; animazione cuore (burst) al like (spring scale+fade). Palette navy/marina mantenuta. Snap FlatList invariato (già fluido).

## Chi Siamo — foto copertina editabile da Admin (2026-06, session fork)
- Richiesta utente: poter cambiare anche la FOTO della pagina "Chi Siamo" dal Pannello Admin (prima era hardcoded a un'immagine Unsplash).
- Backend: aggiunto campo `about_image` a GeneralSettings (persistito via PUT /admin/settings). `/api/settings` pubblico serve la foto come URL leggero/cacheable `/api/img/settings/general/about_image?v=<hash>` (imageopt) invece del base64 pesante → nessun appesantimento del fetch /settings usato allo startup. `imageopt.IMG_FIELDS` esteso con `settings: (about_image,)`; `serve_image` ora fa fallback lookup per `_id` (il doc settings usa `_id:"general"`, non `id`). Admin GET `/admin/settings` continua a restituire il base64 completo per l'editor.
- Frontend: Admin > Impostazioni > "Pagina Chi Siamo" ora ha `AImagePicker` "Foto di copertina" (16:9, base64). Pagina pubblica `about.tsx` usa `s.about_image` se presente, altrimenti fallback all'immagine di default.
- Verificato E2E: PUT base64 → /settings ritorna URL /api/img → l'URL serve i byte PNG (200). Admin GET ritorna base64. Cleanup → fallback default.

## Desktop a schermo pieno (2026-06, session fork)
- Richiesta utente: su PC l'app deve essere a SCHERMO PIENO (niente barre blu laterali; la colonna 640px era troppo piccola). Mobile/PWA-mobile invariati.
- `DesktopFrame` non applica più il letterbox navy: rende sempre a piena larghezza (bg bianco) su qualsiasi viewport. Rimossa la logica `wide`/`frameWide`/`outerWide` e gli import inutilizzati (useWindowDimensions/Platform). Struttura a 2 View invariata (nessun remount al resize).
- `MAX_CONTENT_WIDTH` (640) resta esportato e usato SOLO dal player Meditazioni per centrare il video verticale su sfondo nero (stile Instagram) — corretto anche a schermo pieno.
- Verificato su viewport 1440px: nessuna barra blu, hero/card/tab bar a piena larghezza. Tradeoff accettato dall'utente: layout a colonna singola può apparire un po' "largo" sui monitor grandi.

## Pannello Admin — sidebar responsive + collapse (2026-06, session fork)
- Richiesta utente: la barra laterale sinistra del pannello admin deve sparire/apparire in base alla risoluzione.
- FIX: il breakpoint (>=900px) era calcolato una sola volta con `Dimensions.get()` → non reagiva al resize. Ora usa `useWindowDimensions()` → la sidebar passa automaticamente tra rail fisso (desktop) e drawer a scomparsa (mobile/narrow) quando cambia la risoluzione/finestra.
- Aggiunto anche il collapse manuale su desktop: pulsante header "‹" nasconde la sidebar (contenuto a piena larghezza) e diventa "☰" per riaprirla. Su schermi stretti il "☰" apre il drawer overlay (comportamento esistente, ora reattivo).
- Verificato su 1440px: sidebar visibile + collapse funzionante; contenuto full-width dopo il collapse.

## Timoteo — snap al bordo destro su desktop (2026-06, session fork)
- BUG: la pallina di Timoteo si attaccava solo al lato sinistro; a destra non arrivava. Causa: dopo il passaggio a desktop full-width, `SCREEN_W` era ancora limitato a `MAX_CONTENT_WIDTH` (640) → `maxX≈580`, cioè il centro dello schermo su monitor grandi, non il bordo destro reale.
- FIX: `Timoteo.tsx` ora usa `useWindowDimensions()` (larghezza/altezza reali, reattive) al posto di `Dimensions.get()` clampato a MAX_CONTENT_WIDTH. Rimosso import MAX_CONTENT_WIDTH/Dimensions. Aggiunto effetto che ricalcola i bounds e ri-snappa la bolla al bordo più vicino quando cambia la risoluzione (resize desktop). Verificato: su viewport 1440px la bolla si posiziona a x≈1386 (bordo destro reale).

## Ritocchi UI (2026-06, session fork)
- Impostazioni > Timoteo: rimossa la frase finale "Trovi la lampada in basso a destra in ogni schermata." (resta "Timoteo ti aiuta a trovare contenuti, navigare nell'app e studiare la Bibbia.").
- Ultima tab rinominata da "Profilo" a "Altro" con icona ☰ (menu). Aggiornati: (tabs)/_layout.tsx (title), GlassTabBar (ICONS.profilo → menu/menu-outline), GlobalTabBar (label "Altro", icon menu-outline). La route resta /profilo.

## Palinsesto — timeline compressa (meno scroll) (2026-06, session fork)
- Richiesta utente: la timeline 24h scrollava troppo (ore notturne vuote occupavano tantissimo spazio; scala fissa 120px/ora = 2880px).
- Soluzione: scala TEMPO→Y a tratti (piecewise) in `palinsesto.tsx`. I programmi usano una scala proporzionale (ACTIVE_PPM=1.4px/min ≈84px/ora); gli spazi VUOTI tra i programmi sono fortemente compressi (GAP_PPM=0.14, min 26 / max 62px), quindi la notte non spreca schermo. `buildScale(mergeIntervals(...))` + `yOf()`. Etichette orarie posizionate tramite yAt() e "diradate" (min gap 30px) per non accavallarsi nei gap compressi. Aggiunti marcatori tratteggiati sui gap >=45min. Cursore "ora", auto-scroll e modale invariati. Aspetto della timeline preservato.
- Verificato: giorno vuoto → timeline minima (nessuno scroll); giorno con 3 programmi (Mer) → sta quasi tutto in una schermata, programmi proporzionati e leggibili.

## Palinsesto — NUOVA timeline orizzontale 24H (broadcast) (2026-06, session fork)
- Riscrittura completa di app/(tabs)/palinsesto.tsx da timeline VERTICALE a ORIZZONTALE stile radio broadcast (richiesta dettagliata utente).
- Struttura: header "PALINSESTO" + data (es. "Venerdì 14 Agosto" via nuovo helper romeDay(offset) in utils/onair.ts). Navigazione giorni ‹ Ieri · Oggi · Domani › (offset giorni; "Oggi" evidenziato e ripristina). Timeline orizzontale scrollabile (PPM=2.2px/min, 24h=3168px), righello ogni 3h con gridlines. Blocchi programma proporzionali alla durata, posizionati per orario.
- Indicatore "SEI QUI": linea rossa verticale + pill "SEI QUI" alla posizione dell'ora corrente (solo se giorno = oggi); auto-scroll orizzontale all'ora attuale all'apertura. Programma on-air evidenziato con pulse glow animato + badge "● IN ONDA". Banner "ORA IN ONDA · HH:MM" sotto (fallback "Diretta Radio").
- Legenda tipi: 🔴 LIVE (#E11D48) · 🔵 REGISTRATO (#0EA5E9) · 🟣 MUSICA (#A855F7) · 🟢 RIFLESSIONE (#22C55E). typeOf(p): "regular"/vuoto → recorded.
- Tap blocco → modale dettaglio: tipo (tag colorato), titolo, orario, conduttore, descrizione, avatar conduttori, pulsante ASCOLTA (se on-air → /live; se p.stream_url → openURL). Predisposto per futuri campi (cover=images[0], episodio, stream_url, badge live).
- DATI DINAMICI: usa api.programs() (nessun hardcode). Admin editor (app/admin/schedule/[id].tsx) ora ha selettore "Tipo di contenuto" (live/recorded/music/reflection) salvato nel campo `type` (backend già presente, endpoint PATCH). Verificato roundtrip: PATCH type=live → /programs ritorna live.
- Verificato via screenshot: giorno vuoto (SEI QUI + banner Diretta), giorno con 3 programmi (blocchi proporzionati, colori per tipo, host), modale dettaglio. Non toccate altre sezioni.

## Notifiche Web (PC/PWA) — diagnosi collaboratore (2026-06, produzione)
- Segnalazione: il collaboratore su PC (produzione, account registrato, permesso concesso) non riceve NESSUNA notifica; l'admin sì.
- Analisi: web push (VAPID + sw.js) implementato correttamente e robusto. send-notification admin usa notify_category → invia sia push nativa che send_web_push. AuthContext auto-iscrive al login se permesso concesso. sw.js ha handler push/notificationclick. VAPID key OK, pywebpush OK. In preview 0 iscrizioni (uso reale è in produzione, non accessibile).
- Conclusione probabile: la PRODUZIONE gira una versione precedente (molte modifiche preview non ancora ripubblicate) OPPURE il dispositivo del collaboratore non risulta iscritto lato server.
- Aggiunto strumento diagnostico in Admin → Notifiche: card "Dispositivi web (PWA / PC): N · Account registrati · Ospiti" (via GET /admin/webpush/stats, nuovo api.adminWebpushStats). Ogni riga dello storico invii mostra ora "· N web" (web_delivered). Così l'admin verifica se il PC del collaboratore è realmente iscritto e se il web push consegna.
- Azione utente: RIDEPLOY (Publish) per portare in produzione codice+diagnostica; poi far aprire al collaboratore l'app (loggato) → Impostazioni → Notifiche → Attiva/Consenti → verificare che il contatore aumenti e che un invio di test mostri ">=1 web". Se resta 0 in produzione → contattare support.

## Barra di navigazione configurabile da Admin (2026-06, session fork)
- Richiesta utente: poter scegliere QUALI sezioni mostrare nella barra in basso, l'ORDINE e QUANTE (anche Bibbia, Piani, ecc.); Home/Altro NON fissi; pannello in Admin → Impostazioni.
- Backend: nuovo campo `nav_items: List[str]` in GeneralSettings (persistito via PUT /admin/settings, ritornato da /settings). Default = ["index","podcast","meditazioni","news","palinsesto","profilo"].
- Frontend: nuovo `src/components/navConfig.ts` (NAV_CATALOG di 14 destinazioni: index/podcast/meditazioni/news/palinsesto/bibbia/piani/preghiera/donazioni/vetrina/traguardi/chisiamo/contatti/profilo, con route+icona; useNavItems() + activeKeyForPath()). Nuovo `src/components/AppBottomBar.tsx`: barra unica config-driven, naviga con router.navigate, stato attivo via usePathname; se >6 voci diventa scrollabile orizzontalmente (altrimenti flex). GlassTabBar e GlobalTabBar ora sono wrapper di AppBottomBar (stessa barra dentro i tab e sugli screen stack → coerente ovunque). (tabs)/_layout: rimossa la logica href:null basata su section_visibility (la barra è guidata da nav_items).
- Admin UI (app/admin/settings.tsx): sezione "Barra di navigazione (in basso)" con lista riordinabile (↑ ↓), rimozione (✕) e chip "Aggiungi sezione" per le voci non incluse. Nessun limite di quantità.
- Verificato E2E: PUT nav_items=[index,bibbia,piani,donazioni,profilo] → /settings lo ritorna → la barra mostra Home|Bibbia|Piani|Sostieni|Altro; tap Bibbia naviga e la barra resta coerente (Bibbia evidenziata). Ripristinato default. UI admin renderizzata correttamente.

## Palinsesto v2 — timeline VERTICALE + pagina dettaglio programma (2026-06, produzione)
- Riscrittura app/(tabs)/palinsesto.tsx: tema dark (#05070D) con verde brand (#34D399). Selettore giorni orizzontale scrollabile (Oggi | Domani | "Weekday dd/MM", 14 gg), giorno attivo verde. Timeline VERTICALE: pill orario a sinistra + linea/spine continua, card programma a destra (thumbnail quadrata da p.images[0], titolo, "con host", sottotitolo). Programma IN ONDA: bordo verde + badge IN ONDA + progress bar (calcolata da now/start/end, gestisce mezzanotte). Parte dal giorno corrente. Scroll verticale completo. Tap card → /programma/{slug}.
- Nuova pagina app/programma/[slug].tsx: hero image + gradient, back+share, titolo, "con host", giorni+orario, pulsante "AVVIA ULTIMA PUNTATA" (o "Nessuna puntata disponibile"), azioni Contattaci/Preferiti/Condividi (Share nativo, favorites backend, contatto via contact_url o /contact), tab "Le puntate | Informazioni". Puntate: play (apre audio via audioSrc/Linking), titolo, data, durata, share; ordinate recenti→vecchie. Info: descrizione lunga, conduttore, giorni, orario, categoria, social.
- Backend: _normalize_program esteso con slug (auto da titolo), subtitle, category, hero_image, long_description, social(dict), contact_url, episodes[] (id auto, sort date desc). ProgramIn/ProgramEdit + EpisodeIn estesi. Nuovi endpoint: GET /api/program/{slug} (dettaglio pubblico); GET /api/me/favorite-programs + POST /api/me/favorite-programs/{id} (toggle, coll program_favorites). imageopt: hero_image servito come URL leggero. Episodi ricevono id in create/edit.
- Admin schedule/[id].tsx: aggiunti campi sottotitolo, categoria, hero image (3:4), descrizione completa, contatto, social (fb/ig/yt/web) ed editor Puntate (aggiungi/rimuovi: titolo, data, durata, link audio, descrizione). Modifiche riflesse automaticamente nel palinsesto.
- Ricorrenze: gestite via weekdays (un solo programma, più giorni). Mezzanotte: end<=start → +1440.
- Verificato E2E: timeline verticale + selettore giorni (screenshot), pagina dettaglio (hero/azioni/tab/puntate), PATCH admin (subtitle/category/episodes con id/sort/social) → /program/{slug}, favorites toggle add/list/remove. Dati di test ripuliti.
- NOTA: la riproduzione puntata apre l'URL audio (audioSrc) esternamente; integrazione col player in-app è un possibile step futuro.

## Palinsesto v2.1 — colori del sito + timeline 24h continua (2026-06)
- Feedback utente: il palinsesto era troppo scuro (non i colori del sito) e mancava la vera timeline 24h (mostrava solo l'orario dei programmi).
- FIX colori: palinsesto.tsx e programma/[slug].tsx ora usano il tema chiaro dell'app (colors.surface/onSurface/brandPrimary/muted/border; LIVE=colors.error). La hero del dettaglio resta con overlay scuro + testo bianco sopra l'immagine, il resto chiaro.
- FIX timeline: ora render di TUTTE le 24 ore (00:00→23:00) con pill orario + spine continua; i programmi vengono agganciati all'ora di inizio (floor(start/60)); ora corrente evidenziata (pill blu). On-air card con bordo rosso + badge + progress. Verificato: 00:00/12:00/22:00 presenti, scroll continuo.

## Notizie compatte + Piani ripresa (2026-06)
- Notizie: card della lista trasformate in righe compatte (miniatura 76x76 + categoria + titolo 2 righe + estratto 2 righe + link "Leggi di più ›") stile Piani Biblici; tap apre /news/[id]. Banner "In primo piano" invariato in cima.
- Piani Biblici (app/lettore/piano/[id].tsx): alla riapertura scrolla automaticamente al primo giorno NON completato (resumeDay = primo day non in completed_days), via onLayout delle day card + scrollRef.scrollTo (una sola volta per apertura, solo se ci sono progressi). Verificato news via screenshot; ripresa piano da validare con un piano reale con progressi parziali.

## Fix foto Palinsesto (2026-06)
- BUG: le foto dei programmi (card timeline e hero pagina programma) non si vedevano. Causa: p.images[0]/p.hero_image sono già URL /api/img assoluti (imageopt + absolutizeImages), ma venivano ri-passati a mediaUrl() → URL rotto (BASE/api/media/https://...).
- FIX: helper imgUri() in palinsesto.tsx e programma/[slug].tsx → usa il valore così com'è se è già http/​/api/​/data:, altrimenti mediaUrl(id). Verificato: card mostra la miniatura, fallback icona microfono se nessuna foto.

## Bottom Navigation — Personalizzazione icone & animazioni (giugno 2026)
- Nuova schermata Admin `/admin/nav-icons` ("Personalizzazione Navigazione"): per ogni voce della barra si configurano nome, colore icona normale/attiva, indicatore/onda on-off, icona statica personalizzata (PNG/WebP), icona attiva e animazione opzionale (Lottie .json / GIF / WebP animato) riprodotta UNA volta alla selezione. Anteprima live per singolo asset e dell'intera barra.
- Storage: `settings.nav_config` (per-key). Applicato live via context, nessun deploy necessario. Asset caricati con chunked upload (GridFS media); il backend accetta json/lottie/gif e NON appiattisce immagini animate (`_optimize_image` salta gli animati).
- Home ora usa il faro (MaterialCommunityIcons lighthouse) come icona di default.
- Fallback: file animato/icona corrotti -> icona statica; asset mancante -> icona vettoriale predefinita.
- File: `app/admin/nav-icons.tsx`, `src/components/navConfig.tsx`, `src/components/AppBottomBar.tsx`, `src/components/nav/NavAnim.{web,native}.tsx`. Lib aggiunte: lottie-react-native (native), lottie-react (web).

## Versetto del Giorno — Scheda girevole (flip card) Home (giugno 2026)
- `VerseOfDayCard` ora e' una scheda girevole. FRONTE: logo + "Radio Pescatori di Uomini", "VERSETTO DEL GIORNO", versetto + riferimento, sfondo marino (onde/raggi/bolle), icona Condividi in alto a dx, footer con invito a girare. RETRO (tap): "MEDITAZIONE DEL GIORNO" (da `verseMeditation`), player audio "Ascolta la meditazione" (`verseMeditationAudioUrl`) e pulsante "Leggi il contesto"; footer "Tocca per tornare al versetto".
- Flip via reanimated rotateY + crossfade opacity + backfaceVisibility; pointerEvents per faccia.
- Testo invito ("gira la scheda") modificabile dal pannello Admin -> Versetto del Giorno (campo `verse_flip_hint` in settings; default "Tocca la scheda per girarla"). Applicato live.
- File: `src/components/VerseOfDayCard.tsx`, `app/admin/verses/index.tsx`, backend `GeneralSettings.verse_flip_hint`.

## Preferiti nella Biblioteca + Rinomina sezioni (giugno 2026)
- Preferiti generici: nuova collezione `user_favorites` per meditazioni e CMS (studi-biblici/predicazioni/video). Endpoint: GET `/me/content-fav-ids`, POST `/me/content-fav/{type}/{id}`, GET `/me/library` (raggruppa podcast+meditazioni+CMS+programmi in card). Podcast/programmi restano nelle loro collezioni legacy (union in /me/library).
- Cuore/salva aggiunto: dettaglio CMS `c/[section]/[id]` (heart in topbar) e reels Meditazioni (RailBtn bookmark "Salva"). Hook `src/hooks/useContentFav.ts` + `api.contentFavIds/toggleContentFav/myLibrary`.
- Biblioteca: blocco "I tuoi preferiti" raggruppato per categoria in cima; Profilo: rimossa sezione "Podcast preferiti", aggiunto CTA verso Biblioteca.
- Rinomina sezioni: settings.section_labels (Dict) + helper `src/utils/labels.ts` (useLabel/LABEL_CATALOG) applicato a Profilo menu e Biblioteca. Nuova schermata admin `app/admin/section-names.tsx` ("Nomi delle sezioni"). Applicato live.

## Biblioteca a cartelle (solo preferiti) + assegnazione contenuti (giugno 2026)
- La Biblioteca ora e' una libreria personale: mostra solo i PREFERITI dell utente raggruppati in CARTELLE gestite dall admin. Aprendo una cartella si vedono i preferiti dentro (rimovibili).
- Backend: `library_folders` (CRUD admin, seed 6 default con default_types), `content_folders` (mappa item->cartella). Endpoint: GET /library-folders, GET/POST/PUT/DELETE /admin/library-folders, GET /admin/content-catalog, POST /admin/content-folder, GET /me/library (raggruppa per cartella: assegnazione esplicita o default per tipo). Fix: FolderIn (PUT parziale, tutti opzionali) vs FolderCreateIn (POST, name richiesto).
- Admin: `app/admin/library-folders.tsx` (crea/rinomina/elimina/riordina/icona), `app/admin/content-folders.tsx` (assegna ogni contenuto a una cartella con chip).
- Frontend: `app/biblioteca.tsx` (lista cartelle solo-preferiti), `app/biblioteca/folder/[id].tsx` (dettaglio con rimozione).
- Nomi sezioni anche in HOME: aggiunte chiavi home_* in labels.ts, wired in index.tsx + BibleCard/ReadingPlansCard/BachecaCard.

## Diretta sincronizzata dal Palinsesto (rimpiazza AzuraCast lato utente) (giugno 2026)
- Ogni programma del Palinsesto puo avere un media di diretta: `broadcast_media_url` (+ `broadcast_media_kind` video/audio). Impostato nell editor admin (`app/admin/schedule/[id].tsx`) con toggle Video/Audio + MediaUpload (chunked). Salvato come URL RELATIVO `/api/media/{id}` (o link esterno) -> env-safe.
- Backend `GET /live/now`: trova il programma ON AIR ora (usa `_is_on_air`), calcola offset_seconds (now-start) per la sincronizzazione tipo TV/radio, duration, ends_in, e `next`. Modelli ProgramIn/ProgramEdit + `_normalize_program` estesi.
- Frontend `app/diretta.tsx`: player unico `expo-video` (video o audio) che fa seek all offset e riproduce; poll ogni 15s con correzione drift (>6s). Fuori orario mostra "Nessuna diretta in corso" + prossimo programma. Home CTA "In diretta" ora apre `/diretta` (non piu AzuraCast).
- NOTA: audio background/schermo bloccato e video richiedono BUILD NATIVA (non Expo Go).

## Diretta: countdown + notifica pre-inizio (giugno 2026)
- Countdown nella schermata `app/diretta.tsx`: fuori orario mostra "La diretta inizia tra HH:MM:SS" + nome/orario prossimo programma (usa next.starts_at da /live/now, tick 1s).
- Notifica pre-diretta: scheduler backend `_live_notif_scheduler` (ogni 60s) invia via `notify_category("diretta", ...)` (STESSO sistema push del versetto del giorno) ~10 min prima (LIVE_NOTIF_MINUTES) di ogni programma con broadcast_media_url. Idempotente per programma/giorno (`live_notif_sent`). Funziona solo su build nativa.
- PENDING (richiesta utente): diretta in TEMPO REALE (RTMP/HLS) selezionabile dal pannello insieme alle registrate -> integrazione separata, serve scegliere provider streaming.

## Diretta Fase 2 — Streaming live + A seguire + Riempitivo (2026-06/08)
- COMPLETATO. Tre estensioni alla Diretta (retrocompatibili):
  1. **Streaming live in tempo reale**: nell'editor programma (admin/schedule/[id]) switch "Diretta in tempo reale (live)" → si incolla l'URL dello stream HLS (.m3u8, es. Mux/Cloudflare Stream/YouTube). Se attivo, `/diretta` trasmette lo stream in tempo reale (no seek); se disattivo, il file caricato va in onda sincronizzato all'orario. Backend: `broadcast_media_url` + `broadcast_is_live` → esposti in `/live/now` come `media.{url,kind,is_live}`.
  2. **A seguire (up_next)**: `/live/now` restituisce `up_next[]` (prossimi programmi di oggi, max 6); mostrato in `/diretta`.
  3. **Riempitivo (filler)**: Admin > Palinsesto → card "Impostazioni Diretta · Riempitivo" (testID filler-toggle): tipo Nessuno/Video/Audio/Messaggio; per Video/Audio MediaUpload (file GridFS o URL), per Messaggio testo. Salvato in settings `general` (`live_filler_kind/url/message`) via PUT /admin/settings (exclude_unset, non azzera altre settings). `/live/now` → `filler{kind,url,message}`; `/diretta` off-air riproduce il filler media o mostra il messaggio, altrimenti countdown al prossimo programma.
- File: `frontend/app/admin/schedule/index.tsx` (UI riempitivo completata), `frontend/app/diretta.tsx`, `backend/server.py` (/live/now ~218-282, GeneralSettings live_filler_*).
- Test: backend 7/7 (iteration_48, tests/test_live_now_filler.py) + frontend E2E (admin salva riempitivo + persiste, /diretta riflette messaggio/countdown). Nessun bug.
