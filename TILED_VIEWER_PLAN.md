# Tiled Viewer Plan

**Status: investigated, not implemented this pass.** Per the brief, this
would touch enough of `ExplorationScreen.tsx`'s gesture/rendering pipeline
to count as a real architectural change, and I can't verify runtime
behavior (CORS, exact tiling scheme, mobile performance) from a sandboxed
environment with no network path to the imagery hosts. Rather than ship an
unverified rewrite, this document lays out what I found and a concrete,
low-risk migration path for a future pass.

## Short answer

**Yes — real tiled imagery of this exact survey is available today, free,
with no backend, in a form that works on static hosting like GitHub Pages.**
Two viable sources exist. One is a strong recommendation; the other is a
documented fallback.

---

## Option A (recommended): Aladin Lite + the official DESI Legacy Surveys HiPS

[Aladin Lite](https://github.com/cds-astro/aladin-lite) is a small
JavaScript widget built by CDS (Centre de Données astronomiques de
Strasbourg) specifically for panning/zooming real sky imagery in a browser.
It's the thing observatories and journals actually embed for "explore this
patch of sky" widgets — this is the closest existing tool to what Celestial
Drift already does by hand.

Crucially, CDS already hosts a ready-made HiPS (Hierarchical Progressive
Survey — the tiled format Aladin Lite consumes) built directly from Legacy
Surveys data:

- **Survey ID:** `CDS/P/DESI-Legacy-Surveys/DR10/color`
- **Tile format:** JPEG/PNG, 512px tiles (matches the resolution we already
  use)
- **License:** ODbL-1.0 (open)
- **Hosted at:** `alasky.cds.unistra.fr` (CDS's dedicated tile CDN, not
  legacysurvey.org itself — separate infrastructure, separate rate limits)
- **Coordinate handling:** built in. Aladin Lite takes RA/Dec directly; no
  custom projection math needed on our side.

This is DR10, one release behind the DR11 we currently pull cutouts from.
DR11's only difference is additional southern-sky footprint and an extra
photometric band — every curated destination in this app is well within
the DR9/DR10 footprint already, so this is a non-issue in practice.

### What integration would look like

```js
import A from "https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js";

const aladin = A.aladin('#aladin-target', {
  survey: 'CDS/P/DESI-Legacy-Surveys/DR10/color',
  target: '202.4696 47.19528', // RA/Dec, same values we already store
  fov: 0.3, // degrees — maps roughly to our current pixscale/zoom
  cooFrame: 'ICRS',
  showReticle: false,
  showZoomControl: false,
  showFullscreenControl: false,
  showLayersControl: false,
  showGotoControl: false,
  showFrame: false,
});
```

Aladin Lite ships its own UI chrome (zoom buttons, coordinate readout, a
search box) that would need to be disabled via the options above and
replaced with our own minimal HUD, dock, and object sheet — all of which
stay exactly as they are. Only the imagery-rendering layer changes.

### Honest limitations of this option

- Aladin Lite is a fairly large dependency (~1–2MB) compared to our current
  zero-dependency `<img>`-based approach.
- Its gesture/animation internals are its own — replicating our current
  crossfade/warp feel (item 3 in this pass) on *top* of Aladin Lite's own
  pan/zoom would need either (a) accepting Aladin's native motion feel for
  drifting and layering our wormhole warp effect as an overlay transition
  between two Aladin instances/states, or (b) digging into Aladin Lite's
  camera API to drive the "falling forward" animation ourselves. This is
  the main open design question for a future pass, not a blocker.
- It's one more third-party JS surface to keep an eye on for breaking
  API changes between versions.

---

## Option B (fallback): Leaflet + legacysurvey.org's own tile endpoint

While investigating, I confirmed `legacysurvey.org` itself serves standard
Google/OSM-style XYZ tiles directly — this is what powers their own public
viewer at `viewer.legacysurvey.org`:

```
https://www.legacysurvey.org/viewer/{layer}/{tileset-version}/{z}/{x}/{y}.jpg
```

Confirmed working examples from their own documentation
(`legacysurvey.org/viewer/urls`):

```
https://www.legacysurvey.org/viewer/ls-dr9/1/14/7963/6632.jpg
```

This would use `layer=ls-dr11` (or `ls-dr11-grz`) to match our current
cutout layer exactly, paired with Leaflet (`L.tileLayer`) or OpenLayers
(`ol/source/ImageTile`) — both are lightweight, static-hosting-friendly,
and give full manual control over pan/zoom/gesture handling, so our
existing crossfade and warp logic could largely carry over unchanged.

### Why this is the fallback, not the primary recommendation

The open question is **what coordinate reference system (CRS) the z/x/y
grid uses.** Standard Leaflet/OSM tiles assume Web Mercator (EPSG:3857),
built for a spherical Earth's lat/lon. Sky viewers built on Leaflet
typically need a **custom CRS** (Leaflet supports this via `L.CRS`) to
correctly map RA/Dec onto the tile grid — and legacysurvey.org's exact
scheme isn't documented anywhere I found. Reverse-engineering it would mean
inspecting `viewer.legacysurvey.org`'s own network requests and client-side
math, which needs live browser access I don't have in this sandboxed
environment. This is entirely solvable, just not something I could verify
and ship responsibly sight-unseen.

---

## Recommended migration path (future pass)

1. Prototype Option A in isolation first — it's the lower-risk path since
   RA/Dec-to-tile math is already solved for us.
2. Build a standalone test route/branch with Aladin Lite dropped in,
   confirm it renders our curated destinations correctly and performs
   acceptably on a real mobile device (not just desktop devtools
   emulation).
3. If Aladin Lite's motion feel can't be made to match the current
   drift/warp design language, fall back to investigating Option B's CRS
   question — likely by loading `viewer.legacysurvey.org` in a browser and
   reading its network tab / bundled JS directly.
4. Only once one path is confirmed working end-to-end (including on
   mobile Safari, which has historically been pickier about tile-loading
   performance than Chrome) should `ExplorationScreen.tsx`'s current
   cutout-based rendering be replaced. Until then, the cutout endpoint
   continues to work fine and should stay as the primary implementation.

## What would need to change

- `src/api/legacySurvey.ts` — would gain a tile-URL builder alongside (or
  instead of) the cutout builder.
- `src/components/ExplorationScreen.tsx` — the biggest change. Pan/zoom
  gesture handling would hand off actual camera movement to
  Aladin Lite/Leaflet rather than manually computing RA/Dec deltas from
  drag distance; our custom crossfade-layer system would need to be
  reconciled with whatever native tile-loading/fade behavior the chosen
  library has.
- Everything else — `BottomDock`, `ObjectSheet`, `NGCJumpPanel`,
  `CategoryPanel`, the data files, the wormhole trigger logic in `App.tsx`
  — stays as-is. They all operate on RA/Dec/pixscale values, not on how
  the imagery itself is rendered.
