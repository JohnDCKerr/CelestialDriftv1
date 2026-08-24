import "./FirstRunHint.css";

interface Props {
  visible: boolean;
  coarsePointer: boolean;
}

/**
 * A single, one-time hint — not a tutorial system. Shown once on first-ever
 * successful image load, fades on its own after a few seconds, and fades
 * immediately the moment the person touches the screen. See
 * utils/storage.ts (hasSeenFirstRunHint / markFirstRunHintSeen) for the
 * localStorage-backed "have we shown this before" check.
 */
export default function FirstRunHint({ visible, coarsePointer }: Props) {
  return (
    <div className={`cd-hint ${visible ? "is-visible" : ""}`} aria-hidden={!visible}>
      <span>{coarsePointer ? "Drag to drift · pinch to dive deeper" : "Drag to drift · scroll to dive deeper"}</span>
    </div>
  );
}
