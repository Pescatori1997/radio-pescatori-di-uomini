#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
user_problem_statement: "Pescatori di Uomini - complete remaining Admin sections (Schedule, Radio, Prayers, Messages/Testimonies, Users, Settings) + quick fixes (HTTP 201, testIDs)."

backend:
  - task: "Admin Prayers CRUD (list/detail/patch/delete) + status workflow"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "New endpoints /api/admin/prayers (GET filter+search), /{id} GET, PATCH (status new|in_progress|prayed|archived + admin_notes), DELETE. Admin-guarded."
  - task: "Admin Messages/Testimonies CRUD + public testimonies"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET/PATCH/DELETE /api/admin/messages (status new|reviewed|published|archived, type filter, admin_notes, editable text). Publishing sets published_at. Public GET /api/testimonies returns only published testimonies (no admin_notes)."
  - task: "Admin Users list + delete"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET /api/admin/users (search, is_admin flag). DELETE /api/admin/users/{id} blocks deleting admins (400)."
  - task: "Admin Programs (Palinsesto) CRUD"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET /api/admin/programs, POST (201), PATCH, DELETE /api/admin/programs/{id}. Public GET /api/programs unchanged."
  - task: "Admin Radio settings + General Settings"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET/PUT /api/admin/radio (station_name, stream_url, backup_url, metadata_url, is_live, title, artist, artwork) persisted to live_status. GET/PUT /api/admin/settings + public GET /api/settings (contact/social/about)."
  - task: "HTTP 201 on CMS create (podcast/news/program)"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "create_podcast, create_news, create_program now return status_code=201."

frontend:
  - task: "Admin new sections UI (prayers/messages/users/schedule/radio/settings)"
    implemented: true
    working: "NA"
    file: "frontend/app/admin/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "New admin screens created; require Google admin login so skip automated frontend admin testing unless seeded token available. Public messages screen now shows published testimonies."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1

test_plan:
  current_focus:
    - "Admin Prayers CRUD (list/detail/patch/delete) + status workflow"
    - "Admin Messages/Testimonies CRUD + public testimonies"
    - "Admin Programs (Palinsesto) CRUD"
    - "Admin Radio settings + General Settings"
    - "Admin Users list + delete"
    - "HTTP 201 on CMS create (podcast/news/program)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Implemented all remaining admin backend sections. Please BACKEND-ONLY test the new endpoints. Admin auth: use seeded session token ADMINTESTTOKEN123 (Bearer) tied to pescatoridiuomini@outlook.it (conftest seeds it). Verify: admin guard (401 no token / 403 non-admin), prayers full workflow + status validation, messages/testimonies workflow (publish sets published_at, public /api/testimonies returns only published testimonies without admin_notes), programs CRUD with 201, radio GET/PUT persistence, settings GET/PUT + public /api/settings, users list+delete (admin delete blocked). Also confirm podcast/news create return 201."

## --- Merchandising module (session 3) ---
backend:
  - task: "Merchandising products CRUD + public catalog + reorder"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Public: GET /api/products (published only, search + category filter, sorted featured desc then order asc), GET /api/products/{id} (404 if missing), GET /api/products/categories (fixed list: Tutti+Abbigliamento/Cappelli/Tazze/Accessori/Libri/Altro). Admin (guarded): GET /api/admin/products (status filter published|hidden|featured, category, search), GET /{id}, POST (201, availability validated to available|coming_soon|sold_out => 400 invalid, order auto-set), PATCH (invalid availability => 400), DELETE, POST /api/admin/products/reorder {ids:[]} sets order. Fields: name, description, long_description, category, price(str), images[], colors[], sizes[], availability, featured, published. admin/stats now includes products count."

