# PWA Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PWA support with offline schedule viewing, native install prompt, and update notifications.

**Architecture:** `vite-plugin-pwa` with `generateSW` strategy. Workbox auto-generates SW with precaching + runtime caching for API GET endpoints. Icons generated from `favicon.svg` via `@vite-pwa/assets-generator`.

**Tech Stack:** Vite 8, React 19, TypeScript 5.9, yarn workspaces.

## Global Constraints

- All code, documentation, and tests in **English**; communication in French.
- yarn workspaces: run commands as `yarn workspace @planning-espoir/webapp <script>` from repo root.
- Lint enforces Prettier (`prettier/prettier: error`); run `yarn format` if lint fails on style.
- No Redux changes needed — PWA is self-contained in components.
- French UI copy for toast messages.

---

### Task 1: Add PWA Dependencies

**Files:**

- Modify: `webapp/package.json`

**Steps:**

- [ ] Add to `devDependencies`:
  - `vite-plugin-pwa@^0.21.1`
  - `@vite-pwa/assets-generator@^1.0.0`
- [ ] Run `yarn install` from repo root

**Commit:**

```bash
git add webapp/package.json
git commit -m "feat(webapp): add vite-plugin-pwa and assets-generator dependencies"
```

---

### Task 2: Configure Vite PWA Plugin

**Files:**

- Modify: `webapp/vite.config.ts`

**Steps:**

- [ ] Import `VitePWA` from `vite-plugin-pwa`
- [ ] Add plugin configuration:
  - `registerType: 'autoUpdate'`
  - `manifest` with name, short_name, description, theme_color `#334155`, background_color `#f8fafc`, display `standalone`, scope `/`, start_url `/`
  - `workbox.runtimeCaching` for API GET endpoints (NetworkFirst, 10s timeout, 24h expiry, max 16 entries)
  - `pwaAssets: { disabled: false, config: { preset: 'minimal-2023' } }` (or use default preset)
- [ ] Keep existing `react()`, `tailwindcss()`, proxy config

**Commit:**

```bash
git add webapp/vite.config.ts
git commit -m "feat(webapp): configure VitePWA plugin with manifest and runtime caching"
```

---

### Task 3: Create Placeholder Icon

**Files:**

- Create: `webapp/public/favicon.svg`

**Steps:**

- [ ] Create simple SVG icon (calendar/planning themed, 32x32 viewBox, Slate-700 color)
- [ ] Will be used by assets-generator for all icon sizes + maskable + Apple splash

**Commit:**

```bash
git add webapp/public/favicon.svg
git commit -m "feat(webapp): add placeholder favicon.svg for PWA icon generation"
```

---

### Task 4: Create PWA Update Prompt Component

**Files:**

- Create: `webapp/src/components/PWAUpdatePrompt.tsx`

**Steps:**

- [ ] Import `useRegisterSW` from `virtual:pwa-register/react`
- [ ] State: `offlineReady`, `needRefresh` (from hook)
- [ ] Toast UI (Tailwind): fixed bottom-right, slate background, rounded shadow
- [ ] Messages (French):
  - `offlineReady`: "Application prête pour une utilisation hors ligne"
  - `needRefresh`: "Nouveau contenu disponible, cliquez sur Recharger pour mettre à jour."
- [ ] Buttons: "Recharger" (calls `updateServiceWorker(true)`), "Fermer" (dismisses)
- [ ] Periodic update check: `onRegistered(r) { if (r) setInterval(() => r.update(), 60*60*1000) }`
- [ ] Accessibility: `role="status"`, `aria-live="polite"`

**Commit:**

```bash
git add webapp/src/components/PWAUpdatePrompt.tsx
git commit -m "feat(webapp): add PWAUpdatePrompt component for offline/update notifications"
```

---

### Task 5: Integrate PWAUpdatePrompt in App

**Files:**

- Modify: `webapp/src/App.tsx`

**Steps:**

- [ ] Import `PWAUpdatePrompt` from `./components/PWAUpdatePrompt`
- [ ] Add `<PWAUpdatePrompt />` at end of main content (before `</main>` or as sibling)
- [ ] No Redux connection needed

**Commit:**

```bash
git add webapp/src/App.tsx
git commit -m "feat(webapp): integrate PWAUpdatePrompt in App"
```

---

### Task 6: Update nginx Configuration

**Files:**

- Modify: `webapp/nginx.conf`

**Steps:**

- [ ] Add `add_header Service-Worker-Allowed "/";` in `server` block
- [ ] Ensures SW controls entire origin (not just `/webapp/` path)

**Commit:**

```bash
git add webapp/nginx.conf
git commit -m "feat(webapp): add Service-Worker-Allowed header in nginx"
```

---

### Task 7: Build and Verify

**Steps:**

- [ ] Run `yarn build` from repo root
- [ ] Verify `webapp/dist/` contains:
  - `manifest.webmanifest`
  - `sw.js` (or `sw.js.gz`)
  - `workbox-*.js`
  - Icons in `assets/` or root
- [ ] Run `yarn workspace @planning-espoir/webapp preview` and test in browser:
  - DevTools → Application → Manifest: shows correct name, icons, display
  - DevTools → Application → Service Workers: SW registered, `skipWaiting` works
  - Offline checkbox → reload → schedule loads from cache
  - Rebuild + reload → "Nouveau contenu disponible" toast appears

**Commit:**

```bash
git add -A
git commit -m "build: PWA assets generated"
```

---

### Task 8: Lint, Typecheck, Tests

**Steps:**

- [ ] Run `yarn lint` — fix any formatting with `yarn format`
- [ ] Run `yarn typecheck`
- [ ] Run `yarn test`
- [ ] All must pass

**Commit:**

```bash
git add -A
git commit -m "chore: lint, typecheck, tests pass"
```

---

## Verification Checklist

- [ ] `yarn build` succeeds
- [ ] `manifest.webmanifest` valid (DevTools → Application → Manifest)
- [ ] `sw.js` registers without errors (DevTools → Console)
- [ ] Offline: schedule loads from cache
- [ ] Update toast appears after rebuild + reload
- [ ] `yarn lint && yarn typecheck && yarn test` all pass
- [ ] Docker build works: `docker compose build webapp`
