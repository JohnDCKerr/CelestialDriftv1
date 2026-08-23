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
import { CrosshairIcon, LayersIcon, MinusIcon, PlusIcon, WormholeIcon } from "./icons";
import "./ExplorationScreen.css";

const MIN_PIXSCALE = 0.05;
const MAX_PIXSCALE = 3.2;
const SETTLE_DEBOUNCE_MS = 480;

type LoadStatus = "loading" | "ready" | "error";

interface Props {
  target: SkyTarget;
  onTargetDrift: (next: SkyTarget) => void;
  hudSuppressed: boolean;
  onOpenSheet: () => void;
  onWormhole: () => void;
}

interface PointerState {
  x: number;
  y: number;
}

export default function ExplorationScreen({ target, onTargetDrift, hudSuppressed, onOpenSheet, onWormhole }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: 512, h: 512 });
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);

  // Live gesture transform applied to the frozen image while panning/zooming.
  const [liveTransform, setLiveTransform] = useState({ tx: 0, ty: 0, scale: 1 });
  const [isGesturing, setIsGesturing] = useState(false);

  const pointers = useRef<Map<number, PointerState>>(new Map());
  const gestureStart = useRef<{ tx: number; ty: number; dist: number; midX: number; midY: number } | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedPixscale = useRef(target.pixscale);

  const idle = useIdle(3800);
  const chromeHidden = idle && !hudSuppressed;

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

  const requestKey = `${target.ra_deg.toFixed(4)}:${target.dec_deg.toFixed(4)}:${target.pixscale.toFixed(3)}`;

  // Load imagery whenever the committed target changes (new jump, or a settled pan/zoom).
  useEffect(() => {
    let cancelled = false;
    accumulatedPixscale.current = target.pixscale;

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

    if (cached) {
      setDisplayUrl(cached);
      setStatus("ready");
      // Reset the gesture transform in the same tick as the swap, so the
      // view holds its dragged/zoomed position right up until the freshly
      // centered image is actually on screen — no premature snap-back.
      setLiveTransform({ tx: 0, ty: 0, scale: 1 });
      return;
    }

    setStatus("loading");
    preloadImage(url).then((ok) => {
      if (cancelled) return;
      if (ok) {
        cutoutCache.set(key, url);
        setDisplayUrl(url);
        setStatus("ready");
        setLiveTransform({ tx: 0, ty: 0, scale: 1 });
      } else {
        setStatus("error");
        setLiveTransform({ tx: 0, ty: 0, scale: 1 });
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, viewportSize.w, viewportSize.h]);

  const commitDrift = useCallback(
    (dxPx: number, dyPx: number, scaleFactor: number) => {
      const pixscale = clampPixscale(accumulatedPixscale.current / scaleFactor);
      const decRad = (target.dec_deg * Math.PI) / 180;
      const arcsecPerPx = accumulatedPixscale.current;
      const dRaDeg = -((dxPx * arcsecPerPx) / 3600) / Math.max(0.15, Math.cos(decRad));
      const dDecDeg = (dyPx * arcsecPerPx) / 3600;

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

  // --- Pointer (mouse + touch) handling: 1 finger pans, 2 fingers pinch-zoom ---
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setIsGesturing(true);

    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      gestureStart.current = {
        tx: liveTransform.tx,
        ty: liveTransform.ty,
        dist: distanceBetween(pts[0], pts[1]),
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
      };
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
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => commitDrift(-tx, -ty, scale), 60);
    }
  };

  // --- Wheel (desktop) zoom ---
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const scale = clampScale(1 + delta * 0.0018);
    setLiveTransform((t) => ({ ...t, scale: clampScale(t.scale * scale) }));
    setIsGesturing(true);
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => {
      setIsGesturing(false);
      setLiveTransform((t) => {
        commitDrift(0, 0, t.scale);
        return t;
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
    preloadImage(url).then((ok) => setStatus(ok ? "ready" : "error"));
  };

  const fov = useMemo(
    () => fovArcmin(target.pixscale, Math.min(viewportSize.w, viewportSize.h)),
    [target.pixscale, viewportSize]
  );

  const transformStyle = {
    transform: `translate(${liveTransform.tx}px, ${liveTransform.ty}px) scale(${liveTransform.scale})`,
    transition: isGesturing ? "none" : "transform 220ms ease-out",
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
      <div className="cd-explore__imagewrap" style={transformStyle}>
        {displayUrl && (
          <img
            src={displayUrl}
            alt={target.object?.name ?? "Real-sky survey imagery"}
            className="cd-explore__image"
            draggable={false}
          />
        )}
      </div>

      {status === "loading" && (
        <div className="cd-explore__loading">
          <div className="cd-explore__loading-pulse" />
          <span className="mono">Acquiring survey image&hellip;</span>
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

      {/* Crosshair / target marker */}
      <button
        className={`cd-crosshair ${chromeHidden ? "is-hidden" : ""}`}
        onClick={onOpenSheet}
        aria-label="What am I looking at?"
      >
        <CrosshairIcon width={30} height={30} />
      </button>

      {/* Top HUD: RA/Dec + region */}
      <div className={`cd-hud-top ${chromeHidden ? "is-hidden" : ""}`}>
        <div className="cd-hud-top__brand">
          <span className="cd-hud-top__title">CELESTIAL DRIFT</span>
          <span className="cd-hud-top__tagline mono">FLOAT THE COSMOS.</span>
        </div>
        <div className="cd-hud-top__coords mono">
          RA {formatRA(target.ra_deg)} &nbsp;DEC {formatDec(target.dec_deg)}
          {target.object?.constellation && (
            <>
              {" "}
              &nbsp;&middot;&nbsp;{target.object.constellation.toUpperCase()}
            </>
          )}
        </div>
      </div>

      {/* Zoom controls */}
      <div className={`cd-zoom ${chromeHidden ? "is-hidden" : ""}`}>
        <button className="cd-zoom__btn" onClick={() => stepZoom(1.4)} aria-label="Zoom in">
          <PlusIcon width={18} height={18} />
        </button>
        <button className="cd-zoom__btn" onClick={() => stepZoom(1 / 1.4)} aria-label="Zoom out">
          <MinusIcon width={18} height={18} />
        </button>
      </div>

      {/* Bottom-left: layer + attribution */}
      <div className={`cd-attribution ${chromeHidden ? "is-hidden" : ""}`}>
        <div className="cd-attribution__layer mono">
          <LayersIcon width={14} height={14} /> Legacy Survey layer &middot; FOV {fov.toFixed(1)}&prime;
        </div>
        <div className="cd-attribution__credit mono">Legacy Surveys / D. Lang (Perimeter Institute)</div>
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
