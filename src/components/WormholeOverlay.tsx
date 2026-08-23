import { useEffect, useMemo, useState } from "react";
import type { SkyTarget } from "../types";
import { WormholeIcon } from "./icons";
import "./WormholeOverlay.css";

const ANIM_MS = 900;

interface Props {
  previousTarget: SkyTarget | null;
  nextTarget: SkyTarget | null;
  onComplete: () => void;
}

function driftCopy(previous: SkyTarget | null, next: SkyTarget | null): string {
  const a = previous?.object;
  const b = next?.object;
  if (a && b && typeof a.distance_mly === "number" && typeof b.distance_mly === "number") {
    const diff = Math.abs(b.distance_mly - a.distance_mly);
    if (diff > 0.5) {
      return `You drifted ${Math.round(diff).toLocaleString()} million light-years from your last stop.`;
    }
  }
  return "New coordinates acquired.";
}

export default function WormholeOverlay({ previousTarget, nextTarget, onComplete }: Props) {
  const [phase, setPhase] = useState<"warp" | "arrived">("warp");
  const copy = useMemo(() => driftCopy(previousTarget, nextTarget), [previousTarget, nextTarget]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("arrived"), ANIM_MS * 0.55);
    const t2 = setTimeout(() => onComplete(), ANIM_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="cd-wormhole">
      <div className="cd-wormhole__rings" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      {phase === "arrived" && (
        <div className="cd-wormhole__card">
          <WormholeIcon width={22} height={22} />
          <div className="cd-wormhole__title">WORMHOLE COMPLETE</div>
          <div className="cd-wormhole__copy mono">{copy}</div>
          {nextTarget?.object?.name && (
            <div className="cd-wormhole__target">{nextTarget.object.name}</div>
          )}
        </div>
      )}
    </div>
  );
}
