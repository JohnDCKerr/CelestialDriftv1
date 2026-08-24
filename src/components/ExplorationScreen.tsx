import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SkyTarget } from "../types";
import {
  DEFAULT_LAYER,
  MAX_CUTOUT_PX,
  buildCutoutUrl,
  cutoutCache,
  cutoutCacheKey,
  preloadImage,
} from "../api/legacySurvey";
import { clampDec, formatDec, formatRA, fovArcmin, wrapRa } from "../utils/coords";
import { useIdle } from "../hooks/useIdle";
import { hasSeenFirstRunHint, markFirstRunHintSeen } from "../utils/storage";
import { CrosshairIcon, LayersIcon, MinusIcon, PlusIcon, WormholeIcon } from "./icons";
import FirstRunHint from "./FirstRunHint";
import "./ExplorationScreen.css";

const MIN_PIXSCALE = 0.05;
const MAX_PIXSCALE = 3.2;
const SETTLE_DEBOUNCE_MS = 480;
// Below this much movement, a gesture is treated as noise (an accidental
// tap or brush) rather than an intentional pan/zoom — no re-fetch happens.
const MIN_COMMIT_PX = 6;
const MIN_COMMIT_SCALE_DELTA = 0.02;
// How long the first-launch intro's zoom-fade into the real sky takes.
const INTRO_EXIT_MS = 900;

// Warp (wormhole) timing: a brief "falling forward" phase, then a blend
// into the new destination. Kept short and elegant, not an arcade effect.
// Wormhole ring-burst overlay: briefly, opaquely covers the screen while
// the real crossfade to the destination happens invisibly underneath, then
// clears to reveal the already-loaded real image. Not real imagery itself —
// purely a transition effect — which is fine; only the actual viewing
// experience (panning/zooming/looking at an object) needs to be real.
const RINGS_DURATION_MS = 850;
const PLAIN_CROSSFADE_MS = 380;
const ARRIVAL_LABEL_MS = 2200;
const HINT_VISIBLE_MS = 3600;

type LoadStatus = "loading" | "ready" | "error";

interface RenderLayer {
  id: number;
  url: string;
  opacity: number;
  transform: string;
  filter: string;
  transitionMs: number;
}

interface Props {
  target: SkyTarget;
  /** Bumped by the parent every time a wormhole jump is triggered, so this component can tell that specific target change apart from an ordinary pan/zoom/jump. */
  warpTick: number;
  onTargetDrift: (next: SkyTarget) => void;
  hudSuppressed: boolean;
  onOpenSheet: () => void;
  onWormhole: () => void;
}

interface PointerState {
  x: number;
  y: number;
}

