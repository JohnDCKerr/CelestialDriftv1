import { useEffect, useState } from "react";
import type { Destination, DestinationCategory, SavedDestination, SkyTarget } from "../types";
import { formatDec, formatRA } from "../utils/coords";
import { loadSaved, removeSaved } from "../utils/storage";
import { CloseIcon, TrashIcon } from "./icons";
import "./CategoryPanel.css";

const TITLES: Record<DestinationCategory | "saved", string> = {
  galaxies: "GALAXIES",
  nebulae: "NEBULAE",
  black_holes: "BLACK HOLES",
  weird: "WEIRD",
  saved: "SAVED",
};

interface Props {
  category: DestinationCategory | "saved";
  items: Destination[];
  onClose: () => void;
  onSelect: (d: Destination) => void;
  onSelectSaved?: (t: SkyTarget) => void;
  savedVersion?: number;
}

export default function CategoryPanel({ category, items, onClose, onSelect, onSelectSaved, savedVersion }: Props) {
  const [saved, setSaved] = useState<SavedDestination[]>([]);

  useEffect(() => {
    if (category === "saved") setSaved(loadSaved());
  }, [category, savedVersion]);

  const handleDelete = (id: string) => {
    removeSaved(id);
    setSaved(loadSaved());
  };

  return (
    <div className="cd-panel-overlay" onClick={onClose}>
      <div className="cd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cd-panel__header">
          <span className="cd-panel__title">{TITLES[category]}</span>
          <button className="cd-panel__close" onClick={onClose} aria-label="Close">
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <div className="cd-panel__body">
          {category === "saved" ? (
            saved.length === 0 ? (
              <div className="cd-category__empty">
                <p>No saved destinations yet.</p>
                <p className="mono">Tap SAVE on any object&rsquo;s info sheet to keep it here.</p>
              </div>
            ) : (
              <ul className="cd-category__list">
                {saved.map((s) => (
                  <li key={s.id} className="cd-category__item">
                    <button className="cd-category__item-main" onClick={() => onSelectSaved?.(s)}>
                      <span className="cd-category__item-name">{s.object?.name ?? "Unnamed point"}</span>
                      <span className="cd-category__item-sub mono">
                        {s.object?.catalog ?? `RA ${formatRA(s.ra_deg)} · Dec ${formatDec(s.dec_deg)}`}
                      </span>
                    </button>
                    <button
                      className="cd-category__item-delete"
                      onClick={() => handleDelete(s.id)}
                      aria-label="Remove from saved"
                    >
                      <TrashIcon width={16} height={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : items.length === 0 ? (
            <div className="cd-category__empty">
              <p>Nothing curated here yet.</p>
            </div>
          ) : (
            <ul className="cd-category__list">
              {items.map((d) => (
                <li key={d.id} className="cd-category__item">
                  <button className="cd-category__item-main" onClick={() => onSelect(d)}>
                    <span className="cd-category__item-name">{d.name}</span>
                    <span className="cd-category__item-sub mono">
                      {d.catalog} &middot; {d.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
