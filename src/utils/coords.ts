/** Format decimal-degree Right Ascension as HH h MM m SS s. */
export function formatRA(raDeg: number): string {
  const norm = ((raDeg % 360) + 360) % 360;
  const totalHours = norm / 15;
  const h = Math.floor(totalHours);
  const mFloat = (totalHours - h) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

/** Format decimal-degree Declination as +/-DD° MM' SS". */
export function formatDec(decDeg: number): string {
  const sign = decDeg < 0 ? "-" : "+";
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return `${sign}${pad(d)}\u00b0 ${pad(m)}' ${pad(s)}"`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Wrap RA into [0, 360). */
export function wrapRa(raDeg: number): number {
  return ((raDeg % 360) + 360) % 360;
}

/** Clamp Dec into [-90, 90]. */
export function clampDec(decDeg: number): number {
  return Math.max(-90, Math.min(90, decDeg));
}

/** Rough angular field of view (arcmin) covered by a cutout, given pixscale and image size. */
export function fovArcmin(pixscaleArcsecPerPx: number, sizePx: number): number {
  return (pixscaleArcsecPerPx * sizePx) / 60;
}
