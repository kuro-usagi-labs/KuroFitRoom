import { beforeEach, describe, expect, it } from 'vitest';
import type { FurnitureObject } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import { createBlankProject } from '@/features/project-manager/defaults';
import { snapOffset, snapPosition } from '@/engine/snapping';
import { footprint } from '@/engine/geometry';

function makeObject(overrides: Partial<FurnitureObject> = {}): FurnitureObject {
  return {
    id: 'furn_test',
    name: 'Test object',
    kind: 'desk',
    category: 'Office',
    x: 500,
    y: 500,
    width: 1000,
    depth: 600,
    rotation: 0,
    color: '#DCC8AA',
    locked: false,
    ...overrides,
  };
}

function resetStores() {
  useProjectStore.setState({
    project: createBlankProject('Test project'),
    past: [],
    future: [],
    saveStatus: 'idle',
    lastSavedAt: null,
    storageError: null,
  });
  useEditorStore.setState({
    appMode: 'designer',
    activePanel: 'room',
    tool: 'select',
    selectedFurnitureId: null,
    selectedOpeningId: null,
    inspectorOpen: false,
    measurements: [],
    measureStart: null,
    measureDraft: null,
  });
}

beforeEach(resetStores);

describe('project history', () => {
  it('undoes and redoes a committed furniture change', () => {
    const { addFurniture } = useProjectStore.getState();
    addFurniture({
      name: 'Desk',
      kind: 'desk',
      category: 'Office',
      width: 1200,
      depth: 600,
      color: '#DCC8AA',
    });
    expect(useProjectStore.getState().project.furniture).toHaveLength(1);
    expect(useProjectStore.getState().canUndo()).toBe(true);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.furniture).toHaveLength(0);
    expect(useProjectStore.getState().canRedo()).toBe(true);

    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project.furniture).toHaveLength(1);
  });

  it('treats a drag made of many live moves as one undo step', () => {
    const { addFurniture } = useProjectStore.getState();
    const object = addFurniture(
      {
        name: 'Desk',
        kind: 'desk',
        category: 'Office',
        width: 1200,
        depth: 600,
        color: '#DCC8AA',
      },
      { x: 600, y: 600 },
    );
    const historyBeforeDrag = useProjectStore.getState().past.length;

    useProjectStore.getState().beginHistory();
    useProjectStore.getState().moveFurnitureLive(object.id, 900, 900);
    useProjectStore.getState().moveFurnitureLive(object.id, 1200, 1100);

    expect(useProjectStore.getState().project.furniture[0].x).toBe(1200);
    expect(useProjectStore.getState().past).toHaveLength(historyBeforeDrag + 1);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.furniture[0].x).toBe(600);
    expect(useProjectStore.getState().past).toHaveLength(historyBeforeDrag);
  });

  it('does not create history entries for live updates', () => {
    const object = makeObject();
    useProjectStore.setState({ project: { ...useProjectStore.getState().project, furniture: [object] } });
    const before = useProjectStore.getState().past.length;
    useProjectStore.getState().updateFurnitureLive(object.id, { x: 800 });
    expect(useProjectStore.getState().past).toHaveLength(before);
    expect(useProjectStore.getState().project.furniture[0].x).toBe(800);
  });

  it('rounds and clamps edited furniture dimensions to whole millimetres', () => {
    const object = makeObject();
    useProjectStore.setState({ project: { ...useProjectStore.getState().project, furniture: [object] } });
    useProjectStore.getState().updateFurniture(object.id, {
      width: 10,
      depth: 5,
      x: 100.4,
      y: 200.6,
    });
    const updated = useProjectStore.getState().project.furniture[0];
    expect(updated.width).toBe(100);
    expect(updated.depth).toBe(100);
    expect(updated.x).toBe(100);
    expect(updated.y).toBe(201);
  });

  it('rotates unlocked furniture but never locked furniture', () => {
    const object = makeObject({ locked: true });
    useProjectStore.setState({ project: { ...useProjectStore.getState().project, furniture: [object] } });

    useProjectStore.getState().rotateFurniture(object.id);
    expect(useProjectStore.getState().project.furniture[0].rotation).toBe(0);

    useProjectStore.getState().toggleLock(object.id);
    useProjectStore.getState().rotateFurniture(object.id);
    expect(useProjectStore.getState().project.furniture[0].rotation).toBe(90);
  });
});

describe('room and opening mutations', () => {
  it('enforces a minimum room size and clamps doors to the new wall', () => {
    useProjectStore.getState().setRoom({ width: 400, length: 400 });
    const state = useProjectStore.getState().project;
    expect(state.room.width).toBe(1000);
    expect(state.room.length).toBe(1000);
    expect(state.openings[0].offset).toBe(150);
  });

  it('centres a newly added opening on its wall', () => {
    const id = useProjectStore.getState().addOpening('window', 'south');
    const opening = useProjectStore.getState().project.openings.find((item) => item.id === id);
    expect(opening?.kind).toBe('window');
    expect(opening?.width).toBe(1200);
    expect(opening?.offset).toBe(900);
  });

  it('clamps opening width and offset to the wall', () => {
    const door = useProjectStore.getState().project.openings[0];
    useProjectStore.getState().updateOpening(door.id, { offset: -500, width: 9000 });
    const updated = useProjectStore.getState().project.openings[0];
    expect(updated.width).toBe(3000);
    expect(updated.offset).toBe(0);
  });
});

