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
      humanFact: d.humanFact ?? null,
    },
  };
}

// The opening view is deliberately anonymous — offset a few arcmin away
// from the Whirlpool Galaxy's exact coordinates (same well-covered Legacy
// Survey field, guaranteed good imagery) so the galaxy itself is out of
// frame entirely. What's left is just the ordinary scattering of stars and
// faint background galaxies typical of that patch of sky — "I've arrived
// somewhere," not "here is a famous named object." No object metadata is
// attached, so tapping the crosshair honestly shows "You're here."
const OPENING_TARGET: SkyTarget = {
  ra_deg: 202.7696,
  dec_deg: 47.44528,
  pixscale: 1.1,
};

type Panel = DockKey | null;

export default function App() {
  const [target, setTarget] = useState<SkyTarget>(OPENING_TARGET);
  const [panel, setPanel] = useState<Panel>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [warpTick, setWarpTick] = useState(0);
  const [savedVersion, setSavedVersion] = useState(0); // bump to force Saved panel / bookmark icon refresh

  const closePanel = useCallback(() => setPanel(null), []);

  const jumpTo = useCallback((next: SkyTarget, opts?: { openSheet?: boolean }) => {
    setTarget(next);
    setPanel(null);
    setSheetOpen(opts?.openSheet !== false && !!next.object);
  }, []);

  const handleDockSelect = useCallback((key: DockKey) => {
    if (key === "wormhole") {
      const choice = destinations[Math.floor(Math.random() * destinations.length)];
      // Wormhole doesn't open the info sheet — the destination name flashes
      // briefly over the imagery itself (see ExplorationScreen's arrival
      // label), then fades. The full sheet stays one tap away via the
      // crosshair, for anyone curious enough to ask "wait, what was that?"
      setTarget(destinationToTarget(choice));
      setSheetOpen(false);
      setPanel(null);
      setWarpTick((t) => t + 1);
      return;
    }
    setPanel((current) => (current === key ? null : key));
  }, []);

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
        warpTick={warpTick}
        onTargetDrift={(t) => setTarget(t)}
        hudSuppressed={panel !== null || sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onWormhole={() => handleDockSelect("wormhole")}
      />

      <ObjectSheet
        target={target}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSavedChange={() => setSavedVersion((v) => v + 1)}
      />

      <BottomDock active={panel} onSelect={handleDockSelect} hudSuppressed={sheetOpen} />

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
    </div>
  );
}