test_plan:
  current_focus:
    - "Merchandising products CRUD + public catalog + reorder"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "BACKEND-ONLY test the new Merchandising endpoints. Admin auth: Bearer ADMINTESTTOKEN123 (seeded by conftest). Verify: auth guard (401 no token, 403 non-admin, 200 admin) on /api/admin/products; create returns 201 + id; invalid availability on create AND patch returns 400; public GET /api/products returns only published products and NOT hidden ones; category + search filters; featured products sorted first; GET /api/products/{id} 404 for missing; reorder endpoint updates order and is reflected in list order; delete removes. Clean up TEST_-prefixed products. Products collection currently intentionally empty (empty-state feature)."

## --- Segnalazioni / Feedback (session 16) ---
backend:
  - task: "Reports/Feedback: create + admin management (list/detail/status/delete/unread)"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "POST /api/reports (public, optional auth; category in [bug,suggestion,technical,other]; title+description required => 400 if empty; invalid category => 400; screenshot/video base64 => 413 if > 12MB; captures user_id/name/email if authed, else null=Ospite; status=new, read=false; returns 201 {ok,id}). Admin (require_admin): GET /api/admin/reports (filters status/category/search, sort asc|desc, excludes heavy base64 from list), GET /api/admin/reports/unread-count, GET /api/admin/reports/{id} (marks read=true on open, 404 if missing), PATCH /api/admin/reports/{id} {status in [new,in_progress,resolved,closed]} (invalid => 400, marks read, logs activity, 404 if missing), DELETE /api/admin/reports/{id}. /admin/stats includes reports + reports_new counts."

frontend:
  - task: "Reports/Feedback UI: public form + admin list/detail"
    implemented: true
    working: "NA"
    file: "frontend/app/report.tsx, frontend/app/admin/reports/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Public /report form (category chips, title/description validation, optional screenshot+video via image picker, success state). Entry link added to Profilo menu ('Segnala un problema'). Admin /admin/reports list (search, status+category filters, sort, unread dot/highlight) + /admin/reports/[id] detail (status change chips, screenshot/video render via VideoEmbed for base64, delete with confirmAsync). Added 'Segnalazioni' entry to AdminShell sidebar. Dashboard card with reports_new badge already present."

test_plan:
  current_focus:
    - "Reports/Feedback: create + admin management (list/detail/status/delete/unread)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

## --- Meditazioni multi-format overhaul (session 18) ---
backend:
  - task: "Meditazioni: multi-format media (upload video/audio/pdf via GridFS + chunked upload + Range streaming + embeds)"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GridFS bucket 'media'. Chunked upload (admin, require_perm meditations): POST /api/admin/uploads/init {filename,mime}->upload_id; PUT /api/admin/uploads/{id}/chunk (raw body, appended to /tmp file); POST /api/admin/uploads/{id}/complete -> streams temp file into GridFS, returns {media_id, media_type(video|audio|pdf), media_mime, media_filename, size, duration(ffprobe), thumbnail(ffmpeg frame for video)}. Public streaming GET /api/media/{id} with HTTP Range (206 + Content-Range/Accept-Ranges) and ?download=1 (Content-Disposition attachment). Meditation model extended: subtitle, duration, media_id, media_type, media_mime, media_filename, downloadable, attachments; kept video_url for legacy/embeds. _decorate_meditation adds content_type + provider (detect_provider: youtube/vimeo/tiktok/instagram/facebook/spotify). CREATE/EDIT accept new fields; EDIT deletes previous GridFS media when media_id replaced; DELETE removes GridFS media+attachments. Draft/publish/schedule + notify preserved. Verified via curl: init->chunk->complete->stream full 200 + Range 206; provider detection; create/get/delete. ffmpeg+ffprobe installed."

