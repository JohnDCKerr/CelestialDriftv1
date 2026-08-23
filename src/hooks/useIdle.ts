import { useEffect, useRef, useState } from "react";

/** Returns true once the user has been inactive for `timeoutMs`. */
export function useIdle(timeoutMs = 3800): [boolean, () => void] {
  const [idle, setIdle] = useState(false);
  const timer = useRef<number | null>(null);

  const reset = () => {
    setIdle(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setIdle(true), timeoutMs);
  };

  useEffect(() => {
    reset();
    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "pointermove",
      "wheel",
      "keydown",
      "touchstart",
    ];
    const handler = () => reset();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [idle, reset];
}
