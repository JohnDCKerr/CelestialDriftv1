import { useEffect, useMemo, useState } from "react";
import type { SkyTarget } from "../types";
import { formatDec, formatRA } from "../utils/coords";
import { isSaved, removeSaved, saveDestination } from "../utils/storage";
import { BookmarkFilledIcon, BookmarkPlusIcon, ChevronRightIcon, CloseIcon, ShareIcon } from "./icons";
import "./ObjectSheet.css";

interface Props {
  target: SkyTarget;
  open: boolean;
  onClose: () => void;
  onSavedChange: () => void;
}

function distanceLabel(target: SkyTarget): string | null {
  const obj = target.object;
  if (!obj) return null;
  if (typeof obj.distance_mly === "number") {
    return `~${formatNumber(obj.distance_mly)} million light-years away`;
  }
  if (typeof obj.distance_ly === "number") {
    return `~${formatNumber(obj.distance_ly)} light-years away`;
  }
  return null;
}

function formatNumber(n: number): string {
  return n >= 1000 ? n.toLocaleString() : String(n);
}

export default function ObjectSheet({ target, open, onClose, onSavedChange }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  useEffect(() => {
    setSaved(isSaved(target.ra_deg, target.dec_deg));
    setMoreOpen(false);
    setShareNotice(null);
  }, [target.ra_deg, target.dec_deg]);

  const dist = useMemo(() => distanceLabel(target), [target]);

  if (!open) return null;

  const obj = target.object;

  const handleSaveToggle = () => {
    if (saved) {
      const id = `${target.ra_deg.toFixed(4)}:${target.dec_deg.toFixed(4)}`;
      removeSaved(id);
      setSaved(false);
    } else {
      saveDestination(target);
      setSaved(true);
    }
    onSavedChange();
  };

  const handleShare = async () => {
    const text = `${obj?.name ?? "A patch of sky"} — RA ${formatRA(target.ra_deg)}, Dec ${formatDec(
      target.dec_deg
    )} — via Celestial Drift`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard stub
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareNotice("Copied to clipboard");
    } catch {
      setShareNotice(text);
    }
    setTimeout(() => setShareNotice(null), 2200);
  };

  return (
    <div className="cd-sheet-backdrop" onClick={onClose}>
      <div className="cd-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Object information">
        <div className="cd-sheet__handle" />
        <button className="cd-sheet__close" onClick={onClose} aria-label="Close">
          <CloseIcon width={18} height={18} />
        </button>

        <div className="cd-sheet__body">
          {obj ? (
            <>
              <div className="cd-sheet__eyebrow mono">{obj.catalog}</div>
              <h2 className="cd-sheet__title">{obj.name ?? obj.catalog}</h2>
              <div className="cd-sheet__meta">
                {obj.type && <span>{obj.type}</span>}
                {dist && <span>{dist}</span>}
              </div>
              {obj.description && <p className="cd-sheet__desc">{obj.description}</p>}
            </>
          ) : (
            <>
              <div className="cd-sheet__eyebrow mono">Legacy Surveys DR11</div>
              <h2 className="cd-sheet__title">You&rsquo;re here</h2>
              <p className="cd-sheet__desc">
                This point isn&rsquo;t in the curated catalog yet — just a real patch of observed sky.
              </p>
            </>
          )}

          <div className="cd-sheet__where">
            <div className="cd-sheet__where-label mono">WHERE YOU ARE</div>
            <div className="cd-sheet__where-coords mono">
              RA {formatRA(target.ra_deg)} &middot; Dec {formatDec(target.dec_deg)}
            </div>
            {obj?.constellation && <div className="cd-sheet__where-constellation">{obj.constellation}</div>}
          </div>

          <div className="cd-sheet__actions">
            <button className="cd-btn cd-btn--ghost cd-sheet__action" onClick={handleSaveToggle}>
              {saved ? <BookmarkFilledIcon width={16} height={16} /> : <BookmarkPlusIcon width={16} height={16} />}
              {saved ? "SAVED" : "SAVE"}
            </button>
            <button className="cd-btn cd-btn--ghost cd-sheet__action" onClick={handleShare}>
              <ShareIcon width={16} height={16} />
              SHARE
            </button>
          </div>
          {shareNotice && <div className="cd-sheet__share-notice mono">{shareNotice}</div>}

          <button className="cd-sheet__more-toggle" onClick={() => setMoreOpen((v) => !v)}>
            <span>More</span>
            <ChevronRightIcon
              width={16}
              height={16}
              style={{ transform: moreOpen ? "rotate(90deg)" : "none", transition: "transform 160ms ease" }}
            />
          </button>
          {moreOpen && (
            <div className="cd-sheet__more mono">
              <div className="cd-sheet__more-row">
                <span>Layer</span>
                <span>ls-dr11</span>
              </div>
              <div className="cd-sheet__more-row">
                <span>RA (deg)</span>
                <span>{target.ra_deg.toFixed(5)}</span>
              </div>
              <div className="cd-sheet__more-row">
                <span>Dec (deg)</span>
                <span>{target.dec_deg.toFixed(5)}</span>
              </div>
              <a
                className="cd-sheet__more-link"
                href={`https://www.legacysurvey.org/viewer?ra=${target.ra_deg.toFixed(5)}&dec=${target.dec_deg.toFixed(
                  5
                )}&layer=ls-dr11&zoom=14`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Legacy Survey viewer &rarr;
              </a>
              <p className="cd-sheet__more-note">
                Additional technical fields (redshift, angular size, magnitude, alternate IDs) will appear here once
                sourced from a live catalog service — this prototype omits any value it can&rsquo;t verify rather
                than invent one.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
