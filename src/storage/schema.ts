import type {
  ClearanceSettings,
  FurnitureCategory,
  FurnitureKind,
  FurnitureObject,
  LayoutSnapshot,
  Opening,
  Project,
  ProjectSettings,
  Room,
  Rotation,
  Unit,
  WallSide,
} from '@/types';
import { DEFAULT_SETTINGS } from '@/features/furniture-library/catalog';
import { SCHEMA_VERSION } from '@/features/project-manager/defaults';
import { uid } from '@/engine/units';

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectValidationError';
  }
}

const KINDS: FurnitureKind[] = [
  'bed',
  'desk',
  'chair',
  'wardrobe',
  'dresser',
  'nightstand',
  'sofa',
  'coffee-table',
  'tv-cabinet',
  'side-table',
  'bookshelf',
  'cabinet',
  'drawers',
  'storage-rack',
  'custom',
];

const CATEGORIES: FurnitureCategory[] = [
  'Bedroom',
  'Office',
  'Living Room',
  'Storage',
  'Custom',
];

const WALLS: WallSide[] = ['north', 'south', 'east', 'west'];
const ROTATIONS: Rotation[] = [0, 90, 180, 270];
const UNITS: Unit[] = ['mm', 'cm', 'm'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number, min = 0, max = 100_000): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Read a physical dimension without silently raising it to its minimum, so
 * undersized or missing values can be rejected by the caller instead of being
 * imported as a different size than the file describes.
 */
