import { describe, expect, it } from 'vitest';
import type { FurnitureObject, Opening, Project, Room } from '@/types';
import {
  clampCenterIntoRoom,
  effectiveSize,
  footprint,
  rectDistance,
  rectInside,
  rectsOverlap,
  rectToRoomEdges,
  rectWidth,
  rotateObject,
  roomRect,
  unionArea,
} from '@/engine/geometry';
import {
  doorApproachZone,
  doorSweep,
  openingBlocksObject,
  openingEnd,
  openingStart,
  rectIntersectsSweep,
} from '@/engine/openings';
import {
  availableClearance,
  evaluateClearance,
  evaluateDoorApproach,
  zonesForObject,
} from '@/engine/clearance';
import { analyzeProject } from '@/engine/fit-analysis';
import { createBlankProject } from '@/features/project-manager/defaults';

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    name: 'Test room',
    width: 3000,
    length: 3600,
    ceilingHeight: 2700,
    wallThickness: 120,
    ...overrides,
  };
}

function makeFurniture(overrides: Partial<FurnitureObject> = {}): FurnitureObject {
  return {
    id: 'furn_test',
    name: 'Test object',
    kind: 'custom',
    category: 'Custom',
    x: 500,
    y: 500,
    width: 1000,
    depth: 1000,
    rotation: 0,
    color: '#000000',
    locked: false,
    ...overrides,
  };
}

