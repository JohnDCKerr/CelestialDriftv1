import { useMemo, useState } from "react";
import type { NgcEntry, SkyTarget } from "../types";
import { BackspaceIcon, ChevronRightIcon, CloseIcon, WormholeIcon } from "./icons";
import "./NGCJumpPanel.css";

const MIN_NGC = 1;
const MAX_NGC = 7840;

interface Props {
  catalog: NgcEntry[];
  onClose: () => void;
  onJump: (target: SkyTarget) => void;
}

function ngcToTarget(n: NgcEntry): SkyTarget {
  return {
    ra_deg: n.ra_deg,
    dec_deg: n.dec_deg,
    pixscale: 0.4,
    object: {
      name: n.name,
      catalog: `NGC ${n.ngc}`,
      type: n.type,
      constellation: n.constellation,
      distance_mly: n.distance_mly ?? null,
      distance_ly: n.distance_ly ?? null,
      description: n.description ?? null,
    },
  };
}

export default function NGCJumpPanel({ catalog, onClose, onJump }: Props) {
  const [value, setValue] = useState("");
  const [missState, setMissState] = useState(false);

  const index = useMemo(() => {
    const m = new Map<number, NgcEntry>();
    for (const entry of catalog) m.set(entry.ngc, entry);
    return m;
  }, [catalog]);

  const numeric = value ? parseInt(value, 10) : null;
  const inRange = numeric !== null && numeric >= MIN_NGC && numeric <= MAX_NGC;

  const pressDigit = (d: string) => {
    setMissState(false);
    setValue((v) => (v.length >= 4 ? v : v + d));
  };

  const backspace = () => {
    setMissState(false);
    setValue((v) => v.slice(0, -1));
  };

  const go = () => {
    if (!inRange || numeric === null) return;
    const entry = index.get(numeric);
    if (entry) {
      onJump(ngcToTarget(entry));
    } else {
      setMissState(true);
    }
  };

  const surpriseMe = () => {
    const entries = Array.from(index.values());
    const choice = entries[Math.floor(Math.random() * entries.length)];
    onJump(ngcToTarget(choice));
  };

  const tryAnother = () => {
    setValue("");
    setMissState(false);
  };

  return (
    <div className="cd-panel-overlay" onClick={onClose}>
      <div className="cd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cd-panel__header">
          <span className="cd-panel__title">NGC JUMP</span>
          <button className="cd-panel__close" onClick={onClose} aria-label="Close">
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <div className="cd-panel__body cd-ngc">
          {!missState ? (
            <>
              <label className="cd-ngc__label mono" htmlFor="ngc-input">
                Enter NGC {MIN_NGC}&ndash;{MAX_NGC}
              </label>
              <div className="cd-ngc__inputrow">
                <input
                  id="ngc-input"
                  className="cd-ngc__input mono"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={value}
                  placeholder="1300"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setValue(digits);
                    setMissState(false);
                  }}
                  autoFocus
                />
                <button className="cd-ngc__backspace" onClick={backspace} aria-label="Backspace">
                  <BackspaceIcon width={20} height={20} />
                </button>
              </div>

              <div className="cd-ngc__keypad">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "surprise", "0", "go"].map((k) =>
                  k === "go" ? (
                    <button key={k} className="cd-ngc__key cd-ngc__key--go" onClick={go} disabled={!inRange}>
                      GO <ChevronRightIcon width={16} height={16} />
                    </button>
                  ) : k === "surprise" ? (
                    <button key={k} className="cd-ngc__key cd-ngc__key--surprise" onClick={surpriseMe}>
                      <WormholeIcon width={16} height={16} />
                    </button>
                  ) : (
                    <button key={k} className="cd-ngc__key" onClick={() => pressDigit(k)}>
                      {k}
                    </button>
                  )
                )}
              </div>
              {value !== "" && !inRange && (
                <p className="cd-ngc__hint mono">Enter a number between {MIN_NGC} and {MAX_NGC}.</p>
              )}
            </>
          ) : (
            <div className="cd-ngc__miss">
              <p className="cd-ngc__miss-title">No clean view for NGC {value}</p>
              <p className="cd-ngc__miss-body mono">
                This entry may be a duplicate, a misidentified historical listing, or simply outside this survey
                layer&rsquo;s coverage.
              </p>
              <div className="cd-ngc__miss-actions">
                <button className="cd-btn cd-btn--ghost" onClick={tryAnother}>
                  TRY ANOTHER
                </button>
                <button className="cd-btn cd-btn--yellow" onClick={surpriseMe}>
                  SURPRISE ME
                </button>
              </div>
            </div>
          )}

          <p className="cd-ngc__footnote mono">
            This build maps a curated subset of NGC objects to real coordinates. Architected so the full 1&ndash;7840
            catalog can be dropped in later without UI changes.
          </p>
        </div>
      </div>
    </div>
  );
}
