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