function makeDoor(overrides: Partial<Opening> = {}): Opening {
  return {
    id: 'door_test',
    kind: 'door',
    name: 'Door',
    wall: 'south',
    offset: 1000,
    width: 800,
    height: 2100,
    hinge: 'start',
    swing: 'in',
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  const base = createBlankProject('Test project');
  return { ...base, openings: [], furniture: [], ...overrides };
}

describe('footprints and basic geometry', () => {
  it('builds an axis-aligned footprint around the centre for 0°', () => {
    const rect = footprint(makeFurniture({ x: 1000, y: 1000, width: 1600, depth: 2000 }));
    expect(rect).toEqual({ x1: 200, y1: 0, x2: 1800, y2: 2000 });
    expect(rectWidth(rect)).toBe(1600);
  });

  it('swaps width and depth for a 90° rotation', () => {
    const rect = footprint(
      makeFurniture({ x: 1000, y: 1000, width: 1600, depth: 2000, rotation: 90 }),
    );
    expect(rect).toEqual({ x1: 0, y1: 200, x2: 2000, y2: 1800 });
  });

  it('reports the world size for 180° and 270°', () => {
    expect(effectiveSize(makeFurniture({ width: 1600, depth: 2000, rotation: 180 }))).toEqual({
      width: 1600,
      depth: 2000,
    });
    expect(effectiveSize(makeFurniture({ width: 1600, depth: 2000, rotation: 270 }))).toEqual({
      width: 2000,
      depth: 1600,
    });
  });

  it('does not treat touching edges as a collision', () => {
    const a = { x1: 0, y1: 0, x2: 100, y2: 100 };
    expect(rectsOverlap(a, { x1: 100, y1: 0, x2: 200, y2: 100 })).toBe(false);
  });

  it('ignores sub-epsilon hairline overlaps but catches physical overlap', () => {
    const a = { x1: 0, y1: 0, x2: 100, y2: 100 };
    expect(rectsOverlap(a, { x1: 99.9, y1: 0, x2: 200, y2: 100 })).toBe(false);
    expect(rectsOverlap(a, { x1: 99, y1: 0, x2: 200, y2: 100 })).toBe(true);
  });

  it('measures shortest distance for edge-to-edge and corner-to-corner gaps', () => {
    const a = { x1: 0, y1: 0, x2: 100, y2: 100 };
    expect(rectDistance(a, { x1: 200, y1: 0, x2: 300, y2: 100 })).toBe(100);
    expect(rectDistance(a, { x1: 200, y1: 200, x2: 300, y2: 300 })).toBeCloseTo(Math.SQRT2 * 100);
  });

  it('counts overlapping rectangles only once in the union area', () => {
    const a = { x1: 0, y1: 0, x2: 1000, y2: 1000 };
    const b = { x1: 500, y1: 0, x2: 1500, y2: 1000 };
    expect(unionArea([a, b])).toBe(1_500_000);
    expect(unionArea([])).toBe(0);
  });

  it('sums disjoint rectangle areas exactly', () => {
    expect(
      unionArea([
        { x1: 0, y1: 0, x2: 1000, y2: 1000 },
        { x1: 2000, y1: 0, x2: 3000, y2: 1000 },
      ]),
    ).toBe(2_000_000);
  });

  it('checks containment and room-edge distances', () => {
    const room = makeRoom();
    const rect = footprint(makeFurniture({ x: 500, y: 400, width: 1000, depth: 800 }));
    expect(rectInside(rect, roomRect(room))).toBe(true);
    expect(rectToRoomEdges(rect, room)).toEqual({ left: 0, top: 0, right: 2000, bottom: 2800 });
  });

  it('rotates clockwise and counter-clockwise with wrapping', () => {
    expect(rotateObject(makeFurniture(), 'cw').rotation).toBe(90);
    expect(rotateObject(makeFurniture({ rotation: 270 }), 'cw').rotation).toBe(0);
    expect(rotateObject(makeFurniture({ rotation: 0 }), 'ccw').rotation).toBe(270);
  });

  it('clamps an object centre back inside a resized room', () => {
    const centre = clampCenterIntoRoom(
      makeFurniture({ x: -100, y: 4000, width: 1000, depth: 500 }),
      makeRoom(),
    );
    expect(centre).toEqual({ x: 500, y: 3350 });
  });
});

describe('openings and door swings', () => {
  it('maps opening offsets to south and east wall coordinates', () => {
    const room = makeRoom();
    const south = makeDoor({ offset: 1000, width: 800 });
    expect(openingStart(south, room)).toEqual({ x: 1000, y: 3600 });
    expect(openingEnd(south, room)).toEqual({ x: 1800, y: 3600 });

    const east = makeDoor({ kind: 'window', wall: 'east', offset: 500, width: 1200 });
    expect(openingStart(east, room)).toEqual({ x: 3000, y: 500 });
    expect(openingEnd(east, room)).toEqual({ x: 3000, y: 1700 });
  });

  it('describes an inward south door as a quarter disc', () => {
    const sweep = doorSweep(makeDoor(), makeRoom());
    expect(sweep.hinge).toEqual({ x: 1000, y: 3600 });
    expect(sweep.radius).toBe(800);
    expect(sweep.closedTip).toEqual({ x: 1800, y: 3600 });
    expect(sweep.openTip).toEqual({ x: 1000, y: 2800 });
    expect(sweep.startAngle).toBeCloseTo(0);
    expect(sweep.delta).toBeCloseTo(-Math.PI / 2);
    expect(sweep.inward).toBe(true);
  });

  it('detects an object inside the door sweep and ignores a distant one', () => {
    const room = makeRoom();
    const sweep = doorSweep(makeDoor(), room);
    const inside = footprint(makeFurniture({ x: 1200, y: 3200, width: 200, depth: 200 }));
    const outside = footprint(makeFurniture({ x: 2500, y: 1000, width: 400, depth: 400 }));
    expect(rectIntersectsSweep(inside, sweep)).toBe(true);
    expect(rectIntersectsSweep(outside, sweep)).toBe(false);
  });

  it('never blocks circulation for a window', () => {
    const window = makeDoor({ kind: 'window', wall: 'south' });
    expect(openingBlocksObject(window, makeRoom(), makeFurniture({ x: 1400, y: 3200 }))).toBe(
      false,
    );
  });

  it('reserves an approach corridor on the room side of a door', () => {
    const zone = doorApproachZone(makeDoor(), makeRoom(), 800);
    expect(zone).toEqual({ x1: 1000, y1: 2800, x2: 1800, y2: 3600 });
  });
});

describe('clearance and door-approach checks', () => {
  it('limits available access depth to the room boundary', () => {
    const room = makeRoom({ width: 3000, length: 3000 });
    const desk = makeFurniture({
      kind: 'desk',
      x: 1000,
      y: 2400,
      width: 1200,
      depth: 600,
    });
    const project = makeProject({ room });
    const zones = zonesForObject(desk, project.settings.clearances);
    const result = availableClearance(zones[0], [desk], room);
    expect(result.available).toBe(300);
  });

  it('measures the free depth before a blocking object', () => {
    const room = makeRoom({ width: 3000, length: 3000 });
    const desk = makeFurniture({
      kind: 'desk',
      x: 1000,
      y: 500,
      width: 1200,
      depth: 600,
    });
    const cabinet = makeFurniture({
      id: 'furn_cabinet',
      kind: 'cabinet',
      x: 1000,
      y: 1100,
      width: 1200,
      depth: 400,
    });
    const zones = zonesForObject(desk, makeProject().settings.clearances);
    const result = availableClearance(zones[0], [desk, cabinet], room);
    expect(result.available).toBe(100);
    expect(result.blockedBy?.id).toBe('furn_cabinet');
  });

  it('marks a clearance check as failing below its target', () => {
    const room = makeRoom({ width: 3000, length: 3000 });
    const desk = makeFurniture({
      kind: 'desk',
      x: 1000,
      y: 500,
      width: 1200,
      depth: 600,
    });
    const cabinet = makeFurniture({
      id: 'furn_cabinet',
      kind: 'cabinet',
      x: 1000,
      y: 1100,
      width: 1200,
      depth: 400,
    });
    const project = makeProject({ room });
    const zones = zonesForObject(desk, project.settings.clearances);
    const [check] = evaluateClearance(zones, [desk, cabinet], room, project.settings.clearances);
    expect(check.target).toBe(800);
    expect(check.available).toBe(100);
    expect(check.ok).toBe(false);
  });

  it('groups the two bed sides as an "any side" requirement', () => {
    const zones = zonesForObject(
      makeFurniture({ kind: 'bed', width: 1600, depth: 2000 }),
      makeProject().settings.clearances,
    );
    expect(zones).toHaveLength(2);
    expect(zones.every((zone) => zone.group === 'sides_furn_test')).toBe(true);
    expect(zones.every((zone) => zone.groupMode === 'any')).toBe(true);
  });

  it('reports a door approach narrowed by furniture', () => {
    const room = makeRoom();
    const blocker = makeFurniture({
      id: 'furn_blocker',
      x: 1400,
      y: 3100,
      width: 400,
      depth: 400,
    });
    const report = evaluateDoorApproach(makeDoor(), room, [blocker], 600);
    expect(report.doorBlocked).toBe(true);
    expect(report.approachWidth).toBe(400);
    expect(report.blockers).toEqual(['furn_blocker']);
  });
});

describe('project fit analysis', () => {
  it('reports a comfortable layout when physical checks and clearances pass', () => {
    const desk = makeFurniture({
      id: 'furn_desk',
      kind: 'desk',
      x: 1000,
      y: 500,
      width: 1200,
      depth: 600,
    });
    const result = analyzeProject(
      makeProject({ room: makeRoom({ width: 4000, length: 4000 }), furniture: [desk] }),
    );
    expect(result.status).toBe('comfortable');
    expect(result.statusLabel).toBe('Fits comfortably');
    expect(result.collisions).toHaveLength(0);
    expect(result.clearanceChecks.every((check) => check.ok)).toBe(true);
  });

  it('reports warnings as "Fits, but tight" without claiming comfort', () => {
    const desk = makeFurniture({
      id: 'furn_desk',
      kind: 'desk',
      x: 1000,
      y: 1000,
      width: 1200,
      depth: 600,
    });
    const result = analyzeProject(
      makeProject({ room: makeRoom({ width: 2000, length: 2000 }), furniture: [desk] }),
    );
    expect(result.status).toBe('tight');
    expect(result.issues.some((issue) => issue.severity === 'warning')).toBe(true);
    expect(result.issues.some((issue) => issue.category === 'clearance')).toBe(true);
  });

  it('reports overlapping furniture as "Doesn\'t fit"', () => {
    const a = makeFurniture({ id: 'furn_a', x: 2000, y: 2000 });
    const b = makeFurniture({ id: 'furn_b', x: 2000, y: 2000 });
    const result = analyzeProject(
      makeProject({ room: makeRoom({ width: 4000, length: 4000 }), furniture: [a, b] }),
    );
    expect(result.status).toBe('no-fit');
    expect(result.collisions).toHaveLength(1);
    expect(result.occupiedArea).toBe(1_000_000);
    expect(result.issues.some((issue) => issue.category === 'collision')).toBe(true);
  });

  it('reports furniture outside the boundary as an error', () => {
    const object = makeFurniture({ id: 'furn_edge', x: 0, y: 0, width: 1000, depth: 1000 });
    const result = analyzeProject(
      makeProject({ room: makeRoom({ width: 4000, length: 4000 }), furniture: [object] }),
    );
    expect(result.status).toBe('no-fit');
    expect(result.issues.some((issue) => issue.category === 'boundary')).toBe(true);
  });

  it('reports an obstructed door swing as "Doesn\'t fit"', () => {
    const room = makeRoom();
    const object = makeFurniture({ id: 'furn_swing', x: 1400, y: 3100, width: 800, depth: 400 });
    const result = analyzeProject(
      makeProject({ room, openings: [makeDoor()], furniture: [object] }),
    );
    expect(result.status).toBe('no-fit');
    expect(result.doorChecks[0].blocked).toBe(true);
    expect(result.issues.some((issue) => issue.category === 'opening')).toBe(true);
  });

  it('asks for review when there is no furniture to analyse', () => {
    const result = analyzeProject(makeProject());
    expect(result.status).toBe('review');
    expect(result.objectCount).toBe(0);
    expect(result.issues.some((issue) => issue.id === 'review_empty')).toBe(true);
  });

  it('adds an informational note when no door has been placed', () => {
    const desk = makeFurniture({
      id: 'furn_desk',
      kind: 'desk',
      x: 1000,
      y: 500,
      width: 1200,
      depth: 600,
    });
    const result = analyzeProject(
      makeProject({ room: makeRoom({ width: 4000, length: 4000 }), furniture: [desk] }),
    );
    const note = result.issues.find((issue) => issue.id === 'review_no_door');
    expect(note?.severity).toBe('info');
    expect(result.status).toBe('comfortable');
  });

  it('counts overlapping footprints once in the occupied area', () => {
    const a = makeFurniture({ id: 'furn_a', x: 2000, y: 2000 });
    const b = makeFurniture({ id: 'furn_b', x: 2500, y: 2000 });
    const result = analyzeProject(
      makeProject({ room: makeRoom({ width: 4000, length: 4000 }), furniture: [a, b] }),
    );
    expect(result.roomArea).toBe(16_000_000);
    expect(result.occupiedArea).toBe(1_500_000);
    expect(result.occupancyPct).toBeCloseTo((1_500_000 / 16_000_000) * 100);
  });
});