frontend:
  - task: "Meditazioni UI: admin editor (upload/link + progress + replace media + all fields), unified in-app player, user card badges + detail Play/Download/Share"
    implemented: true
    working: "NA"
    file: "frontend/app/admin/meditations/[id].tsx, frontend/app/meditazioni/[id].tsx, frontend/app/(tabs)/meditazioni.tsx, frontend/src/components/MeditationPlayer.(web|native).tsx, frontend/src/utils/embeds.ts, frontend/src/api.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Admin editor: title/subtitle/speaker/verse/category/duration, content source segment [Carica file | Link esterno]. Upload via expo-document-picker (video/audio/pdf, 1GB guard) + uploadMediaChunked() with progress bar; shows detected type + replace file; auto cover from ffmpeg frame prefilled; downloadable switch; draft/publish/schedule. Link mode shows detected provider. Unified MeditationPlayer: web renders <video>/<audio>/<iframe pdf>/<iframe embed>; native uses WebView (HTML5 video/audio, Google gview for PDF, provider iframe). Detail screen: in-app player + subtitle/duration/provider pills + verse + Condividi + Scarica(if downloadable). Card shows type badge + duration. Verified public YouTube detail via screenshot (in-app iframe player + buttons). Admin UI is behind Google welcome gate (not automatable)."

test_plan:
  current_focus:
    - "Meditazioni: multi-format media (upload video/audio/pdf via GridFS + chunked upload + Range streaming + embeds)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Test the Meditazioni multi-format overhaul. Admin backend auth: login POST /api/auth/login {email: pescatoridiuomini@outlook.it, password: AdminTestPwd1!} -> token; use Bearer for /api/admin/*. BACKEND focus: (1) chunked upload lifecycle init->chunk(raw --data-binary)->complete for a small PDF and a small MP3 (mime audio/mpeg) -> assert media_type pdf/audio; (2) GET /api/media/{id} full 200 + correct content-type/size, and Range 'bytes=0-99' -> 206 with Content-Range & Content-Length=100 & Accept-Ranges; ?download=1 -> Content-Disposition attachment; (3) create meditation with external links and assert _decorate provider/content_type: youtube, vimeo (https://vimeo.com/76979871), spotify (https://open.spotify.com/episode/xxxx), tiktok, instagram, facebook, and embed; (4) create meditation with uploaded media_id -> content_type == media_type, provider=='upload'; (5) EDIT replacing media_id deletes old GridFS file (old /api/media/{oldid} -> 404 after); (6) DELETE meditation removes media (media 404 after); (7) draft not returned by public GET /api/meditations; scheduled (future publish_date) not returned until due; (8) auth guard on admin upload/meditation endpoints (401 no token). Clean up all TEST_-prefixed meditations and any GridFS files you create. FRONTEND admin UI is behind the Google welcome gate -> not automatable; only public meditation viewing is testable (continue as Ospite -> Meditazioni tab -> open item -> in-app player renders)."

## --- Donazioni LIVE + Merch checkout (session 19) ---
backend:
  - task: "Stripe official SDK: one-time donation, monthly subscription, merch order checkout + order confirmation"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "All Stripe flows migrated to official `stripe` SDK using env STRIPE_API_KEY (no hardcoded keys). Pod placeholder key sk_test_emergent only works via Emergent proxy, NOT official SDK -> real session creation not testable here (returns 400 by design). Endpoints: /api/donations/checkout (one-time payment, amount 1..5000 validated), /api/donations/subscribe {plan 5|10|20} (subscription, auto-provisions Price via lookup_key), /api/orders/checkout (multi line_items, price RECOMPUTED from DB, delivery shipping|pickup validated), /api/orders/status/{session_id}, /api/admin/orders GET+PATCH (require_perm merch). Webhook uses official construct_event + STRIPE_WEBHOOK_SECRET (optional). All Stripe calls try/except -> clean 400/404."
frontend:
  - task: "Donations monthly UI + merch buy flow (qty/size/color, delivery, order confirmation + WhatsApp)"
    implemented: true
    working: "NA"
    file: "frontend/app/donate.tsx, checkout.tsx, order-success.tsx, merch/[id].tsx, src/api.ts"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Verified via screenshots (design preserved): donate presets 5/10/25/50/100 + 'Sostieni la radio ogni mese' subscription cards; merch 'Acquista ora' + qty/size/color; /checkout delivery form (Spedizione/Ritiro); /order-success confirmation + WhatsApp prefilled (393517556255). Stripe redirect needs owner real key."

