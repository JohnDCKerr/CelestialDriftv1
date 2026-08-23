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

const ITEMS: { key: DockKey; label: string; Icon: (p: { width?: number; height?: number }) => JSX.Element }[] = [
  { key: "wormhole", label: "Wormhole", Icon: WormholeIcon },
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

export default function BottomDock({ active, onSelect, hudSuppressed }: Props) {
  return (
    <nav className={`cd-dock ${hudSuppressed ? "is-hidden" : ""}`} aria-label="Destinations">
      {ITEMS.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={`cd-dock__item ${active === key ? "is-active" : ""}`}
          onClick={() => onSelect(key)}
          aria-pressed={active === key}
        >
          <Icon width={21} height={21} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
