# Celestial Drift — MVP

**Float the Cosmos.**

A mobile-first PWA for drifting through real astronomical survey imagery from
the DESI Legacy Imaging Surveys (Legacy Surveys) DR11. No planet finder, no
simulated star maps, no generated space art — every image on screen is a
real cutout requested live from `legacysurvey.org`.

## Running it locally

Requires Node 18+.

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`) on your
phone (same Wi-Fi, using the "Network" URL Vite prints) or in a desktop
browser with device toolbar / narrow window for the intended mobile-first
layout.

To build a static production bundle (e.g. to deploy to GitHub Pages,
Netlify, Vercel, etc.):

```bash
npm run build
npm run preview   # serves the built dist/ folder locally to sanity-check it
```

`dist/` is a fully static site — no backend required.

## What you can do in this build

1. Open the app — it drops you straight into a real Legacy Survey cutout of
   the Whirlpool Galaxy (M51), no onboarding.
2. Drag to pan, pinch (touch) or scroll-wheel (desktop) to zoom.
3. Watch RA/Dec update live in the top HUD as you move.
4. Tap the center crosshair to open the object info sheet.
5. Tap **NGC** in the dock, enter a catalog number (e.g. `1300`), tap GO.
6. Tap **Wormhole** for a random curated jump with a short warp transition.
7. Tap **Galaxies / Nebulae / Black Holes / Weird** for curated destinations.
8. Tap **SAVE** on the info sheet, then reopen it from **Saved**.
9. If a coordinate has no useful imagery, you'll see a graceful empty state
   with TRY AGAIN / WORMHOLE — never a fake or generated image.

## Putting this on GitHub

This is a normal repo — nothing special needed. `.gitignore` already
excludes `node_modules` and `dist`.

```bash
cd celestial-drift
git init
git add .
git commit -m "Celestial Drift MVP"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

(Create the empty repo on GitHub first — either on github.com or with
`gh repo create <repo-name> --public --source=. --push` if you have the
GitHub CLI, which does the create + push in one step.)

### Free live URL via GitHub Pages

A workflow is already included at `.github/workflows/deploy.yml`. Once you
push to `main`:

1. On GitHub, go to **Settings → Pages** and set **Source** to
   **GitHub Actions** (one-time setup).
2. The workflow builds the app and deploys `dist/` automatically on every
   push to `main` — no further steps needed.
3. Your live URL will be `https://<your-username>.github.io/<repo-name>/`.

The workflow sets the Vite base path to match your repo name
automatically (`VITE_BASE: /${{ github.event.repository.name }}/`), so it
works regardless of what you name the repo — no manual editing of
`vite.config.ts` required.

## Files created

```
index.html                          Vite entry HTML, fonts, manifest link
public/favicon.svg                  Custom crosshair mark (no stock assets)
public/manifest.webmanifest         PWA manifest

src/main.tsx                        App bootstrap
src/App.tsx                         Top-level navigation/state owner
src/App.css                         App shell layout
src/types.ts                        Shared TS types (Destination, NgcEntry, SkyTarget, ...)

src/api/legacySurvey.ts             *** The only place that builds a Legacy Survey
                                     request — cutout URL builder + in-memory cache ***

src/components/ExplorationScreen.tsx/.css   Full-screen imagery layer: pan/zoom,
                                             crosshair, HUD, loading/error states
src/components/BottomDock.tsx/.css          7-item bottom navigation
src/components/ObjectSheet.tsx/.css         "What am I looking at?" info sheet
src/components/NGCJumpPanel.tsx/.css        NGC 1–7840 numeric entry + keypad
src/components/CategoryPanel.tsx/.css       Galaxies/Nebulae/Black Holes/Weird/Saved lists
src/components/WormholeOverlay.tsx/.css     Random-jump warp transition
src/components/icons.tsx                    Custom geometric SVG icon set

src/data/destinations.json          29 curated real objects (galaxies, nebulae,
                                     black-hole-related targets, weird objects),
                                     coordinates checked against Wikipedia/live sources
src/data/ngc.json                   64-entry NGC catalog subset for NGC Jump
                                     (architected to swap in the full 1–7840
                                     range later without UI changes)

src/utils/coords.ts                 RA/Dec formatting + wrap/clamp helpers
src/utils/storage.ts                localStorage-backed Saved destinations
src/hooks/useIdle.ts                Drives the "fade HUD when idle" behavior

src/styles/tokens.css               Design tokens (phosphor cyan/green, warm
                                     yellow, near-black, Space Grotesk/IBM Plex Mono)
src/styles/global.css               Resets + base styles
src/styles/shared.css               Shared button/panel primitives
```

