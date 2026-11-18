/**
 * Core RoomFit domain models.
 *
 * All geometry is stored in integer millimetres (mm). Display units are a
 * presentation concern only and never mutate the stored values.
 */

export type Unit = 'mm' | 'cm' | 'm';

export type WallSide = 'north' | 'south' | 'east' | 'west';

export type FurnitureCategory =
  | 'Bedroom'
  | 'Office'
  | 'Living Room'
  | 'Storage'
  | 'Custom';

export type FurnitureKind =
  | 'bed'
  | 'desk'
  | 'chair'
  | 'wardrobe'
  | 'dresser'
  | 'nightstand'
  | 'sofa'
  | 'coffee-table'
  | 'tv-cabinet'
  | 'side-table'
  | 'bookshelf'
  | 'cabinet'
  | 'drawers'
  | 'storage-rack'
  | 'custom';

/** Clockwise rotation in degrees. RoomFit MVP supports 0/90/180/270. */
export type Rotation = 0 | 90 | 180 | 270;

export interface FurnitureObject {
  id: string;
  name: string;
  kind: FurnitureKind;
  category: FurnitureCategory;
  /** Centre X in mm, measured from the inner top-left room corner. */
  x: number;
  /** Centre Y in mm, measured from the inner top-left room corner. */
  y: number;
  /** Object width in mm, in its own (unrotated) orientation. */
  width: number;
  /** Object depth in mm, in its own (unrotated) orientation. */
  depth: number;
  rotation: Rotation;
  /** Accent colour used by the 2D illustration. */
  color: string;
  locked: boolean;
}

export interface Opening {
  id: string;
  kind: 'door' | 'window';
  name: string;
  wall: WallSide;
  /** Distance in mm from the start corner of the wall to the opening's left edge. */
  offset: number;
  width: number;
  /** Millimetre metadata, reserved for the 3D phase. */
  height: number;
  /** Doors only: hinge on the "start" or "end" edge of the opening. */
  hinge: 'start' | 'end';
  /** Doors only: swing into or out of the room. */
  swing: 'in' | 'out';
}

export interface Room {
  name: string;
  /** Inner clear width in mm (X axis). */
  width: number;
  /** Inner clear length in mm (Y axis). */
  length: number;
  /** Metadata for future 3D support. */
  ceilingHeight: number;
  /** Visual wall thickness in mm. Does not change the inner clear size. */
  wallThickness: number;
}

export interface LayoutSnapshot {
  id: string;
  name: string;
  furniture: FurnitureObject[];
  createdAt: number;
}

export interface ClearanceSettings {
  /** Minimum acceptable passage in mm. */
  walkwayLimited: number;
  /** Comfortable passage target in mm. */
  walkwayComfortable: number;
  /** Gap required to install / open furniture in mm. */
  installationGap: number;
  /** Working space in front of a desk when a chair is used, in mm. */
  chair: number;
  /** Access beside a bed, in mm. */
  bedside: number;
}

export interface ProjectSettings {
  unit: Unit;
  gridSize: number;
  showMeasurements: boolean;
  showObjectDimensions: boolean;
  showGrid: boolean;
  snapEnabled: boolean;
  clearances: ClearanceSettings;
}

export interface Project {
  schemaVersion: number;
  id: string;
  name: string;
  room: Room;
  openings: Opening[];
  furniture: FurnitureObject[];
  layouts: LayoutSnapshot[];
  activeLayoutId: string | null;
  settings: ProjectSettings;
  createdAt: number;
  updatedAt: number;
}

export type FitStatus = 'comfortable' | 'tight' | 'no-fit' | 'review';

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueCategory =
  | 'physical'
  | 'collision'
  | 'boundary'
  | 'opening'
  | 'clearance'
  | 'circulation'
  | 'review';

export interface Measurement {
  label: string;
  /** Value in millimetres (or mm² when `area` is true). */
  value: number;
  area?: boolean;
}

export interface AnalysisIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  message: string;
  objectIds: string[];
  measurements: Measurement[];
  suggestion?: string;
}

export interface PairCollision {
  aId: string;
  bId: string;
  overlapWidth: number;
  overlapHeight: number;
}

export interface ClearanceCheck {
  id: string;
  objectId: string;
  label: string;
  target: number;
  available: number;
  ok: boolean;
  zone: Rect;
}

export interface DoorCheck {
  openingId: string;
  blocked: boolean;
  blockedBy: string[];
}

export interface AnalysisResult {
  status: FitStatus;
  statusLabel: string;
  summary: string;
  issues: AnalysisIssue[];
  collisions: PairCollision[];
  doorChecks: DoorCheck[];
  clearanceChecks: ClearanceCheck[];
  roomArea: number;
  occupiedArea: number;
  freeArea: number;
  occupancyPct: number;
  objectCount: number;
}

/** Axis-aligned rectangle in world millimetres. */
export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PropsWithChildren {
  children: React.ReactNode;
}

export interface Point {
  x: number;
  y: number;
}