export default function ExplorationScreen({
  target,
  warpTick,
  onTargetDrift,
  hudSuppressed,
  onOpenSheet,
  onWormhole,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: 512, h: 512 });
  const [status, setStatus] = useState<LoadStatus>("loading");
  // Only appears if a fetch takes noticeably long — most loads resolve well
  // before this fires and the user never sees it. This is the "absolutely
  // necessary" exception to the no-spinners design goal: with zero feedback
  // at all, a genuinely slow Legacy Survey response (their cutout endpoint
  // generates images on demand and can be slow under load) just looks like
  // the app is frozen or broken, which is worse than a small honest hint
  // that it's still working.
  const [slowLoad, setSlowLoad] = useState(false);
  const slowLoadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- First-launch intro: spins while the very first image loads, then
  // shrinks/fades away as that image zoom-fades in underneath it. ---
  const [introPhase, setIntroPhase] = useState<"spinning" | "exiting" | "done">("spinning");
  const introTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [layers, setLayers] = useState<RenderLayer[]>([]);
  const [arrivalLabel, setArrivalLabel] = useState<string | null>(null);
  const [warpRingsVisible, setWarpRingsVisible] = useState(false);
  const ringsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live gesture transform — applied to the whole layer stack together while
  // actively dragging/pinching, so old + incoming imagery pan in unison.
  const [liveTransform, setLiveTransform] = useState({ tx: 0, ty: 0, scale: 1 });
  const [isGesturing, setIsGesturing] = useState(false);

  const pointers = useRef<Map<number, PointerState>>(new Map());
  const gestureStart = useRef<{ dist: number } | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedPixscale = useRef(target.pixscale);
  const nextLayerId = useRef(0);
  const activeTransitionId = useRef(0);
  const lastWarpTick = useRef(warpTick);
  const arrivalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const idle = useIdle(3200);
  const chromeHidden = idle && !hudSuppressed;

  // --- Opening-screen auto-drift: only ever active before the first-ever
  // interaction of the session, and only on real, already-loaded imagery
  // (no fake motion, no synthetic starfield — see conversation notes). It
  // stops permanently the moment the person touches, scrolls, or taps
  // anything, and never resumes for the rest of the session.
  const [autoDrift, setAutoDrift] = useState(true);
  const stopAutoDrift = useCallback(() => setAutoDrift(false), []);
  useEffect(() => {
    if (warpTick !== lastWarpTick.current) stopAutoDrift();
  }, [warpTick, stopAutoDrift]);
  useEffect(() => {
    if (hudSuppressed) stopAutoDrift();
  }, [hudSuppressed, stopAutoDrift]);

  // --- First-run hint (once, ever) ---
  const [hintVisible, setHintVisible] = useState(false);
  const hintEligible = useRef(!hasSeenFirstRunHint());
  const hintShown = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coarsePointer = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches,
    []
  );

  const dismissHint = useCallback(() => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHintVisible(false);
    markFirstRunHintSeen();
    hintEligible.current = false;
  }, []);

  // Track container size so cutout requests roughly match viewport (capped at service limit).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setViewportSize({
        w: Math.max(64, Math.min(MAX_CUTOUT_PX, Math.round(rect.width))),
        h: Math.max(64, Math.min(MAX_CUTOUT_PX, Math.round(rect.height))),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Belt-and-suspenders defense against native pinch-zoom fighting with our
  // own custom pinch handling. `touch-action: none` (see .cd-explore in the
  // CSS) should already prevent this, but some iOS Safari versions honor
  // that inconsistently for accessibility reasons — a native, non-passive
  // touchmove listener that blocks multi-touch gestures is more reliable.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const blockMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    el.addEventListener("touchmove", blockMultiTouch, { passive: false });
    return () => el.removeEventListener("touchmove", blockMultiTouch);
  }, []);

  const requestKey = `${target.ra_deg.toFixed(4)}:${target.dec_deg.toFixed(4)}:${target.pixscale.toFixed(3)}`;

  // Cross-fade the incoming image in over the outgoing one, rather than a
  // hard swap.
  // Every async step below (both animation frames, and the cleanup timeout)
  // is guarded against `activeTransitionId`. Without this, firing two
  // transitions in quick succession (e.g. tapping zoom twice, or panning
  // then immediately zooming) could let an older, in-flight transition's
  // delayed cleanup step run *after* a newer one had already taken over —
  // wiping out the newer image mid-fade and causing a visible flicker/glitch.
  // Only the most recently started transition is ever allowed to touch state.
  //
  // Wormhole no longer gets special treatment here — the green ring overlay
  // (see warpRingsVisible below) handles the "falling through space" feel by
  // briefly covering the screen while this same plain crossfade runs
  // invisibly underneath, so by the time the rings clear, the destination
  // is already sitting there correctly loaded.
  const runTransition = useCallback((url: string) => {
    const incomingId = ++nextLayerId.current;
    activeTransitionId.current = incomingId;

    setLayers((prev) => [
      ...prev,
      { id: incomingId, url, opacity: 0, transform: "scale(1)", filter: "blur(0px)", transitionMs: 0 },
    ]);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (activeTransitionId.current !== incomingId) return;
        setLayers((prev) =>
          prev.map((l) =>
            l.id === incomingId
              ? { ...l, opacity: 1, transitionMs: PLAIN_CROSSFADE_MS }
              : { ...l, opacity: 0, transitionMs: PLAIN_CROSSFADE_MS }
          )
        );
        // Reset the shared gesture wrapper back to identity now, in sync
        // with the crossfade starting — NOT earlier (that would snap the
        // still-visible old image back to center before the new one is
        // even ready) and not later (that would pop after the crossfade
        // already finished). The wrapper's own transition eases this
        // smoothly rather than jumping, since we're not actively gesturing
        // at this point.
        setLiveTransform({ tx: 0, ty: 0, scale: 1 });
      });
    });

    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => {
      if (activeTransitionId.current !== incomingId) return;
      setLayers((prev) => prev.filter((l) => l.id === incomingId).map((l) => ({ ...l, transitionMs: 0 })));
      setStatus("ready");
    }, PLAIN_CROSSFADE_MS + 40);
  }, []);

  // Load imagery whenever the committed target changes (new jump, wormhole, or a settled pan/zoom).
  useEffect(() => {
    let cancelled = false;
    accumulatedPixscale.current = target.pixscale;

    const isWarp = warpTick !== lastWarpTick.current;
    lastWarpTick.current = warpTick;
    const arrivalName = target.object?.name ?? null;

    if (isWarp) {
      if (ringsTimer.current) clearTimeout(ringsTimer.current);
      if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
      setWarpRingsVisible(true);
      ringsTimer.current = setTimeout(() => {
        setWarpRingsVisible(false);
        setArrivalLabel(arrivalName);
        arrivalTimer.current = setTimeout(() => setArrivalLabel(null), ARRIVAL_LABEL_MS);
      }, RINGS_DURATION_MS);
    }

    const key = cutoutCacheKey(target.ra_deg, target.dec_deg, target.pixscale);
    const cached = cutoutCache.get(key);

    const url = buildCutoutUrl({
      ra: target.ra_deg,
      dec: target.dec_deg,
      pixscale: target.pixscale,
      width: viewportSize.w,
      height: viewportSize.h,
      layer: DEFAULT_LAYER,
    });

    const applyFirstEver = (u: string) => {
      const id = ++nextLayerId.current;
      activeTransitionId.current = id;
      // The very first image ever shown gets a proper intro: starts hidden,
      // slightly zoomed and soft, then eases in as the spinning intro
      // overlay (rendered separately, see introPhase) shrinks and fades
      // away — a single "zoom-fade into the sky" moment rather than the
      // image just abruptly appearing.
      setLayers([{ id, url: u, opacity: 0, transform: "scale(1.1)", filter: "blur(12px)", transitionMs: 0 }]);
      setLiveTransform({ tx: 0, ty: 0, scale: 1 });
      setIntroPhase("exiting");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (activeTransitionId.current !== id) return;
          setLayers((prev) =>
            prev.map((l) =>
              l.id === id ? { ...l, opacity: 1, transform: "scale(1)", filter: "blur(0px)", transitionMs: INTRO_EXIT_MS } : l
            )
          );
        });
      });

      if (introTimer.current) clearTimeout(introTimer.current);
      introTimer.current = setTimeout(() => {
        if (activeTransitionId.current !== id) return;
        setIntroPhase("done");
      }, INTRO_EXIT_MS);

      setStatus("ready");
      if (hintEligible.current && !hintShown.current) {
        hintShown.current = true;
        setHintVisible(true);
        hintTimer.current = setTimeout(() => {
          setHintVisible(false);
          markFirstRunHintSeen();
          hintEligible.current = false;
        }, HINT_VISIBLE_MS);
      }
    };

    if (cached) {
      if (layers.length === 0) {
        applyFirstEver(cached);
      } else {
        setStatus("ready");
        runTransition(cached);
      }
      return;
    }

    // Only the very first image ever shown blocks on a loading state — every
    // subsequent load keeps showing existing imagery (frozen/transformed)
    // rather than interrupting with a spinner, unless it's taking a while
    // (see slowLoad above).
    if (layers.length === 0) setStatus("loading");

    if (slowLoadTimer.current) clearTimeout(slowLoadTimer.current);
    setSlowLoad(false);
    slowLoadTimer.current = setTimeout(() => setSlowLoad(true), 650);

    const { promise, cancel } = preloadImage(url);
    promise.then((ok) => {
      if (cancelled) return;
      if (slowLoadTimer.current) clearTimeout(slowLoadTimer.current);
      setSlowLoad(false);
      if (ok) {
        cutoutCache.set(key, url);
        if (layers.length === 0) {
          applyFirstEver(url);
        } else {
          setStatus("ready");
          runTransition(url);
        }
      } else {
        setStatus("error");
        if (layers.length === 0) setIntroPhase("done");
      }
    });

    return () => {
      cancelled = true;
      cancel();
      if (slowLoadTimer.current) clearTimeout(slowLoadTimer.current);
      setSlowLoad(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, viewportSize.w, viewportSize.h, warpTick]);

  const commitDrift = useCallback(
    (dxPx: number, dyPx: number, scaleFactor: number) => {
      const pixscale = clampPixscale(accumulatedPixscale.current / scaleFactor);
      const decRad = (target.dec_deg * Math.PI) / 180;
      const arcsecPerPx = accumulatedPixscale.current;
      const dRaDeg = -((dxPx * arcsecPerPx) / 3600) / Math.max(0.15, Math.cos(decRad));
      const dDecDeg = -((dyPx * arcsecPerPx) / 3600);

      const moved = Math.abs(dxPx) > 1 || Math.abs(dyPx) > 1;
      const newRa = wrapRa(target.ra_deg + dRaDeg);
      const newDec = clampDec(target.dec_deg + dDecDeg);

      onTargetDrift({
        ra_deg: newRa,
        dec_deg: newDec,
        pixscale,
        object: moved ? undefined : target.object,
      });
    },
    [target, onTargetDrift]
  );

  // The instant a gesture ends, freeze exactly what's currently on screen
  // into the (still-visible, about-to-be-replaced) image layer's own
  // transform, then silently reset the shared wrapper to identity — in the
  // same tick, so nothing visibly moves. This is what lets the eventual
  // crossfade be a clean, motionless fade (old fades out exactly where it
  // was, new fades in already centered) instead of a confusing "re-center
  // AND change picture at once" once the new image finally arrives, which
  // is what was reading as unsmooth / disorienting before.
  //
  // Uses the same visual clamp as rendering (never below scale 1) so what
  // gets frozen exactly matches what was actually on screen — using the
  // true unclamped scale here would cause a visible pop at release.
  // Freezes exactly what's on screen into the (about-to-be-replaced) image
  // layer's own transform, without touching liveTransform — callers decide
  // separately how/when to reset the wrapper, since the pointer-gesture and
  // wheel-gesture paths need to do that reset differently (see below).
  const freezeLayers = useCallback((tx: number, ty: number, scale: number) => {
    const visualScale = Math.max(1, scale);
    setLayers((prev) =>
      prev.map((l) => ({
        ...l,
        transform: `translate(${tx}px, ${ty}px) scale(${visualScale})`,
        transitionMs: 0,
      }))
    );
  }, []);

  const freezeAndResetWrapper = useCallback(
    (tx: number, ty: number, scale: number) => {
      freezeLayers(tx, ty, scale);
      setLiveTransform({ tx: 0, ty: 0, scale: 1 });
    },
    [freezeLayers]
  );

  // --- Pointer (mouse + touch) handling: 1 finger pans, 2 fingers pinch-zoom ---
  const onPointerDown = (e: React.PointerEvent) => {
    if (hintVisible) dismissHint();
    if (autoDrift) stopAutoDrift();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setIsGesturing(true);

    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      gestureStart.current = { dist: distanceBetween(pts[0], pts[1]) };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setLiveTransform((t) => ({ ...t, tx: t.tx + dx, ty: t.ty + dy }));
    } else if (pointers.current.size === 2 && gestureStart.current) {
      const pts = Array.from(pointers.current.values());
      const dist = distanceBetween(pts[0], pts[1]);
      const scale = clampScale(dist / (gestureStart.current.dist || dist));
      setLiveTransform((t) => ({ ...t, scale }));
    }
  };

  const endGesture = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);

    if (pointers.current.size === 0) {
      setIsGesturing(false);
      gestureStart.current = null;
      const { tx, ty, scale } = liveTransform;

      // A tap or barely-there touch shouldn't trigger a real re-fetch at
      // all. Below this threshold, treat it as noise and just reset —
      // otherwise even an accidental micro-nudge forces a brand new
      // coordinate lookup, and if you happen to be sitting near the edge
      // of the survey's actual coverage, that tiny nudge alone can be
      // enough to land just outside it and show the empty-coverage state.
      const negligible = Math.abs(tx) < MIN_COMMIT_PX && Math.abs(ty) < MIN_COMMIT_PX && Math.abs(scale - 1) < MIN_COMMIT_SCALE_DELTA;

      if (negligible) {
        setLiveTransform({ tx: 0, ty: 0, scale: 1 });
        return;
      }

      freezeAndResetWrapper(tx, ty, scale);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => commitDrift(-tx, -ty, scale), 60);
    }
  };

  // --- Wheel (desktop) zoom ---
  const onWheel = (e: React.WheelEvent) => {
    if (hintVisible) dismissHint();
    if (autoDrift) stopAutoDrift();
    e.preventDefault();
    const delta = -e.deltaY;
    const scale = clampScale(1 + delta * 0.0018);
    setLiveTransform((t) => ({ ...t, scale: clampScale(t.scale * scale) }));
    setIsGesturing(true);
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => {
      setIsGesturing(false);
      setLiveTransform((t) => {
        const negligible =
          Math.abs(t.tx) < MIN_COMMIT_PX && Math.abs(t.ty) < MIN_COMMIT_PX && Math.abs(t.scale - 1) < MIN_COMMIT_SCALE_DELTA;
        if (negligible) return { tx: 0, ty: 0, scale: 1 };
        freezeLayers(t.tx, t.ty, t.scale);
        commitDrift(-t.tx, -t.ty, t.scale);
        return { tx: 0, ty: 0, scale: 1 };
      });
    }, SETTLE_DEBOUNCE_MS);
  };

  const stepZoom = (factor: number) => {
    commitDrift(0, 0, factor);
  };

  const handleRetry = () => {
    setStatus("loading");
    const url = buildCutoutUrl({
      ra: target.ra_deg,
      dec: target.dec_deg,
      pixscale: target.pixscale,
      width: viewportSize.w,
      height: viewportSize.h,
    });
    preloadImage(url).promise.then((ok) => {
      if (!ok) {
        setStatus("error");
        return;
      }
      if (layers.length === 0) {
        const id = ++nextLayerId.current;
        activeTransitionId.current = id;
        setLayers([{ id, url, opacity: 1, transform: "scale(1)", filter: "blur(0px)", transitionMs: 0 }]);
        setLiveTransform({ tx: 0, ty: 0, scale: 1 });
        setStatus("ready");
      } else {
        setStatus("ready");
        runTransition(url);
      }
    });
  };

  const fov = useMemo(
    () => fovArcmin(target.pixscale, Math.min(viewportSize.w, viewportSize.h)),
    [target.pixscale, viewportSize]
  );

  // Slight (60ms) smoothing on the shared gesture transform — softens jitter
  // without adding perceptible input lag — plus a gentler ease once a
  // gesture settles back toward the frame.
  //
  // The VISUAL scale is clamped to never go below 1 — pinching in (zoom
  // out) still tracks the real, unclamped intent (liveTransform.scale) for
  // computing the correct wider pixscale on release, but visually shrinking
  // the one already-loaded flat image below full-frame size would just
  // reveal black around it, since there's no more real sky data beyond its
  // edges to "zoom out into." A genuinely wider view arrives properly (with
  // real imagery, crossfaded in) once the gesture settles and a fresh,
  // wider-FOV cutout is fetched.
  const wrapTransition = isGesturing ? "transform 60ms linear" : "transform 260ms cubic-bezier(0.2, 0.7, 0.2, 1)";
  const visualScale = Math.max(1, liveTransform.scale);
  const wrapStyle: React.CSSProperties = {
    transform: `translate(${liveTransform.tx}px, ${liveTransform.ty}px) scale(${visualScale})`,
    transition: wrapTransition,
  };

  return (
    <div
      ref={containerRef}
      className="cd-explore"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onPointerLeave={endGesture}
      onWheel={onWheel}
    >
      <div className="cd-explore__imagewrap" style={wrapStyle}>
        <div className={`cd-explore__autodrift ${autoDrift ? "is-drifting" : ""}`}>
          {layers.map((l) => (
            <img
              key={l.id}
              src={l.url}
              alt={target.object?.name ?? "Real-sky survey imagery"}
              className="cd-explore__layer"
              draggable={false}
              style={{
                opacity: l.opacity,
                transform: l.transform,
                filter: l.filter,
                transition: `opacity ${l.transitionMs}ms linear, transform ${l.transitionMs}ms ease-out, filter ${l.transitionMs}ms ease-out`,
              }}
            />
          ))}
        </div>
      </div>

      {introPhase !== "done" && (
        <div className={`cd-intro ${introPhase === "exiting" ? "is-exiting" : ""}`} aria-hidden="true">
          <div className="cd-intro__spinner">
            <span />
            <span />
          </div>
          <div className="cd-intro__title">CELESTIAL DRIFT</div>
          <div className="cd-intro__tagline">FLOAT THE COSMOS.</div>
        </div>
      )}

      {slowLoad && layers.length > 0 && status !== "error" && (
        <div className="cd-slowload" aria-hidden="true">
          <span />
        </div>
      )}

      {status === "error" && (
        <div className="cd-explore__error">
          <p className="cd-explore__error-title">Nothing useful at this coordinate</p>
          <p className="cd-explore__error-body mono">
            This patch isn&rsquo;t giving us a clean Legacy Survey view.
          </p>
          <div className="cd-explore__error-actions">
            <button className="cd-btn cd-btn--ghost" onClick={handleRetry}>
              TRY AGAIN
            </button>
            <button className="cd-btn cd-btn--yellow" onClick={onWormhole}>
              <WormholeIcon width={16} height={16} /> WORMHOLE
            </button>
          </div>
        </div>
      )}

      <FirstRunHint visible={hintVisible} coarsePointer={!!coarsePointer} />

      {warpRingsVisible && (
        <div className="cd-warp-rings" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <div className="cd-warp-rings__text">Onward!</div>
        </div>
      )}

      {arrivalLabel && (
        <div className="cd-arrival" aria-live="polite">
          {arrivalLabel}
        </div>
      )}

      {/* Crosshair — quiet, doesn't dominate the center */}
      <button
        className={`cd-crosshair ${chromeHidden ? "is-hidden" : ""}`}
        onClick={onOpenSheet}
        aria-label="What am I looking at?"
      >
        <CrosshairIcon width={18} height={18} />
      </button>

      {/* Top HUD: tiny, secondary — fades away entirely when idle */}
      <div className={`cd-hud-top ${chromeHidden ? "is-hidden" : ""}`}>
        <div className="cd-hud-top__coords mono">
          {formatRA(target.ra_deg)} &nbsp;{formatDec(target.dec_deg)}
          {target.object?.constellation && <>&nbsp;&middot;&nbsp;{target.object.constellation}</>}
        </div>
      </div>

      {/* Zoom controls */}
      <div className={`cd-zoom ${chromeHidden ? "is-hidden" : ""}`}>
        <button className="cd-zoom__btn" onClick={() => stepZoom(1.4)} aria-label="Zoom in">
          <PlusIcon width={16} height={16} />
        </button>
        <button className="cd-zoom__btn" onClick={() => stepZoom(1 / 1.4)} aria-label="Zoom out">
          <MinusIcon width={16} height={16} />
        </button>
      </div>

      {/* Bottom-left: layer + attribution — required credit, kept minimal */}
      <div className={`cd-attribution ${chromeHidden ? "is-hidden" : ""}`}>
        <div className="cd-attribution__layer mono">
          <LayersIcon width={11} height={11} /> Legacy Survey &middot; FOV {fov.toFixed(1)}&prime;
        </div>
      </div>
    </div>
  );
}

function distanceBetween(a: PointerState, b: PointerState) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampScale(scale: number) {
  return Math.max(0.4, Math.min(2.5, scale));
}

function clampPixscale(v: number) {
  return Math.max(MIN_PIXSCALE, Math.min(MAX_PIXSCALE, v));
}