## Where the Legacy Survey request happens

**`src/api/legacySurvey.ts`** is the single choke point. `buildCutoutUrl()`
constructs:

```
https://www.legacysurvey.org/viewer/jpeg-cutout?ra={RA}&dec={DEC}&layer=ls-dr11&pixscale={PIXSCALE}&width={W}&height={H}
```

`ExplorationScreen.tsx` calls this on every committed jump/pan/zoom
"settle" event, `preloadImage()`s it before swapping it in (so you never see
a broken image), and caches successful loads in a small in-memory LRU
(`cutoutCache`) keyed by rounded RA/Dec/pixscale so revisiting a recent spot
is instant. Nothing anywhere else in the codebase generates, mocks, or
falls back to synthetic imagery — a failed load always surfaces the
"nothing useful at this coordinate" empty state, never a placeholder image.

## Limits / problems found with the cutout service

- **512px hard cap per dimension.** The endpoint silently caps `width`/
  `height` at 512, so there's no way to request a genuinely high-res cutout
  in one call. `buildCutoutUrl()` clamps to this, and on larger phones/
  desktop the image is upscaled via CSS `object-fit: cover`, which softens
  detail on bigger screens. A tiled-mosaic approach (stitching several
  512px cutouts) would fix this but was out of scope for the MVP per the
  brief.
- **No true continuous pan/zoom.** Because every gesture requires a fresh
  network cutout, real-time streaming pan isn't possible with this endpoint
  alone. The MVP does what the brief suggested: live CSS transform during
  the gesture for immediate visual feedback, then a debounced re-fetch of a
  freshly centered cutout once the gesture settles (~480ms after wheel
  input, ~60ms after pointer release). There's a small visible "pop" when
  the new image swaps in — acceptable for an MVP, but the first thing I'd
  fix with more time (see below).
- **No coverage-check endpoint.** There's no fast way to ask "does this RA/
  Dec have good imagery?" before requesting the JPEG — you only find out by
  requesting it and seeing if it 404s/errors or returns a mostly-empty
  tile. The empty-coverage UI state handles this reactively rather than
  predictively.
- **Footprint gaps near the Galactic plane.** The Legacy Surveys
  intentionally avoid the crowded Galactic plane (roughly |galactic
  latitude| < 18°) and the far southern sky historically had lighter
  coverage pre-DR10/DR11. A few curated/NGC entries (Orion Nebula, Crab
  Nebula) are included anyway with an in-app note that they may render
  poorly on this layer — they're included because they're too iconic to
  leave out of an NGC catalog, and this is a good real-world demonstration
  of the empty-state UX.
- **No CORS restrictions for plain `<img>` display**, which is good news —
  displaying cutouts needs no proxy or backend, only `fetch`/`Image()` for
  the preload-then-cache flow used here.

## Next 5 things I'd build after this MVP

1. **Tiled mosaic viewer.** Replace single 512px cutouts with a proper
   tile-pyramid approach (Legacy Survey also exposes tile endpoints) so pan
   and zoom feel continuous instead of "settle, then reload."
2. **Full NGC 1–7840 dataset.** Swap the curated 64-entry subset for a
   complete, verified NGC/IC coordinate table (e.g. via OpenNGC) — the data
   shape and NGC Jump UI are already built to take this without changes.
3. **Live catalog enrichment.** Pull redshift, magnitude, angular size, and
   alternate IDs from a service like SIMBAD or NED so the object sheet's
   "More" section has real technical data instead of an honest placeholder.
4. **Constellation boundary lookup.** Currently constellation names only
   appear for curated/NGC objects; a real IAU boundary polygon lookup would
   let "You're here" mode name the constellation for any arbitrary point.
5. **Expo/React Native port.** The brief's target platform — the data
   layer, cutout API client, and interaction logic were kept
   framework-light specifically so this port is mostly a UI-layer rewrite,
   not a rearchitecture.
