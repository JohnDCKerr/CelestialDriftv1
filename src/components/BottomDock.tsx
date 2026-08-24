import type { JSX } from "react";
import {
  BlackHoleIcon,
  GalaxyIcon,
  NebulaIcon,
  NgcIcon,
  SavedIcon,
  WeirdIcon,
  WormholeIcon,
} from "./icons";
import "./BottomDock.css";

export type DockKey = "wormhole" | "ngc" | "galaxies" | "nebulae" | "black_holes" | "weird" | "saved";

const SECONDARY: { key: Exclude<DockKey, "wormhole">; label: string; Icon: (p: { width?: number; height?: number }) => JSX.Element }[] = [
  { key: "ngc", label: "NGC", Icon: NgcIcon },
  { key: "galaxies", label: "Galaxies", Icon: GalaxyIcon },
  { key: "nebulae", label: "Nebulae", Icon: NebulaIcon },
  { key: "black_holes", label: "Black Holes", Icon: BlackHoleIcon },
  { key: "weird", label: "Weird", Icon: WeirdIcon },
  { key: "saved", label: "Saved", Icon: SavedIcon },
];

interface Props {
  active: DockKey | null;
  onSelect: (key: DockKey) => void;
  hudSuppressed: boolean;
}

/**
 * Wormhole is the signature action — a large, elevated, glowing button on
 * its own, clearly the primary thing to tap. Everything else (NGC jump,
 * curated categories, saved) lives in a slim, quiet secondary row: real
 * functionality, but visually in support of drifting/wormholing rather than
 * competing with it.
 */
export default function BottomDock({ active, onSelect, hudSuppressed }: Props) {
  return (
    <div className={`cd-dockwrap ${hudSuppressed ? "is-hidden" : ""}`}>
      <button
        className="cd-wormhole-fab"
        onClick={() => onSelect("wormhole")}
        aria-label="Wormhole — take me somewhere"
      >
        <WormholeIcon width={21} height={21} />
      </button>

      <nav className="cd-dock" aria-label="Destinations">
        {SECONDARY.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`cd-dock__item ${active === key ? "is-active" : ""}`}
            onClick={() => onSelect(key)}
            aria-pressed={active === key}
          >
            <Icon width={17} height={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
