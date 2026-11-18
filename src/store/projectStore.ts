import { create } from 'zustand';
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
  WallSide,
} from '@/types';
import { footprint, rectsOverlap, rotateObject } from '@/engine/geometry';
import { openingBlocksObject } from '@/engine/openings';
import { uid } from '@/engine/units';
import {
  createBlankProject,
  createSampleProject,
  SCHEMA_VERSION,
} from '@/features/project-manager/defaults';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface FurnitureInput {
  name: string;
  kind: FurnitureKind;
  category: FurnitureCategory;
  width: number;
  depth: number;
  color: string;
}

interface ProjectState {
  project: Project;
  past: Project[];
  future: Project[];
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  storageError: string | null;

  beginHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  loadProject: (project: Project) => void;
  resetProject: (mode: 'blank' | 'sample') => Project;
  renameProject: (name: string) => void;

  setRoom: (patch: Partial<Room>) => void;
  addFurniture: (input: FurnitureInput, position?: { x: number; y: number }) => FurnitureObject;
  moveFurnitureLive: (id: string, x: number, y: number) => void;
  updateFurniture: (id: string, patch: Partial<FurnitureObject>) => void;
  updateFurnitureLive: (id: string, patch: Partial<FurnitureObject>) => void;
  removeFurniture: (id: string) => void;
  duplicateFurniture: (id: string) => string | null;
  rotateFurniture: (id: string, direction?: 'cw' | 'ccw') => void;
  toggleLock: (id: string) => void;

  addOpening: (kind: 'door' | 'window', wall?: WallSide) => string;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  updateOpeningLive: (id: string, patch: Partial<Opening>) => void;
  removeOpening: (id: string) => void;

  updateSettings: (patch: Partial<ProjectSettings>) => void;
  updateClearances: (patch: Partial<ClearanceSettings>) => void;
  applyQuickFit: (input: {
    width: number;
    length: number;
    keepExisting: boolean;
    object: FurnitureObject;
  }) => void;

  saveLayout: (name: string) => void;
  applyLayout: (id: string) => void;
  renameLayout: (id: string, name: string) => void;
  deleteLayout: (id: string) => void;
  duplicateLayout: (id: string) => void;

  setSaveStatus: (status: SaveStatus, error?: string | null) => void;
  markSaved: () => void;
}

const HISTORY_LIMIT = 60;

function touch(project: Project): Project {
  return { ...project, updatedAt: Date.now() };
}

function cloneFurniture(furniture: FurnitureObject[]): FurnitureObject[] {
  return furniture.map((f) => ({ ...f }));
}

function findFreeSpot(
  project: Project,
  width: number,
  depth: number,
): { x: number; y: number } {
  const { room } = project;
  const step = 100;
  const candidates: { x: number; y: number }[] = [];
  const push = (x: number, y: number) => {
    if (x - width / 2 < 0 || y - depth / 2 < 0) return;
    if (x + width / 2 > room.width || y + depth / 2 > room.length) return;
    candidates.push({ x, y });
  };
  push(width / 2, depth / 2);
  push(room.width - width / 2, depth / 2);
  push(width / 2, room.length - depth / 2);
  push(room.width - width / 2, room.length - depth / 2);
  push(room.width / 2, room.length / 2);
  for (let y = depth / 2; y <= room.length - depth / 2; y += step) {
    for (let x = width / 2; x <= room.width - width / 2; x += step) {
      candidates.push({ x, y });
    }
  }
  for (const point of candidates) {
    const rect = { x1: point.x - width / 2, y1: point.y - depth / 2, x2: point.x + width / 2, y2: point.y + depth / 2 };
    const collision = project.furniture.some((f) => rectsOverlap(rect, footprint(f)));
    if (collision) continue;
    const preview: FurnitureObject = {
      id: 'preview',
      name: 'preview',
      kind: 'custom',
      category: 'Custom',
      x: point.x,
      y: point.y,
      width,
      depth,
      rotation: 0,
      color: '#000',
      locked: false,
    };
    if (project.openings.some((opening) => openingBlocksObject(opening, room, preview))) continue;
    return point;
  }
  return { x: room.width / 2, y: room.length / 2 };
}

function createFurniture(
  project: Project,
  input: FurnitureInput,
  position?: { x: number; y: number },
): FurnitureObject {
  const spot = position ?? findFreeSpot(project, input.width, input.depth);
  return {
    id: uid('furn'),
    name: input.name,
    kind: input.kind,
    category: input.category,
    x: Math.round(spot.x),
    y: Math.round(spot.y),
    width: Math.round(input.width),
    depth: Math.round(input.depth),
    rotation: 0,
    color: input.color,
    locked: false,
  };
}