agent_communication:
    -agent: "main"
    -message: "IMPORTANT: pod STRIPE_API_KEY is placeholder sk_test_emergent -> official SDK real session creation CANNOT succeed here (returns 400 by design, NOT 500). Focus BACKEND on VALIDATION/SECURITY/graceful-errors. Admin login: POST /api/auth/login {email: pescatoridiuomini@outlook.it, password: AdminTestPwd1!} -> token. Verify: donation amount<1/>5000 ->400, valid ->400(not500); subscribe invalid plan ->400, valid ->400; create TEST_ product price '15,00' available published; orders/checkout empty items->400, missing shipping fields->400, pickup missing phone->400, sold_out->400, unknown product->404, valid->400 AND assert NO orphan order left; admin/orders no token->401/403; price recomputed server-side. Clean up TEST_ products/orders. FRONTEND verified by screenshots already; Stripe redirect needs owner key -> not testable."

## --- Universal CMS Phase 1 (session 20) ---
backend:
  - task: "Generic CMS content routes per section (studi-biblici, predicazioni, video)"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Generic /api/contents + /api/admin/contents CRUD, duplicate, delete already in backend. api.ts fixed to strip undefined query params (was serializing 'undefined' string -> empty results). Seeded 2 demo studi-biblici via Mongo."
frontend:
  - task: "Generic admin editor + public Biblioteca hub + section list/detail with unified player"
    implemented: true
    working: "NA"
    file: "frontend/app/admin/content/[section]/[id].tsx, app/biblioteca.tsx, app/c/[section]/index.tsx, app/c/[section]/[id].tsx"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Public flow verified via screenshot (guest): Biblioteca hub, section list with category chips + seeded items, detail with YouTube embed player + meta pills + tags + share/download + prev/next. Admin editor behind Google gate."

agent_communication:
    -agent: "main"
    -message: "Test Universal CMS Phase 1. Admin login: POST /api/auth/login {email: pescatoridiuomini@outlook.it, password: AdminTestPwd1!} -> token; Bearer for /api/admin/*. BACKEND: (1) GET /api/content-sections returns 6 sections; (2) admin create content section=predicazioni status=draft -> 201, NOT in public GET /api/contents?section=predicazioni; (3) create status=published -> appears in public; (4) PATCH edit title/category; (5) POST /api/admin/contents/{id}/duplicate -> 201 new draft copy; (6) DELETE removes it; (7) invalid section -> 404; (8) filter public by category & search work (verify undefined params fix: GET /api/contents?section=studi-biblici returns the 2 seeded items 'Il Sermone sul Monte'/'La Fede di Abramo'); (9) auth guard 401 no token on admin content routes. Clean up all TEST_-prefixed content you create. FRONTEND (public only, admin behind Google gate): as Ospite from /welcome -> Home 'Biblioteca' banner -> hub shows Podcast/Meditazioni/Studi Biblici/Predicazioni/Video -> tap Studi Biblici -> list shows 2 items + category chips -> open item -> player + prev/next + related render."

## --- Home immersiva + Versetto del Giorno (session fork) ---
backend:
  - task: "Versetto del Giorno: public today/by-id + admin CRUD + daily rotation (Europe/Rome)"
    implemented: true
    working: "NA"
    file: "backend/server.py, backend/verses_data.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Public GET /api/verse/today (deterministic daily pick by Europe/Rome ordinal % count over active verses sorted by order,created_at) and GET /api/verse/{id} (404 if missing). Admin (require_perm 'verses', added to PERM_SECTIONS): GET /api/admin/verses (search text/reference), POST (201, auto order, created_at), PATCH /{id} (404 if missing), DELETE /{id}. Seeded 124 public-domain verses on empty collection. admin/stats includes 'verses'."

