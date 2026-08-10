# Planning Espoir — PWA Support Design

Date: 2026-08-10
Status: Approved

## Goal

Make the webapp installable as a Progressive Web App (PWA) with offline support for viewing schedules, using the browser's native install prompt.

## Context

- React 19 + Vite SPA, served by nginx in Docker
- API at `/api` proxied to NestJS backend
- Two main data flows: upload Excel (POST), view schedule (GET)
- Tailwind CSS v4, Redux classic reducers

## Non-Goals

- No custom "Add to Home Screen" button (rely on browser native prompt)
- No background sync for uploads (upload requires network)
- No push notifications

## Decisions

### D-1: Use `generateSW` strategy (automatic Workbox SW)

Zero-config approach: `vite-plugin-pwa` auto-generates the service worker with:

- Precaching of all build assets (JS, CSS, fonts, images)
- Runtime caching for API GET endpoints
- Navigation fallback for SPA routing

### D-2: Offline caching strategy

| Resource                             | Strategy       | Config                                 |
| ------------------------------------ | -------------- | -------------------------------------- |
| Static assets (build output)         | `CacheFirst`   | Precached via `__WB_MANIFEST`          |
| `GET /api/planning`                  | `NetworkFirst` | 10s timeout, cache 24h, max 16 entries |
| `GET /api/planning/schedule?month=*` | `NetworkFirst` | 10s timeout, cache 24h, max 16 entries |
| `GET /api/planning/config`           | `NetworkFirst` | 10s timeout, cache 24h, max 16 entries |
| `POST /api/planning/upload`          | `NetworkOnly`  | No caching, requires network           |
| Navigation (`/`)                     | `NetworkFirst` | Fallback to precached `index.html`     |

### D-3: Web App Manifest

```json
{
  "name": "Planning Espoir",
  "short_name": "Planning",
  "description": "Planning de travail pour l'équipe Espoir",
  "theme_color": "#334155",
  "background_color": "#f8fafc",
  "display": "standalone",
  "scope": "/",
  "start_url": "/",
  "icons": [auto-generated from favicon.svg]
}
```

- Theme color: Slate-700 (`#334155`) — matches Tailwind header
- Background color: Slate-50 (`#f8fafc`) — matches app background
- Display: `standalone` — fullscreen, no browser chrome

### D-4: Icons via `@vite-pwa/assets-generator`

- Source: `public/favicon.svg` (simple placeholder SVG)
- Generates: 192x192, 512x512 PNGs + maskable variant + Apple splash screens
- Auto-injects `<link rel="icon">`, `<link rel="apple-touch-icon">`, theme-color meta

### D-5: Update/Offline Prompt

- Component `PWAUpdatePrompt` using `useRegisterSW` from `virtual:pwa-register/react`
- Shows toast: "App ready to work offline" (on first load) or "New content available" (on SW update)
- "Reload" button calls `updateServiceWorker(true)`
- Periodic update check: every hour via `registration.update()`

### D-6: nginx Configuration

Add `Service-Worker-Allowed: /` header so SW controls entire origin.

## Architecture

```
webapp/
├── public/
│   └── favicon.svg              # Source icon for asset generator
├── src/
│   ├── components/
│   │   └── PWAUpdatePrompt.tsx  # Offline/update toast
│   └── App.tsx                  # Includes <PWAUpdatePrompt />
├── vite.config.ts               # VitePWA plugin config
├── package.json                 # + vite-plugin-pwa, @vite-pwa/assets-generator
└── nginx.conf                   # + Service-Worker-Allowed header
```

## Error Handling

- SW registration failure: logged to console, app works normally
- Cache API failure: falls back to network
- Offline API request: returns cached data or 504 (handled by existing error banners)

## Testing

1. `yarn build` — verify `dist/manifest.webmanifest`, `dist/sw.js`, `dist/workbox-*.js` exist
2. `yarn preview` — test in browser: DevTools → Application → Manifest + Service Workers
3. Offline test: DevTools → Application → Service Workers → Offline → reload → schedule loads
4. Update test: rebuild, reload → "New content available" toast appears

## Docs

- Update `AGENTS.md` if new commands added (none needed)
- No ADR needed (standard PWA implementation)
