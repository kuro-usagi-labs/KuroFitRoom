import { create } from 'zustand';
import type { SnapGuide } from '@/engine/snapping';

export type PanelId = 'room' | 'furnish' | 'openings' | 'measure' | 'layouts' | 'settings';
export type EditorTool = 'select' | 'pan' | 'measure';
export type AppMode = 'designer' | 'quickfit';

export interface MeasurementLine {
  id: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
  distance: number;
}

export interface Viewport {
  /** Pixels per millimetre. */
  scale: number;
  tx: number;
  ty: number;
}

export const MIN_SCALE = 0.02;
export const MAX_SCALE = 1.5;
/** Scale that maps to 100 % in the zoom readout (1 cm = 2.5 px). */
export const ZOOM_BASE = 0.25;

interface EditorState {
  appMode: AppMode;
  activePanel: PanelId;
  tool: EditorTool;
  selectedFurnitureId: string | null;
  selectedOpeningId: string | null;
  viewport: Viewport;
  fitRequest: number;
  guides: SnapGuide[];
  measurements: MeasurementLine[];
  measureStart: { x: number; y: number } | null;
  measureDraft: { x: number; y: number } | null;
  showClearanceZones: boolean;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  quickFitOpen: boolean;

  setMode: (mode: AppMode) => void;
  setPanel: (panel: PanelId) => void;
  setTool: (tool: EditorTool) => void;
  selectFurniture: (id: string | null) => void;
  selectOpening: (id: string | null) => void;
  clearSelection: () => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  requestFit: () => void;
  setGuides: (guides: SnapGuide[]) => void;
  addMeasurement: (line: MeasurementLine) => void;
  startMeasure: (point: { x: number; y: number }) => void;
  updateMeasure: (point: { x: number; y: number }) => void;
  finishMeasure: (point?: { x: number; y: number }) => void;
  cancelMeasure: () => void;
  removeMeasurement: (id: string) => void;
  clearMeasurements: () => void;
  toggleSidebar: (open?: boolean) => void;
  toggleInspector: (open?: boolean) => void;
  setQuickFitOpen: (open: boolean) => void;
  setShowClearanceZones: (show: boolean) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  appMode: 'designer',
  activePanel: 'room',
  tool: 'select',
  selectedFurnitureId: null,
  selectedOpeningId: null,
  viewport: { scale: 0.2, tx: 80, ty: 80 },
  fitRequest: 0,
  guides: [],
  measurements: [],
  measureStart: null,
  measureDraft: null,
  showClearanceZones: true,
  sidebarOpen: true,
  inspectorOpen: false,
  quickFitOpen: false,

  setMode: (mode) => set({ appMode: mode }),
  setPanel: (panel) => set({ activePanel: panel, sidebarOpen: true }),
  setTool: (tool) =>
    set({
      tool,
      measureStart: null,
      measureDraft: null,
    }),
  selectFurniture: (id) =>
    set({ selectedFurnitureId: id, selectedOpeningId: null, inspectorOpen: Boolean(id) }),
  selectOpening: (id) =>
    set({ selectedOpeningId: id, selectedFurnitureId: null, inspectorOpen: Boolean(id) }),
  clearSelection: () => set({ selectedFurnitureId: null, selectedOpeningId: null }),
  setViewport: (viewport) =>
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    })),
  requestFit: () => set((state) => ({ fitRequest: state.fitRequest + 1 })),
  setGuides: (guides) => set({ guides }),

  addMeasurement: (line) =>
    set((state) => ({ measurements: [...state.measurements, line], measureStart: null, measureDraft: null })),

  startMeasure: (point) => set({ measureStart: point, measureDraft: point }),
  updateMeasure: (point) =>
    set((state) => ({
      measureDraft: state.measureStart ? point : state.measureStart,
    })),
  finishMeasure: (point) => {
    const state = get();
    if (!state.measureStart) return;
    const end = point ?? state.measureDraft ?? state.measureStart;
    const distance = Math.round(
      Math.hypot(end.x - state.measureStart.x, end.y - state.measureStart.y),
    );
    if (distance < 10) {
      set({ measureStart: null, measureDraft: null });
      return;
    }
    set((current) => ({
      measurements: [
        ...current.measurements,
        {
          id: `measure_${Date.now()}_${current.measurements.length}`,
          a: state.measureStart as { x: number; y: number },
          b: end,
          distance,
        },
      ],
      measureStart: null,
      measureDraft: null,
    }));
  },
  cancelMeasure: () => set({ measureStart: null, measureDraft: null }),

  removeMeasurement: (id) =>
    set((state) => ({ measurements: state.measurements.filter((m) => m.id !== id) })),
  clearMeasurements: () => set({ measurements: [], measureDraft: null }),
  toggleSidebar: (open) =>
    set((state) => ({ sidebarOpen: open ?? !state.sidebarOpen })),
  toggleInspector: (open) =>
    set((state) => ({ inspectorOpen: open ?? !state.inspectorOpen })),
  setQuickFitOpen: (open) => set({ quickFitOpen: open }),
  setShowClearanceZones: (show) => set({ showClearanceZones: show }),
}));