frontend:
  - task: "Home immersive redesign: animated weather, live hero FX, marine WhatsApp, Verse of Day card + Bibbia page + admin verses CRUD UI"
    implemented: true
    working: "NA"
    file: "frontend/src/components/{WeatherAnimation,LiveHeroFx,marine,VerseOfDayCard,WhatsAppSection,WeatherWidget}.tsx, frontend/app/(tabs)/index.tsx, frontend/app/bibbia.tsx, frontend/app/admin/verses/*"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Verified via screenshots (guest): animated weather illustration (cloud drift for Roma), hero blue glow + sound rings + pulsing live dot, marine WhatsApp section (net/waves/bubbles/glass cards), Verse of Day marine card with sunrise/waves/net/bubbles + 'Leggi il contesto' -> Bibbia page (Numeri 6, verse 24 highlighted + chapter placeholder). Admin verses screens behind gate."

test_plan:
  current_focus:
    - "Versetto del Giorno: public today/by-id + admin CRUD + daily rotation (Europe/Rome)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "BACKEND-ONLY test the new Versetto del Giorno endpoints. Admin login: POST /api/auth/login {email: pescatoridiuomini@outlook.it, password: AdminTestPwd1!} -> token; Bearer for /api/admin/*. Verify: (1) GET /api/verse/today returns a verse doc {id,text,reference,book,chapter,verse}; called twice same-day returns SAME verse (deterministic); (2) GET /api/verse/{id} works and 404 for unknown; (3) admin GET /api/admin/verses returns list incl seeded 124; search by reference (e.g. 'Giovanni') and by text works; (4) POST create (201 + id) with text+reference -> appears in list and via /api/verse/{id}; (5) PATCH edit text/active; setting active:false removes it from rotation pool (today endpoint never returns inactive); 404 patch unknown; (6) DELETE removes it; (7) auth guard: /api/admin/verses no token -> 401. Clean up any TEST_-prefixed verses you create. Do NOT delete seeded verses."

## --- v1.1: Hardening + Share + TTS + Verse notif time/days (session fork) ---
backend:
  - task: "Security/perf hardening: rate limit, CORS, anti-ReDoS regex, DB indices, admin bootstrap block"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added in-memory sliding-window rate limiter (login 10/60s, register 5/60s, contact/prayer/messages/reports 8/60s -> 429). CORS: allow_credentials=False, origins from CORS_ORIGINS env (default *). All search regexes now re.escape()'d (anti-ReDoS). New DB indices (contents, verses, programs, prayer_requests, messages). Register now blocks ADMIN_EMAILS allowlist addresses (must use Google) — NOTE: ADMIN_EMAILS env is EMPTY in this env, so this guard is inert here and existing email/password admin login is unaffected."
  - task: "Meditation TTS (OpenAI via Emergent) optional/cached + verse notif send_time/send_days"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET /api/verse/{id}/meditation now returns {meditation,reflection,audio:bool} and fire-and-forget generates MP3 (OpenAI tts-1, voice nova) cached as base64. GET /api/verse/{id}/meditation/audio streams audio/mpeg (404 if not ready). Manual meditation edit + regenerate invalidate cached audio. Verse notification config gained send_time (HH:MM) + send_days (Italian weekday names); scheduler only fires past send_time on allowed weekday (Europe/Rome), once/day atomic. GET/PUT /api/admin/verse-notification include send_time/send_days/all_days. TTS failures must NOT break meditation text."
frontend:
  - task: "Share verse card, TTS player, offline cache, admin notif time/days UI"
    implemented: true
    working: true
    file: "frontend/src/components/{ShareVerseSheet,MeditationAudioButton}.tsx, frontend/app/bibbia.tsx, frontend/app/admin/verses/index.tsx, frontend/src/components/VerseOfDayCard.tsx"
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Verified via screenshot: share card renders (marine themed, capture+share/download), audio 'Ascolta la meditazione' button appears when audio ready. Offline: verse+meditation cached in AsyncStorage. Admin notif card gained send_time input + weekday chips."

test_plan:
  current_focus:
    - "Security/perf hardening: rate limit, CORS, anti-ReDoS regex, DB indices, admin bootstrap block"
    - "Meditation TTS (OpenAI via Emergent) optional/cached + verse notif send_time/send_days"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "BACKEND retest for v1.1. Admin login POST /api/auth/login {pescatoridiuomini@outlook.it / AdminTestPwd1!} -> token. Verify: (1) Rate limit: 11 rapid POST /api/auth/login (bad creds) -> first 10 return 401, then 429. (2) Regex safety: GET /api/podcasts?search=(a+)+ returns 200 (no hang/500). (3) TTS: GET /api/verse/today -> id; GET /api/verse/{id}/meditation returns {meditation,reflection,audio}; within ~15s GET /api/verse/{id}/meditation/audio returns 200 audio/mpeg (>10KB). If EMERGENT_LLM_KEY missing it should degrade gracefully (meditation still returned, audio endpoint 404). (4) Verse notif config: GET /api/admin/verse-notification has send_time,send_days,all_days; PUT with send_time '08:00' and send_days subset persists; invalid days filtered out. (5) Manual meditation edit via PATCH /api/admin/verses/{id} {meditation:'x'} sets meditation_locked true AND clears audio (audio endpoint 404 after). Clean up TEST_ verses. Do NOT delete seeded verses. Existing endpoints (verse today/CRUD, notify-today) must still work. NOTE: native push relay returns non-fatal error in dev (EMERGENT_PUSH_KEY placeholder) — expected."

## --- Bibbia Fase 1: Lettore biblico (Riveduta 1927 self-hosted) ---
backend:
  - task: "Bible reader API + Riveduta 1927 seed (self-hosted, multi-translation ready)"
    implemented: true
    working: "NA"
    file: "backend/server.py, backend/bible_seed.py, backend/data/riveduta_1927.json"
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Seeded Riveduta 1927 (public domain) into bible_verses (31102 verses), bible_books (66), bible_translations. Endpoints: GET /api/bible/translations; GET /api/bible/books (grouped at/nt); GET /api/bible/chapter?book=&chapter= (verses + chapters_count); GET /api/bible/resolve?reference=Giovanni 3:16 (also book+chapter+verse); GET /api/bible/search?q= (Mongo text index italian, regex fallback, escaped); GET/PUT /api/me/bible/state (auth, last read position). Text index default_language italian."
frontend:
  - task: "Bible reader UI (books, chapter reader, search, remember position) + Leggi il capitolo wiring"
    implemented: true
    working: true
    file: "frontend/app/lettore/{index,read,search}.tsx, frontend/src/components/VerseOfDayCard.tsx, frontend/app/bibbia.tsx"
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Verified via screenshots: /lettore books AT/NT + chapter picker; /lettore/read chapter reader (Giovanni 3, numbered verses, font toggle, chapter selector, prev/next, remembers last position via AsyncStorage + /me/bible/state); /lettore/search full-text with highlight (pescatori->11 results) and tap opens reader with verse highlighted + autoscroll. VerseOfDayCard gained 'Apri la Bibbia'; meditation page gained 'Leggi il capitolo nella Bibbia'."

test_plan:
  current_focus:
    - "Bible reader API + Riveduta 1927 seed (self-hosted, multi-translation ready)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "BACKEND test the new Bible reader endpoints (public, no auth except /me/bible/state). Verify: (1) GET /api/bible/translations returns >=1 with riveduta_1927 is_default true. (2) GET /api/bible/books returns at(39 books) + nt(27 books). (3) GET /api/bible/chapter?book=43&chapter=3 returns book_name 'Giovanni', chapters_count 21, and verse 16 text contains 'Iddio ha tanto amato il mondo'. 404 for book=999. (4) GET /api/bible/resolve?reference=Giovanni 3:16 -> book_nr 43, chapter 3, verse 16. Also resolve?book=Salmi&chapter=23&verse=1 works. (5) GET /api/bible/search?q=pescatori returns >=5 results including Marco/Matteo; q with special regex chars returns 200 (no 500). (6) /me/bible/state PUT (auth Bearer, admin token via /api/auth/login pescatoridiuomini@outlook.it/AdminTestPwd1!) then GET returns saved book_nr/chapter. Do not modify seeded data."

## --- Bibbia Fase 3: Piani di Lettura (Reading Plans) ---
backend:
  - task: "Reading plans API (public list/detail, enroll, day toggle, progress) + admin CRUD + seed 2 plans"
    implemented: true
    working: "NA"
    file: "backend/server.py, backend/reading_plans_seed.py"
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "New reading plans. Seeded 2 published plans idempotently (seed_key): 'Incontra Gesu - 7 giorni nei Vangeli' (7 days) and 'Le Promesse di Dio - 30 giorni di speranza' (30 days). Public: GET /api/reading-plans (published only, trimmed), GET /api/reading-plans/{id} (full days + enrollment if auth). Auth (me): GET /api/me/reading-plans (my enrollments+progress), POST /api/me/reading-plans/{id}/enroll, POST /api/me/reading-plans/{id}/day/{day} {done:bool} toggle (returns progress, marks completed_at when all done), DELETE /api/me/reading-plans/{id} (reset). Admin (require_perm verses): GET /api/admin/reading-plans, GET/POST(201)/PUT/DELETE /api/admin/reading-plans/{id}. Collections: reading_plans, plan_enrollments."
frontend:
  - task: "Reading plans UI (Bible home entry, plans list with progress, plan detail enroll/day-complete/open-reading) + admin list & nested editor"
    implemented: true
    working: "NA"
    file: "frontend/app/lettore/{index,piani}.tsx, frontend/app/lettore/piano/[id].tsx, frontend/app/admin/reading-plans/{index,[id]}.tsx, frontend/src/components/AdminShell.tsx, frontend/src/api.ts"
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Bible home (/lettore) gained a 'Piani di Lettura' card + header icon -> /lettore/piani. /lettore/piani lists 'I miei piani' (progress bars) + available plans. /lettore/piano/[id] shows plan detail, Inizia il piano (enroll; guests prompted to login), per-day checkbox toggle (optimistic), and readings that open the reader with highlight. Admin sidebar item 'Piani di Lettura' (perm verses); /admin/reading-plans list + /admin/reading-plans/[id] editor (new/existing) with nested days & readings (book picker modal, chapter/verse fields), status draft/published, featured, delete."

test_plan:
  current_focus:
    - "Reading plans API (public list/detail, enroll, day toggle, progress) + admin CRUD + seed 2 plans"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "BACKEND test Fase 3 reading plans. Admin login POST /api/auth/login {pescatoridiuomini@outlook.it / AdminTestPwd1!} -> token. Verify: (1) GET /api/reading-plans returns 2 published plans with duration_days 7 and 30. (2) GET /api/reading-plans/{id} returns full days array (len==duration_days), each day has readings with book_nr/chapter, enrollment null when unauth. (3) As a normal user (register test user), POST enroll -> GET /api/me/reading-plans shows plan with progress percent 0. (4) POST day/1 {done:true} -> progress completed_count 1; toggle day/1 {done:false} -> 0; invalid day (0 or >duration) -> 400. (5) DELETE /api/me/reading-plans/{id} resets (my plans empty). (6) Admin CRUD: POST /api/admin/reading-plans (201) create draft with 1 day/1 reading; it must NOT appear in public list (draft); PUT to published -> appears; DELETE removes it AND its enrollments. Non-admin listener calling admin endpoints -> 403. Do NOT delete the 2 seeded plans."

## --- Bacheca Richieste di Preghiera (moderata) ---
backend:
  - task: "Prayer board: visibility (board/private), moderation (published), Sto pregando counter (dedupe), admin filters, notification on publish"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Extended existing prayer system (NOT rewritten). PrayerRequest now has visibility(board|private), show_name, client_id; create_prayer captures author via optional auth, board requests created published=false status=new. New public: GET /api/prayer-board (only visibility=board & published=true & !archived; display_name = name if show_name else 'Anonimo'; prayed flag via ?client_id or auth), POST /api/prayer-board/{id}/pray (unique per user_id or client_id, $inc praying_count, returns already/count). Admin GET /api/admin/prayers?filter=pending|published|private|archived (+search over text/name/author). PATCH /api/admin/prayers/{id} supports published(bool)+text+status; publishing (false->true) sets published_at and fires notify_category('prayers', '🙏 Nuova richiesta di preghiera', ...). DELETE also removes prayer_prayers marks. Unique index prayer_prayers(prayer_id,key). Curl-verified: board hidden until approve; approve->appears; pray once ok, twice already; author shown to admin."
frontend:
  - task: "Prayer submit visibility choice + public Bacheca screen (Sto pregando) + admin filters/badges/approve"
    implemented: true
    working: "NA"
    file: "frontend/app/prayer.tsx, frontend/app/prayer-board.tsx, frontend/app/(tabs)/index.tsx, frontend/app/admin/prayers/index.tsx, frontend/app/admin/prayers/[id].tsx, frontend/src/utils/clientId.ts, frontend/src/api.ts"
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "prayer.tsx: radio choice 📢 Bacheca / 🔒 Solo admin; when board -> 'Mostra il mio nome' vs 'Pubblica in forma anonima'; name input conditional. Requires login to submit (router.push /login). Success text notes board needs approval. Header heart icon -> /prayer-board. New /prayer-board.tsx lists approved requests (❤️ display_name, text, date, '🙏 Sto pregando' button once per user/device via clientId, counter). Home: new card 'Bacheca delle Richieste di Preghiera' -> /prayer-board. Admin list: filters Tutte/In attesa/Pubblicate/Private/Archiviate, badges (Bacheca/Privata, stato, Nome/Anonima), author+date+pray count. Admin detail: edit text/notes, Approva e pubblica, Rimuovi dalla Bacheca, Rifiuta/Archivia, Ripristina, Elimina."

test_plan:
  current_focus:
    - "Prayer board: visibility, moderation, Sto pregando counter, admin filters, notification"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "TEST prayer board (feature extends existing prayer system). Admin: pescatoridiuomini@outlook.it / AdminTestPwd1!. Backend flow: (1) POST /api/prayer-requests {text, visibility:'board', show_name:true, name:'Luigi'} -> 200; must NOT appear in GET /api/prayer-board yet. (2) Register a normal user, POST /api/prayer-requests WITH Authorization header {visibility:'private'} -> author captured; appears under admin filter=private not on board. (3) Admin GET /api/admin/prayers?filter=pending shows the board one with author info; PATCH published:true -> appears in /api/prayer-board with display_name 'Luigi'. Anonymous board (show_name:false) -> display_name 'Anonimo'. (4) POST /api/prayer-board/{id}/pray {client_id:'x'} -> count 1; repeat -> already:true count still 1; different client_id -> count 2. Pray with a logged user (Authorization) counts once separately. (5) Non-admin user hitting /api/admin/prayers -> 403; no token -> 401. (6) DELETE admin prayer removes it and its pray marks. Clean up any test rows you create. Frontend: verify prayer.tsx visibility radios + conditional name; /prayer-board list + Sto pregando disables after tap + counter increments; Home 'Bacheca' card navigates; admin filters switch lists and detail Approva/Archivia/Elimina work."