function dimension(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

function str(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function readClearances(raw: unknown): ClearanceSettings {
  const base = DEFAULT_SETTINGS.clearances;
  if (!isRecord(raw)) return { ...base };
  return {
    walkwayLimited: num(raw.walkwayLimited, base.walkwayLimited, 100, 3000),
    walkwayComfortable: num(raw.walkwayComfortable, base.walkwayComfortable, 100, 4000),
    installationGap: num(raw.installationGap, base.installationGap, 0, 500),
    chair: num(raw.chair, base.chair, 100, 3000),
    bedside: num(raw.bedside, base.bedside, 100, 3000),
  };
}

function readSettings(raw: unknown): ProjectSettings {
  if (!isRecord(raw)) {
    return { ...DEFAULT_SETTINGS, clearances: { ...DEFAULT_SETTINGS.clearances } };
  }
  return {
    unit: UNITS.includes(raw.unit as Unit) ? (raw.unit as Unit) : DEFAULT_SETTINGS.unit,
    gridSize: num(raw.gridSize, DEFAULT_SETTINGS.gridSize, 10, 1000),
    showMeasurements: typeof raw.showMeasurements === 'boolean' ? raw.showMeasurements : true,
    showObjectDimensions:
      typeof raw.showObjectDimensions === 'boolean' ? raw.showObjectDimensions : true,
    showGrid: typeof raw.showGrid === 'boolean' ? raw.showGrid : true,
    snapEnabled: typeof raw.snapEnabled === 'boolean' ? raw.snapEnabled : true,
    clearances: readClearances(raw.clearances),
  };
}

function readRoom(raw: unknown): Room {
  if (!isRecord(raw)) throw new ProjectValidationError('Project is missing room data.');
  const width = dimension(raw.width, 50_000);
  const length = dimension(raw.length, 50_000);
  if (width < 300 || length < 300) {
    throw new ProjectValidationError('Room dimensions must be at least 30 cm.');
  }
  return {
    name: str(raw.name, 'Room'),
    width: Math.round(width),
    length: Math.round(length),
    ceilingHeight: Math.round(num(raw.ceilingHeight, 2700, 1500, 6000)),
    wallThickness: Math.round(num(raw.wallThickness, 120, 0, 600)),
  };
}

function readFurniture(raw: unknown, index: number): FurnitureObject {
  if (!isRecord(raw)) {
    throw new ProjectValidationError(`Furniture item ${index + 1} is not an object.`);
  }
  const width = dimension(raw.width, 20_000);
  const depth = dimension(raw.depth, 20_000);
  if (width < 50 || depth < 50) {
    throw new ProjectValidationError(
      `Furniture item ${index + 1} has an invalid size (minimum 5 cm).`,
    );
  }
  const rotation = ROTATIONS.includes(raw.rotation as Rotation)
    ? (raw.rotation as Rotation)
    : 0;
  const kind = KINDS.includes(raw.kind as FurnitureKind) ? (raw.kind as FurnitureKind) : 'custom';
  return {
    id: str(raw.id, uid('furn')),
    name: str(raw.name, `Furniture ${index + 1}`),
    kind,
    category: CATEGORIES.includes(raw.category as FurnitureCategory)
      ? (raw.category as FurnitureCategory)
      : 'Custom',
    x: Math.round(num(raw.x, width / 2, -20_000, 40_000)),
    y: Math.round(num(raw.y, depth / 2, -20_000, 40_000)),
    width: Math.round(width),
    depth: Math.round(depth),
    rotation,
    color: str(raw.color, '#DCC8AA'),
    locked: raw.locked === true,
  };
}

function readOpening(raw: unknown, index: number): Opening {
  if (!isRecord(raw)) {
    throw new ProjectValidationError(`Opening ${index + 1} is not an object.`);
  }
  const width = dimension(raw.width, 6000);
  if (width < 200) {
    throw new ProjectValidationError(`Opening ${index + 1} is narrower than 20 cm.`);
  }
  return {
    id: str(raw.id, uid('opening')),
    kind: raw.kind === 'window' ? 'window' : 'door',
    name: str(raw.name, raw.kind === 'window' ? 'Window' : 'Door'),
    wall: WALLS.includes(raw.wall as WallSide) ? (raw.wall as WallSide) : 'south',
    offset: Math.round(num(raw.offset, 0, 0, 50_000)),
    width: Math.round(width),
    height: Math.round(num(raw.height, 2100, 300, 4000)),
    hinge: raw.hinge === 'end' ? 'end' : 'start',
    swing: raw.swing === 'out' ? 'out' : 'in',
  };
}

function readLayouts(raw: unknown): LayoutSnapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((layout, index) => ({
      id: str(layout.id, uid('layout')),
      name: str(layout.name, `Layout ${index + 1}`),
      furniture: Array.isArray(layout.furniture)
        ? (layout.furniture as unknown[]).map((f, i) => readFurniture(f, i))
        : [],
      createdAt: num(layout.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
    }));
}

/**
 * Validate and normalise an unknown JSON payload into a Project. The payload is
 * treated purely as data — never executed.
 */
export function validateProject(raw: unknown): Project {
  if (!isRecord(raw)) {
    throw new ProjectValidationError('The selected file does not contain a RoomFit project.');
  }
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > SCHEMA_VERSION) {
    throw new ProjectValidationError(
      `This project was created with a newer version of RoomFit (schema ${raw.schemaVersion}).`,
    );
  }
  const room = readRoom(raw.room);
  const furniture = Array.isArray(raw.furniture)
    ? raw.furniture.map((f, i) => readFurniture(f, i))
    : [];
  const openings = Array.isArray(raw.openings)
    ? raw.openings.map((o, i) => readOpening(o, i))
    : [];
  const now = Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: str(raw.id, uid('project')),
    name: str(raw.name, 'Imported project'),
    room,
    furniture,
    openings,
    layouts: readLayouts(raw.layouts),
    activeLayoutId: typeof raw.activeLayoutId === 'string' ? raw.activeLayoutId : null,
    settings: readSettings(raw.settings),
    createdAt: Math.round(num(raw.createdAt, now, 0, Number.MAX_SAFE_INTEGER)),
    updatedAt: Math.round(num(raw.updatedAt, now, 0, Number.MAX_SAFE_INTEGER)),
  };
}

export function parseProjectJSON(text: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ProjectValidationError('That file is not valid JSON.');
  }
  return validateProject(data);
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/** Duplicate a project with fresh IDs so both copies remain independent. */
export function duplicateProject(project: Project, name?: string): Project {
  const now = Date.now();
  const idMap = new Map<string, string>();
  const furniture = project.furniture.map((f) => {
    const id = uid('furn');
    idMap.set(f.id, id);
    return { ...f, id };
  });
  return {
    ...project,
    id: uid('project'),
    name: name ?? `${project.name} copy`,
    furniture,
    openings: project.openings.map((o) => ({ ...o, id: uid('opening') })),
    layouts: project.layouts.map((layout) => ({
      ...layout,
      id: uid('layout'),
      furniture: layout.furniture.map((f) => ({ ...f, id: uid('furn') })),
    })),
    activeLayoutId: null,
    createdAt: now,
    updatedAt: now,
  };
}