describe('Quick Fit apply', () => {
  const quickObject = makeObject({
    id: 'furn_quick_fit',
    name: 'Quick bed',
    kind: 'bed',
    category: 'Bedroom',
    x: 800,
    y: 1000,
    width: 1600,
    depth: 2000,
    color: '#F1ECE3',
  });

  it('replaces the furniture while adopting the quick-fit room', () => {
    useProjectStore.getState().addFurniture({
      name: 'Old desk',
      kind: 'desk',
      category: 'Office',
      width: 1200,
      depth: 600,
      color: '#DCC8AA',
    });

    useProjectStore.getState().applyQuickFit({
      width: 2800,
      length: 3200,
      keepExisting: false,
      object: quickObject,
    });

    const state = useProjectStore.getState().project;
    expect(state.room.width).toBe(2800);
    expect(state.room.length).toBe(3200);
    expect(state.furniture).toEqual([quickObject]);
  });

  it('keeps existing furniture when requested', () => {
    useProjectStore.getState().addFurniture({
      name: 'Old desk',
      kind: 'desk',
      category: 'Office',
      width: 1200,
      depth: 600,
      color: '#DCC8AA',
    });

    useProjectStore.getState().applyQuickFit({
      width: 3000,
      length: 3600,
      keepExisting: true,
      object: quickObject,
    });

    const furniture = useProjectStore.getState().project.furniture;
    expect(furniture).toHaveLength(2);
    expect(furniture[1]).toEqual(quickObject);
  });
});

describe('layout snapshots', () => {
  it('saves and restores a furniture layout', () => {
    const { addFurniture } = useProjectStore.getState();
    const object = addFurniture(
      {
        name: 'Desk',
        kind: 'desk',
        category: 'Office',
        width: 1200,
        depth: 600,
        color: '#DCC8AA',
      },
      { x: 600, y: 600 },
    );
    useProjectStore.getState().saveLayout('Plan A');
    const layout = useProjectStore.getState().project.layouts[0];
    expect(layout.name).toBe('Plan A');
    expect(useProjectStore.getState().project.activeLayoutId).toBe(layout.id);

    useProjectStore.getState().updateFurniture(object.id, { x: 1800 });
    expect(useProjectStore.getState().project.furniture[0].x).toBe(1800);

    useProjectStore.getState().applyLayout(layout.id);
    expect(useProjectStore.getState().project.furniture[0].x).toBe(600);
  });
});

describe('editor state and snapping', () => {
  it('keeps furniture and opening selection mutually exclusive', () => {
    useEditorStore.getState().selectFurniture('furn_a');
    expect(useEditorStore.getState().selectedFurnitureId).toBe('furn_a');
    expect(useEditorStore.getState().inspectorOpen).toBe(true);

    useEditorStore.getState().selectOpening('door_a');
    expect(useEditorStore.getState().selectedFurnitureId).toBeNull();
    expect(useEditorStore.getState().selectedOpeningId).toBe('door_a');
    expect(useEditorStore.getState().inspectorOpen).toBe(true);
  });

  it('records a measurement in millimetres and ignores tiny drags', () => {
    useEditorStore.getState().startMeasure({ x: 0, y: 0 });
    useEditorStore.getState().finishMeasure({ x: 300, y: 400 });
    expect(useEditorStore.getState().measurements[0].distance).toBe(500);

    useEditorStore.getState().startMeasure({ x: 0, y: 0 });
    useEditorStore.getState().finishMeasure({ x: 4, y: 4 });
    expect(useEditorStore.getState().measurements).toHaveLength(1);
    expect(useEditorStore.getState().measureStart).toBeNull();
  });

  it('snaps to the nearest wall before falling back to the grid', () => {
    const result = snapPosition(
      { x: 550, y: 550 },
      1000,
      500,
      createBlankProject().room,
      [],
      { threshold: 100, gridSize: 100, snapGrid: true, snapWalls: true, snapObjects: true },
    );
    expect(result.x).toBe(500);
    expect(result.y).toBe(600);
    expect(result.guides).toEqual([{ axis: 'x', value: 0, type: 'wall' }]);
  });

  it('aligns a dragged object to a neighbour edge', () => {
    const neighbour = makeObject({ id: 'furn_neighbour', x: 2500, y: 2500, width: 1000, depth: 1000 });
    const result = snapPosition(
      { x: 2720, y: 2720 },
      600,
      600,
      createBlankProject().room,
      [neighbour],
      { threshold: 50, gridSize: 100, snapGrid: false, snapWalls: false, snapObjects: true },
    );
    expect(result.x).toBe(2700);
    expect(result.y).toBe(2700);
    expect(result.guides).toEqual([
      { axis: 'x', value: 3000, type: 'object' },
      { axis: 'y', value: 3000, type: 'object' },
    ]);
    expect(footprint({ ...makeObject(), x: result.x, y: result.y, width: 600, depth: 600 })).toEqual(
      { x1: 2400, y1: 2400, x2: 3000, y2: 3000 },
    );
  });

  it('clamps and grid-snaps wall offsets for openings', () => {
    expect(snapOffset(3049, 3000, 100)).toBe(3000);
    expect(snapOffset(-50, 3000, 100)).toBe(0);
    expect(snapOffset(1249, 3000, 100)).toBe(1200);
  });
});
