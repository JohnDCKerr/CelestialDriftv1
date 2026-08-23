import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function WormholeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="12" cy="7" rx="8.5" ry="3.2" />
      <ellipse cx="12" cy="10.5" rx="6.2" ry="2.3" opacity="0.75" />
      <ellipse cx="12" cy="13.2" rx="4.1" ry="1.55" opacity="0.55" />
      <ellipse cx="12" cy="15.3" rx="2.2" ry="0.9" opacity="0.4" />
      <path d="M3.5 7v6.5c0 1.8 3.8 3.2 8.5 3.2s8.5-1.4 8.5-3.2V7" opacity="0.6" />
    </svg>
  );
}

export function NgcIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M7.5 8h3M7.5 12h9M7.5 16h6" />
    </svg>
  );
}

export function GalaxyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12 12c2.4-3 6-3.6 8.4-2.2" />
      <path d="M12 12c-2.4 3-6 3.6-8.4 2.2" />
      <path d="M12 12c3 2.4 3.6 6 2.2 8.4" />
      <path d="M12 12c-3-2.4-3.6-6-2.2-8.4" />
    </svg>
  );
}

export function NebulaIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 15.5c0-2 1.6-3.4 3.4-3.1.5-1.9 2.3-3.2 4.3-2.9.3-1.7 1.8-3 3.6-3 2.1 0 3.8 1.7 3.8 3.8 0 .3 0 .5-.1.8 1.5.4 2.6 1.8 2.6 3.4 0 2-1.6 3.5-3.5 3.5H7.2c-1.5 0-2.7-1.1-2.7-2.5Z" />
      <circle cx="15.5" cy="9" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BlackHoleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" />
    </svg>
  );
}

export function WeirdIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5l2.6 5.4 5.9.7-4.3 4.1 1.1 5.8L12 16.6l-5.3 2.9 1.1-5.8-4.3-4.1 5.9-.7L12 3.5z" />
    </svg>
  );
}

export function SavedIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4-6.5 4V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function CrosshairIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function BackspaceIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 5h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7Z" />
      <path d="M12.5 10l4 4M16.5 10l-4 4" />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="18" cy="5.5" r="2.2" />
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="18.5" r="2.2" />
      <path d="M7.9 10.9l8.2-4.3M7.9 13.1l8.2 4.3" />
    </svg>
  );
}

export function BookmarkPlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4-6.5 4V4.5a1 1 0 0 1 1-1Z" />
      <path d="M12 8v4M10 10h4" />
    </svg>
  );
}

export function BookmarkFilledIcon(props: IconProps) {
  return (
    <svg {...base} {...props} fill="currentColor">
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4-6.5 4V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5l8.5 4.3L12 12.1 3.5 7.8 12 3.5Z" />
      <path d="M3.5 12.1 12 16.4l8.5-4.3M3.5 16.4 12 20.7l8.5-4.3" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M7 7l1 13h8l1-13" />
    </svg>
  );
}
