export interface CollaboratorRank {
  iso: string;
  name: string;
  count: number;
}

export interface GlobeNode {
  id: string;
  country: string;
  artistCount: number;
  artworkCount: number;
  lat: number;
  lng: number;
  topCollaborators: CollaboratorRank[];
  totalCollaborations: number;
}

export interface WorkMeta {
  workId: number;
  title: string;
  year: number | null;
  date: string;
  thumbnail: string;
  url: string;
}

export interface GlobeEdge {
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  weight: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

export interface AuthorCollaboration {
  authorId: string;
  authorName: string;
  country: string;
  countryName: string;
  count: number;
  lat: number;
  lng: number;
}

export interface Author {
  id: string;
  name: string;
  bio: string;
  country: string;
  countryName: string;
  lat: number;
  lng: number;
  works: WorkMeta[];
  workCount?: number;
  topCollaborations: AuthorCollaboration[];
  collaborations: AuthorCollaboration[];
}

export interface AuthorPoint {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  collaborationCount: number;
}

export interface RenderAuthorPoint extends AuthorPoint {
  color: string;
  radius: number;
}

export interface CountryRecord {
  iso: string;
  name: string;
  artistCount: number;
  artworkCount: number;
  totalCollaborations: number;
}

export interface GlobeMeta {
  builtAt: string;
  crossCountryWorks: number;
  authorCount: number;
  nodeCount: number;
  edgeCount: number;
  artistCountMin: number;
  artistCountMax: number;
  artworkCountMin: number;
  artworkCountMax: number;
  defaultMinWeight: number;
}

export interface SearchIndexEntry {
  authorId: string;
  authorName: string;
  bio: string;
  country: string;
  countryName: string;
}

export interface AuthorSearchResult {
  authorId: string;
  author: Author;
  label: string;
}

export interface GlobeData {
  nodes: GlobeNode[];
  edges: GlobeEdge[];
  countries: Record<string, CountryRecord>;
  authors: Author[];
  authorPoints: AuthorPoint[];
  countryPolygons: CountryFeatureCollection | null;
  meta: GlobeMeta;
  searchIndex: SearchIndexEntry[];
}

export interface CountryPolygon {
  type: "Feature";
  properties: {
    name: string;
    iso_a3: string;
    artistCount: number;
    artworkCount: number;
    totalCollaborations: number;
    displayName: string;
  };
  geometry: GeoJSON.Geometry;
}

export interface CountryFeatureCollection {
  type: "FeatureCollection";
  features: CountryPolygon[];
}
