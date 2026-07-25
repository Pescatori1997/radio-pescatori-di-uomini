# Pescatori di Uomini — PWA su Vercel + dominio radiopescatoridiuomini.it

L'app mobile nativa Expo **resta invariata**. Questo documento riguarda solo la
versione **web (PWA)** esportata e ospitata su Vercel, con backend su Emergent.

## Architettura di produzione
- **Frontend (PWA)**: build web statica di Expo, ospitata su **Vercel** → dominio `radiopescatoridiuomini.it`.
- **Backend (FastAPI + MongoDB)**: deployato tramite il **Full-Stack Deploy di Emergent** (pulsante Publish). Da lì ottieni un **URL pubblico del backend**.
- Il frontend Vercel chiama il backend Emergent via `EXPO_PUBLIC_BACKEND_URL` (le chiamate aggiungono `/api`).

## Passi

### 1) Deploy del backend su Emergent
1. Clicca **Publish** (in alto a destra) → deploy full-stack.
2. Copia l'**URL pubblico del backend** (es. `https://<tuo-app>.emergent.host`). NON aggiungere `/api`.

### 2) Deploy del frontend su Vercel
1. Collega il repo a Vercel.
2. **Root Directory**: `frontend`
3. Build/Install/Output sono già definiti in `frontend/vercel.json`:
   - Install: `yarn install --frozen-lockfile --ignore-scripts`
   - Build: `npx expo export -p web && node scripts/inject-pwa.js`
   - Output: `dist`
4. **Environment Variables** (Production):
   - `EXPO_PUBLIC_BACKEND_URL = https://<url-backend-emergent>` (senza `/api`, senza slash finale)
5. Deploy.

### 3) Dominio personalizzato
1. In Vercel → Project → **Settings → Domains** → aggiungi `radiopescatoridiuomini.it` (e `www`).
2. Configura i record DNS come indicato da Vercel (A/CNAME).
3. HTTPS è automatico (necessario per il service worker / PWA).

## PWA — cosa è incluso
- `public/manifest.json` — nome, icone, tema navy `#0A1128`, `display: standalone`, lingua IT.
- `public/icons/` — icone 192/512 + maskable + apple-touch-icon (generate dal logo).
- `public/sw.js` — service worker: navigazioni network-first (contenuti sempre freschi online),
  asset statici stale-while-revalidate. **NON** intercetta mai richieste cross-origin →
  API backend, streaming AzuraCast, YouTube e Stripe passano sempre dalla rete.
- Injection dei tag `<head>` PWA:
  - **Produzione (Vercel)**: `scripts/inject-pwa.js` inserisce i tag in `dist/index.html`.
  - **Dev/anteprima**: `src/utils/pwa.web.ts` (chiamato da `app/_layout.tsx`) li inietta a runtime (no-op su nativo).

## Integrazioni cross-origin — verificate
- **API**: `EXPO_PUBLIC_BACKEND_URL` + CORS backend (preflight con Origin corretto).
- **AzuraCast**: stream e artwork passano dai proxy backend (`/api/live/stream`, `/api/live/art`).
- **Stripe**: `success_url`/`cancel_url` usano l'origin del frontend (quindi il dominio Vercel).
- **Auth email/password**: Bearer token in header (funziona cross-origin).
- **Google OAuth (Emergent)**: se usato sul web, assicurati che il dominio `radiopescatoridiuomini.it`
  sia consentito nella configurazione OAuth Emergent (redirect).

## Test dell'installabilità
- Chrome/Edge desktop: icona "Installa" nella barra degli indirizzi.
- Android Chrome: menu → "Installa app" / "Aggiungi a schermata Home".
- iOS Safari: Condividi → "Aggiungi a Home".
