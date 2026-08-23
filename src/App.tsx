import { useCallback, useMemo, useState } from "react";
import "./styles/global.css";
import "./App.css";

import destinationsData from "./data/destinations.json";
import ngcData from "./data/ngc.json";
import type { Destination, DestinationCategory, NgcEntry, SkyTarget } from "./types";

import ExplorationScreen from "./components/ExplorationScreen";
import BottomDock, { type DockKey } from "./components/BottomDock";
import ObjectSheet from "./components/ObjectSheet";
import NGCJumpPanel from "./components/NGCJumpPanel";
import CategoryPanel from "./components/CategoryPanel";
import WormholeOverlay from "./components/WormholeOverlay";

const destinations = destinationsData as Destination[];
const ngcCatalog = ngcData as NgcEntry[];

function destinationToTarget(d: Destination): SkyTarget {
  return {
    ra_deg: d.ra_deg,
    dec_deg: d.dec_deg,
    pixscale: d.suggested_pixscale,
    object: {
      name: d.name,
      catalog: d.catalog,
      type: d.type,
      constellation: d.constellation,
      distance_mly: d.distance_mly ?? null,
      distance_ly: d.distance_ly ?? null,
      description: d.description,
    },
  };
}

// A curated jump-off point so first launch already has something interesting
// centered rather than an arbitrary empty patch of sky.
const START_TARGET: SkyTarget = destinationToTarget(
  destinations.find((d) => d.id === "m51") ?? destinations[0]
);

type Panel = DockKey | null;

export default function App() {
  const [target, setTarget] = useState<SkyTarget>(START_TARGET);
  const [previousTarget, setPreviousTarget] = useState<SkyTarget | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [wormholeActive, setWormholeActive] = useState(false);
  const [pendingWormholeTarget, setPendingWormholeTarget] = useState<SkyTarget | null>(null);
  const [savedVersion, setSavedVersion] = useState(0); // bump to force Saved panel / bookmark icon refresh

  const closePanel = useCallback(() => setPanel(null), []);

  const jumpTo = useCallback(
    (next: SkyTarget, opts?: { openSheet?: boolean }) => {
      setPreviousTarget(target);
      setTarget(next);
      setPanel(null);
      setSheetOpen(opts?.openSheet !== false && !!next.object);
    },
    [target]
  );

  const handleDockSelect = useCallback((key: DockKey) => {
    if (key === "wormhole") {
      const pool = destinations;
      const choice = pool[Math.floor(Math.random() * pool.length)];
      setPendingWormholeTarget(destinationToTarget(choice));
      setWormholeActive(true);
      return;
    }
    setPanel((current) => (current === key ? null : key));
  }, []);

  const handleWormholeComplete = useCallback(() => {
    setWormholeActive(false);
    if (pendingWormholeTarget) {
      jumpTo(pendingWormholeTarget);
      setPendingWormholeTarget(null);
    }
  }, [pendingWormholeTarget, jumpTo]);

  const categoryDestinations = useMemo(() => {
    const byCategory: Record<DestinationCategory, Destination[]> = {
      galaxies: [],
      nebulae: [],
      black_holes: [],
      weird: [],
    };
    for (const d of destinations) byCategory[d.category].push(d);
    return byCategory;
  }, []);

  return (
    <div className="cd-app">
      <ExplorationScreen
        target={target}
        onTargetDrift={(t) => setTarget(t)}
        hudSuppressed={panel !== null || sheetOpen || wormholeActive}
        onOpenSheet={() => setSheetOpen(true)}
        onWormhole={() => handleDockSelect("wormhole")}
      />

      <ObjectSheet
        target={target}
        open={sheetOpen && !wormholeActive}
        onClose={() => setSheetOpen(false)}
        onSavedChange={() => setSavedVersion((v) => v + 1)}
      />

      <BottomDock active={panel} onSelect={handleDockSelect} hudSuppressed={sheetOpen || wormholeActive} />

      {panel === "ngc" && (
        <NGCJumpPanel catalog={ngcCatalog} onClose={closePanel} onJump={(t) => jumpTo(t)} />
      )}

      {(panel === "galaxies" || panel === "nebulae" || panel === "black_holes" || panel === "weird") && (
        <CategoryPanel
          category={panel}
          items={categoryDestinations[panel]}
          onClose={closePanel}
          onSelect={(d) => jumpTo(destinationToTarget(d))}
        />
      )}

      {panel === "saved" && (
        <CategoryPanel
          category="saved"
          items={[]}
          onClose={closePanel}
          onSelect={(d) => jumpTo(destinationToTarget(d))}
          onSelectSaved={(t) => jumpTo(t)}
          savedVersion={savedVersion}
        />
      )}

      {wormholeActive && (
        <WormholeOverlay
          previousTarget={previousTarget}
          nextTarget={pendingWormholeTarget}
          onComplete={handleWormholeComplete}
        />
      )}
    </div>
  );
}