const initial = createBlankProject();

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: initial,
  past: [],
  future: [],
  saveStatus: 'idle',
  lastSavedAt: null,
  storageError: null,

  beginHistory: () =>
    set((state) => ({
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
      future: [],
    })),

  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        project: previous,
        past: state.past.slice(0, -1),
        future: [state.project, ...state.future].slice(0, HISTORY_LIMIT),
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      return {
        project: next,
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
        future: state.future.slice(1),
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  loadProject: (project) =>
    set({
      project,
      past: [],
      future: [],
      saveStatus: 'saved',
      lastSavedAt: Date.now(),
      storageError: null,
    }),

  resetProject: (mode) => {
    const project = mode === 'sample' ? createSampleProject() : createBlankProject();
    get().loadProject(project);
    return project;
  },

  renameProject: (name) =>
    set((state) => ({
      project: touch({ ...state.project, name: name.trim() || state.project.name }),
    })),

  setRoom: (patch) =>
    set((state) => {
      const room = { ...state.project.room, ...patch };
      room.width = Math.max(1000, Math.round(room.width));
      room.length = Math.max(1000, Math.round(room.length));
      room.ceilingHeight = Math.max(1500, Math.round(room.ceilingHeight));
      const openings = state.project.openings.map((opening) => {
        const maxOffset = Math.max(
          0,
          (opening.wall === 'north' || opening.wall === 'south' ? room.width : room.length) -
            opening.width,
        );
        return { ...opening, offset: Math.min(opening.offset, maxOffset) };
      });
      return {
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
        future: [],
        project: touch({ ...state.project, room, openings }),
      };
    }),

  addFurniture: (input, position) => {
    const furniture = createFurniture(get().project, input, position);
    set((state) => ({
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
      future: [],
      project: touch({ ...state.project, furniture: [...state.project.furniture, furniture] }),
    }));
    return furniture;
  },

  moveFurnitureLive: (id, x, y) =>
    set((state) => ({
      project: touch({
        ...state.project,
        furniture: state.project.furniture.map((f) =>
          f.id === id ? { ...f, x: Math.round(x), y: Math.round(y) } : f,
        ),
      }),
    })),

  updateFurniture: (id, patch) =>
    set((state) => ({
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
      future: [],
      project: touch({
        ...state.project,
        furniture: state.project.furniture.map((f) =>
          f.id === id ? sanitizeFurniture({ ...f, ...patch }) : f,
        ),
      }),
    })),

  updateFurnitureLive: (id, patch) =>
    set((state) => ({
      project: touch({
        ...state.project,
        furniture: state.project.furniture.map((f) =>
          f.id === id ? sanitizeFurniture({ ...f, ...patch }) : f,
        ),
      }),
    })),

  removeFurniture: (id) =>
    set((state) => ({
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
      future: [],
      project: touch({
        ...state.project,
        furniture: state.project.furniture.filter((f) => f.id !== id),
      }),
    })),

  duplicateFurniture: (id) => {
    const state = get();
    const source = state.project.furniture.find((f) => f.id === id);
    if (!source) return null;
    const copy: FurnitureObject = {
      ...source,
      id: uid('furn'),
      name: `${source.name} copy`,
      x: Math.min(state.project.room.width, source.x + 200),
      y: Math.min(state.project.room.length, source.y + 200),
      locked: false,
    };
    set((current) => ({
      past: [...current.past.slice(-(HISTORY_LIMIT - 1)), current.project],
      future: [],
      project: touch({ ...current.project, furniture: [...current.project.furniture, copy] }),
    }));
    return copy.id;
  },

  rotateFurniture: (id, direction = 'cw') =>
    set((state) => ({
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
      future: [],
      project: touch({
        ...state.project,
        furniture: state.project.furniture.map((f) =>
          f.id === id && !f.locked ? rotateObject(f, direction) : f,
        ),
      }),
    })),

  toggleLock: (id) =>
    set((state) => ({
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
      future: [],
      project: touch({
        ...state.project,
        furniture: state.project.furniture.map((f) =>
          f.id === id ? { ...f, locked: !f.locked } : f,
        ),
      }),
    })),

  addOpening: (kind, wall = 'south') => {
    const opening: Opening = {
      id: uid('opening'),
      kind,
      name: kind === 'door' ? 'Door' : 'Window',
      wall,
      offset: 0,
      width: kind === 'door' ? 850 : 1200,
      height: kind === 'door' ? 2100 : 1200,
      hinge: 'start',
      swing: 'in',
    };
    set((state) => {
      const wallLength =
        wall === 'north' || wall === 'south' ? state.project.room.width : state.project.room.length;
      opening.offset = Math.max(0, Math.round((wallLength - opening.width) / 2));
      return {
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
        future: [],
        project: touch({ ...state.project, openings: [...state.project.openings, opening] }),
      };
    });
    return opening.id;
  },

  updateOpening: (id, patch) =>
    set((state) => ({
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
      future: [],
      project: touch({
        ...state.project,
        openings: state.project.openings.map((opening) => {
          if (opening.id !== id) return opening;
          const next = { ...opening, ...patch };
          const wallLength =
            next.wall === 'north' || next.wall === 'south'
              ? state.project.room.width
              : state.project.room.length;
          next.width = Math.max(200, Math.min(next.width, wallLength));
          next.offset = Math.max(0, Math.min(next.offset, wallLength - next.width));
          return next;
        }),
      }),
    })),

  updateOpeningLive: (id, patch) =>
    set((state) => ({
      project: touch({
        ...state.project,
        openings: state.project.openings.map((opening) => {
          if (opening.id !== id) return opening;
          const next = { ...opening, ...patch };
          const wallLength =
            next.wall === 'north' || next.wall === 'south'
              ? state.project.room.width
              : state.project.room.length;
          next.width = Math.max(200, Math.min(next.width, wallLength));
          next.offset = Math.max(0, Math.min(next.offset, wallLength - next.width));
          return next;
        }),
      }),
    })),

  removeOpening: (id) =>
    set((state) => ({
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
      future: [],
      project: touch({
        ...state.project,
        openings: state.project.openings.filter((opening) => opening.id !== id),
      }),
    })),

  updateSettings: (patch) =>
    set((state) => ({
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
      future: [],
      project: touch({ ...state.project, settings: { ...state.project.settings, ...patch } }),
    })),

  updateClearances: (patch) =>
    set((state) => ({
      project: touch({
        ...state.project,
        settings: {
          ...state.project.settings,
          clearances: { ...state.project.settings.clearances, ...patch },
        },
      }),
    })),

  applyQuickFit: ({ width, length, keepExisting, object }) =>
    set((state) => {
      const room = {
        ...state.project.room,
        width: Math.max(1000, Math.round(width)),
        length: Math.max(1000, Math.round(length)),
      };
      const openings = state.project.openings.map((opening) => {
        const maxOffset = Math.max(
          0,
          (opening.wall === 'north' || opening.wall === 'south' ? room.width : room.length) -
            opening.width,
        );
        return { ...opening, offset: Math.min(opening.offset, maxOffset) };
      });
      return {
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
        future: [],
        project: touch({
          ...state.project,
          room,
          openings,
          furniture: keepExisting
            ? [...state.project.furniture, object]
            : [object],
        }),
      };
    }),

  saveLayout: (name) =>
    set((state) => {
      const layout: LayoutSnapshot = {
        id: uid('layout'),
        name: name.trim() || `Layout ${state.project.layouts.length + 1}`,
        furniture: cloneFurniture(state.project.furniture),
        createdAt: Date.now(),
      };
      return {
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
        future: [],
        project: touch({
          ...state.project,
          layouts: [...state.project.layouts, layout],
          activeLayoutId: layout.id,
        }),
      };
    }),

  applyLayout: (id) =>
    set((state) => {
      const layout = state.project.layouts.find((l) => l.id === id);
      if (!layout) return state;
      return {
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
        future: [],
        project: touch({
          ...state.project,
          furniture: cloneFurniture(layout.furniture),
          activeLayoutId: layout.id,
        }),
      };
    }),

  renameLayout: (id, name) =>
    set((state) => ({
      project: touch({
        ...state.project,
        layouts: state.project.layouts.map((layout) =>
          layout.id === id ? { ...layout, name: name.trim() || layout.name } : layout,
        ),
      }),
    })),

  deleteLayout: (id) =>
    set((state) => ({
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
      future: [],
      project: touch({
        ...state.project,
        layouts: state.project.layouts.filter((layout) => layout.id !== id),
        activeLayoutId: state.project.activeLayoutId === id ? null : state.project.activeLayoutId,
      }),
    })),

  duplicateLayout: (id) =>
    set((state) => {
      const layout = state.project.layouts.find((l) => l.id === id);
      if (!layout) return state;
      const copy: LayoutSnapshot = {
        ...layout,
        id: uid('layout'),
        name: `${layout.name} copy`,
        furniture: cloneFurniture(layout.furniture).map((f) => ({ ...f, id: uid('furn') })),
        createdAt: Date.now(),
      };
      return {
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project],
        future: [],
        project: touch({ ...state.project, layouts: [...state.project.layouts, copy] }),
      };
    }),

  setSaveStatus: (status, error = null) =>
    set({ saveStatus: status, storageError: error }),

  markSaved: () => set({ saveStatus: 'saved', lastSavedAt: Date.now(), storageError: null }),
}));

function sanitizeFurniture(f: FurnitureObject): FurnitureObject {
  return {
    ...f,
    width: Math.max(100, Math.round(f.width)),
    depth: Math.max(100, Math.round(f.depth)),
    x: Math.round(f.x),
    y: Math.round(f.y),
  };
}

export function currentProjectSnapshot(): Project {
  return useProjectStore.getState().project;
}

/** Build a throwaway project around an alternative layout for comparison. */
export function projectWithLayout(project: Project, furniture: FurnitureObject[]): Project {
  return {
    ...project,
    schemaVersion: SCHEMA_VERSION,
    furniture: cloneFurniture(furniture),
  };
}
