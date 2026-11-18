import type { FurnitureObject, Opening, Project, Room } from '@/types';
import { uid } from '@/engine/units';
import { DEFAULT_SETTINGS, FURNITURE_COLORS } from '@/features/furniture-library/catalog';

export const SCHEMA_VERSION = 1;

export function createRoom(overrides: Partial<Room> = {}): Room {
  return {
    name: 'Bedroom',
    width: 3000,
    length: 3600,
    ceilingHeight: 2700,
    wallThickness: 120,
    ...overrides,
  };
}

export function createBlankProject(name = 'Untitled room'): Project {
  const now = Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid('project'),
    name,
    room: createRoom(),
    openings: [
      {
        id: uid('door'),
        kind: 'door',
        name: 'Entrance door',
        wall: 'south',
        offset: 1100,
        width: 850,
        height: 2100,
        hinge: 'start',
        swing: 'in',
      },
    ],
    furniture: [],
    layouts: [],
    activeLayoutId: null,
    settings: { ...DEFAULT_SETTINGS, clearances: { ...DEFAULT_SETTINGS.clearances } },
    createdAt: now,
    updatedAt: now,
  };
}

function sampleFurniture(): FurnitureObject[] {
  return [
    {
      id: 'furn_sample_bed',
      name: 'Double bed',
      kind: 'bed',
      category: 'Bedroom',
      x: 800,
      y: 1000,
      width: 1600,
      depth: 2000,
      rotation: 0,
      color: FURNITURE_COLORS.bone,
      locked: false,
    },
    {
      id: 'furn_sample_wardrobe',
      name: 'Wardrobe',
      kind: 'wardrobe',
      category: 'Bedroom',
      x: 2550,
      y: 600,
      width: 800,
      depth: 500,
      rotation: 90,
      color: FURNITURE_COLORS.sage,
      locked: false,
    },
    {
      id: 'furn_sample_desk',
      name: 'Work desk',
      kind: 'desk',
      category: 'Office',
      x: 550,
      y: 2925,
      width: 1100,
      depth: 550,
      rotation: 180,
      color: FURNITURE_COLORS.oak,
      locked: false,
    },
  ];
}

function sampleOpenings(): Opening[] {
  return [
    {
      id: 'door_sample_entrance',
      kind: 'door',
      name: 'Entrance door',
      wall: 'south',
      offset: 1850,
      width: 850,
      height: 2100,
      hinge: 'start',
      swing: 'in',
    },
    {
      id: 'window_sample_east',
      kind: 'window',
      name: 'Window',
      wall: 'east',
      offset: 1400,
      width: 1200,
      height: 1200,
      hinge: 'start',
      swing: 'in',
    },
  ];
}

/** Demonstrates a realistic, slightly tight bedroom layout. */
export function createSampleProject(): Project {
  const now = Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid('project'),
    name: 'Sample bedroom',
    room: createRoom({ width: 2800, length: 3200, name: 'Bedroom 2.8 × 3.2 m' }),
    openings: sampleOpenings(),
    furniture: sampleFurniture(),
    layouts: [],
    activeLayoutId: null,
    settings: { ...DEFAULT_SETTINGS, clearances: { ...DEFAULT_SETTINGS.clearances } },
    createdAt: now,
    updatedAt: now,
  };
}

/** A quick-fit project used when the user tests a single piece of furniture. */
export function createQuickFitProject(
  room: Room,
  opening?: Opening | null,
): Project {
  const project = createBlankProject('Quick fit');
  project.room = room;
  project.openings = opening ? [opening] : [];
  return project;
}
