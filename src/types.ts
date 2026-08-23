export type DestinationCategory =
  | "galaxies"
  | "nebulae"
  | "black_holes"
  | "weird";

export interface NgcEntry {
  ngc: number;
  name: string | null;
  ra_deg: number;
  dec_deg: number;
  type: string;
  constellation: string;
  distance_mly?: number | null;
  distance_ly?: number | null;
  description?: string | null;
}

export interface Destination {
  id: string;
  category: DestinationCategory;
  name: string;
  catalog: string;
  ra_deg: number;
  dec_deg: number;
  distance_mly?: number | null;
  distance_ly?: number | null;
  description: string;
  suggested_pixscale: number;
  type: string;
  constellation: string;
}

/** A location the viewer is centered on — either a known curated/NGC object, or an anonymous point in the sky. */
export interface SkyTarget {
  ra_deg: number;
  dec_deg: number;
  pixscale: number;
  /** Present when this target corresponds to a known catalogued object. */
  object?: {
    name: string | null;
    catalog: string;
    type?: string;
    constellation?: string;
    distance_mly?: number | null;
    distance_ly?: number | null;
    description?: string | null;
  };
}

export interface SavedDestination extends SkyTarget {
  id: string;
  savedAt: number;
}
