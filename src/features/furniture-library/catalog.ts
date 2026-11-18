import type {
  ClearanceSettings,
  FurnitureCategory,
  FurnitureKind,
  ProjectSettings,
} from '@/types';

export interface FurniturePreset {
  key: string;
  name: string;
  kind: FurnitureKind;
  category: FurnitureCategory;
  width: number;
  depth: number;
  color: string;
  description: string;
}

export const CATEGORY_ORDER: FurnitureCategory[] = [
  'Bedroom',
  'Office',
  'Living Room',
  'Storage',
  'Custom',
];

export const FURNITURE_COLORS = {
  linen: '#E9E2D5',
  bone: '#F1ECE3',
  oak: '#DCC8AA',
  walnut: '#C8B091',
  sage: '#A6B8A8',
  forest: '#285343',
  clay: '#C49345',
  stone: '#D7D9D2',
  slate: '#B9C2BC',
};

export const FURNITURE_PRESETS: FurniturePreset[] = [
  // Bedroom
  {
    key: 'single-bed',
    name: 'Single Bed',
    kind: 'bed',
    category: 'Bedroom',
    width: 900,
    depth: 2000,
    color: FURNITURE_COLORS.linen,
    description: '90 × 200 cm',
  },
  {
    key: 'double-bed',
    name: 'Double Bed',
    kind: 'bed',
    category: 'Bedroom',
    width: 1200,
    depth: 2000,
    color: FURNITURE_COLORS.linen,
    description: '120 × 200 cm',
  },
  {
    key: 'queen-bed',
    name: 'Queen Bed',
    kind: 'bed',
    category: 'Bedroom',
    width: 1600,
    depth: 2000,
    color: FURNITURE_COLORS.bone,
    description: '160 × 200 cm',
  },
  {
    key: 'king-bed',
    name: 'King Bed',
    kind: 'bed',
    category: 'Bedroom',
    width: 1800,
    depth: 2000,
    color: FURNITURE_COLORS.bone,
    description: '180 × 200 cm',
  },
  {
    key: 'bedside-table',
    name: 'Bedside Table',
    kind: 'nightstand',
    category: 'Bedroom',
    width: 450,
    depth: 400,
    color: FURNITURE_COLORS.oak,
    description: '45 × 40 cm',
  },
  {
    key: 'wardrobe',
    name: 'Wardrobe',
    kind: 'wardrobe',
    category: 'Bedroom',
    width: 1200,
    depth: 600,
    color: FURNITURE_COLORS.sage,
    description: '120 × 60 cm',
  },
  {
    key: 'dresser',
    name: 'Dresser',
    kind: 'dresser',
    category: 'Bedroom',
    width: 1000,
    depth: 450,
    color: FURNITURE_COLORS.walnut,
    description: '100 × 45 cm',
  },
  // Office
  {
    key: 'work-desk',
    name: 'Work Desk',
    kind: 'desk',
    category: 'Office',
    width: 1200,
    depth: 600,
    color: FURNITURE_COLORS.oak,
    description: '120 × 60 cm',
  },
  {
    key: 'office-chair',
    name: 'Office Chair',
    kind: 'chair',
    category: 'Office',
    width: 550,
    depth: 550,
    color: FURNITURE_COLORS.slate,
    description: '55 × 55 cm',
  },
  {
    key: 'bookshelf',
    name: 'Bookshelf',
    kind: 'bookshelf',
    category: 'Office',
    width: 800,
    depth: 300,
    color: FURNITURE_COLORS.walnut,
    description: '80 × 30 cm',
  },
  // Living Room
  {
    key: 'sofa',
    name: 'Sofa',
    kind: 'sofa',
    category: 'Living Room',
    width: 2000,
    depth: 850,
    color: FURNITURE_COLORS.sage,
    description: '200 × 85 cm',
  },
  {
    key: 'coffee-table',
    name: 'Coffee Table',
    kind: 'coffee-table',
    category: 'Living Room',
    width: 1000,
    depth: 600,
    color: FURNITURE_COLORS.oak,
    description: '100 × 60 cm',
  },
  {
    key: 'tv-cabinet',
    name: 'TV Cabinet',
    kind: 'tv-cabinet',
    category: 'Living Room',
    width: 1600,
    depth: 400,
    color: FURNITURE_COLORS.walnut,
    description: '160 × 40 cm',
  },
  {
    key: 'side-table',
    name: 'Side Table',
    kind: 'side-table',
    category: 'Living Room',
    width: 450,
    depth: 450,
    color: FURNITURE_COLORS.oak,
    description: '45 × 45 cm',
  },
  // Storage
  {
    key: 'cabinet',
    name: 'Cabinet',
    kind: 'cabinet',
    category: 'Storage',
    width: 800,
    depth: 400,
    color: FURNITURE_COLORS.bone,
    description: '80 × 40 cm',
  },
  {
    key: 'drawers',
    name: 'Drawers',
    kind: 'drawers',
    category: 'Storage',
    width: 800,
    depth: 450,
    color: FURNITURE_COLORS.oak,
    description: '80 × 45 cm',
  },
  {
    key: 'storage-rack',
    name: 'Storage Rack',
    kind: 'storage-rack',
    category: 'Storage',
    width: 900,
    depth: 350,
    color: FURNITURE_COLORS.slate,
    description: '90 × 35 cm',
  },
];

export function presetByKey(key: string): FurniturePreset | undefined {
  return FURNITURE_PRESETS.find((preset) => preset.key === key);
}

export const DEFAULT_CLEARANCES: ClearanceSettings = {
  walkwayLimited: 600,
  walkwayComfortable: 800,
  installationGap: 30,
  chair: 800,
  bedside: 600,
};

export const DEFAULT_SETTINGS: ProjectSettings = {
  unit: 'cm',
  gridSize: 100,
  showMeasurements: true,
  showObjectDimensions: true,
  showGrid: true,
  snapEnabled: true,
  clearances: { ...DEFAULT_CLEARANCES },
};

/** Bed sizes are typical mattress sizes, not frame sizes — editable per object. */
export const BED_SIZE_OPTIONS = [
  { id: 'single', label: 'Single', width: 900, depth: 2000 },
  { id: 'double', label: 'Double', width: 1200, depth: 2000 },
  { id: 'queen', label: 'Queen', width: 1600, depth: 2000 },
  { id: 'king', label: 'King', width: 1800, depth: 2000 },
  { id: 'small-double', label: 'Small Double', width: 1400, depth: 2000 },
];
