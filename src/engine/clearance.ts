import type {
  ClearanceCheck,
  ClearanceSettings,
  FurnitureKind,
  FurnitureObject,
  Opening,
  Rect,
  Room,
} from '@/types';
import { footprint, rectsOverlap } from './geometry';
import { doorApproachZone, openingBlocksObject } from './openings';

/**
 * Clearance heuristics. These values are defaults, not universal standards.
 * They are intentionally configurable in the Measure panel.
 */

export interface UsageProfile {
  mode: 'front' | 'sides' | 'none';
  depth: number;
  label: string;
}

export function usageProfile(
  kind: FurnitureKind,
  clearances: ClearanceSettings,
): UsageProfile {
  switch (kind) {
    case 'bed':
      return { mode: 'sides', depth: clearances.bedside, label: 'Bedside access' };
    case 'desk':
      return { mode: 'front', depth: clearances.chair, label: 'Chair space' };
    case 'chair':
      return { mode: 'front', depth: 500, label: 'Chair access' };
    case 'wardrobe':
      return { mode: 'front', depth: 800, label: 'Wardrobe door opening' };
    case 'dresser':
      return { mode: 'front', depth: 700, label: 'Drawer opening' };
    case 'drawers':
      return { mode: 'front', depth: 700, label: 'Drawer opening' };
    case 'cabinet':
      return { mode: 'front', depth: 700, label: 'Cabinet door opening' };
    case 'bookshelf':
      return { mode: 'front', depth: 700, label: 'Shelf access' };
    case 'nightstand':
      return { mode: 'front', depth: 500, label: 'Nightstand access' };
    case 'sofa':
      return { mode: 'front', depth: clearances.walkwayComfortable, label: 'Seating space' };
    case 'coffee-table':
      return { mode: 'front', depth: 450, label: 'Passage around table' };
    case 'tv-cabinet':
      return { mode: 'front', depth: 600, label: 'Viewing distance / access' };
    case 'side-table':
      return { mode: 'front', depth: 350, label: 'Side table access' };
    case 'storage-rack':
      return { mode: 'front', depth: clearances.walkwayLimited, label: 'Rack access' };
    case 'custom':
      return { mode: 'none', depth: 0, label: 'Custom object' };
  }
}

export interface UsageZone {
  id: string;
  objectId: string;
  label: string;
  target: number;
  /** Axis along which depth is measured. */
  axis: 'x' | 'y';
  /** +1 means increasing coordinate, -1 decreasing. */
  sign: 1 | -1;
  /** Coordinate of the furniture edge the clearance starts from. */
  edge: number;
  /** Lateral span (through the perpendicular axis). */
  lateral: [number, number];
  rect: Rect;
  group?: string;
  groupMode?: 'any' | 'all';
}

function zoneFromNormal(
  f: FurnitureObject,
  normal: { x: number; y: number },
  halfExtent: number,
  depth: number,
  label: string,
): Omit<UsageZone, 'id' | 'objectId' | 'target'> {
  const rect = footprint(f);
  const edgePoint = {
    x: f.x + normal.x * halfExtent,
    y: f.y + normal.y * halfExtent,
  };
  if (normal.x !== 0) {
    const sign = Math.sign(normal.x) as 1 | -1;
    const edge = edgePoint.x;
    const lateral: [number, number] = [rect.y1, rect.y2];
    return {
      axis: 'x',
      sign,
      edge,
      lateral,
      label,
      rect: {
        x1: Math.min(edge, edge + sign * depth),
        y1: rect.y1,
        x2: Math.max(edge, edge + sign * depth),
        y2: rect.y2,
      },
    };
  }
  const sign = Math.sign(normal.y) as 1 | -1;
  const edge = edgePoint.y;
  const lateral: [number, number] = [rect.x1, rect.x2];
  return {
    axis: 'y',
    sign,
    edge,
    lateral,
    label,
    rect: {
      x1: rect.x1,
      y1: Math.min(edge, edge + sign * depth),
      x2: rect.x2,
      y2: Math.max(edge, edge + sign * depth),
    },
  };
}

function rotateNormal(normal: { x: number; y: number }, rotation: number) {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad) * 1e6) / 1e6;
  const sin = Math.round(Math.sin(rad) * 1e6) / 1e6;
  return {
    x: Math.round(normal.x * cos - normal.y * sin),
    y: Math.round(normal.x * sin + normal.y * cos),
  };
}

export function zonesForObject(
  f: FurnitureObject,
  clearances: ClearanceSettings,
): UsageZone[] {
  const profile = usageProfile(f.kind, clearances);
  if (profile.mode === 'none' || profile.depth <= 0) return [];

  if (profile.mode === 'front') {
    const normal = rotateNormal({ x: 0, y: 1 }, f.rotation);
    const zone = zoneFromNormal(f, normal, f.depth / 2, profile.depth, profile.label);
    return [{ ...zone, id: `zone_${f.id}_front`, objectId: f.id, target: profile.depth }];
  }

  const leftNormal = rotateNormal({ x: -1, y: 0 }, f.rotation);
  const rightNormal = rotateNormal({ x: 1, y: 0 }, f.rotation);
  const group = `sides_${f.id}`;
  return [
    {
      ...zoneFromNormal(f, leftNormal, f.width / 2, profile.depth, 'Left bedside access'),
      id: `zone_${f.id}_left`,
      objectId: f.id,
      target: profile.depth,
      group,
      groupMode: 'any',
    },
    {
      ...zoneFromNormal(f, rightNormal, f.width / 2, profile.depth, 'Right bedside access'),
      id: `zone_${f.id}_right`,
      objectId: f.id,
      target: profile.depth,
      group,
      groupMode: 'any',
    },
  ];
}

/**
 * Depth actually free in the zone, starting from the furniture edge. Obstacles
 * are other physical footprints; the room boundary also limits the space.
 */
export function availableClearance(zone: UsageZone, objects: FurnitureObject[], room: Room) {
  const roomLimit =
    zone.axis === 'x'
      ? zone.sign > 0
        ? room.width - zone.edge
        : zone.edge
      : zone.sign > 0
        ? room.length - zone.edge
        : zone.edge;

  let available = Math.min(zone.target, Math.max(0, roomLimit));
  let blockedBy: FurnitureObject | null = null;

  for (const object of objects) {
    if (object.id === zone.objectId) continue;
    const rect = footprint(object);
    const lateralLo = zone.axis === 'x' ? rect.y1 : rect.x1;
    const lateralHi = zone.axis === 'x' ? rect.y2 : rect.x2;
    if (lateralHi <= zone.lateral[0] + 0.5 || lateralLo >= zone.lateral[1] - 0.5) continue;

    const nearEdge =
      zone.axis === 'x' ? (zone.sign > 0 ? rect.x1 : rect.x2) : zone.sign > 0 ? rect.y1 : rect.y2;
    const depthFromEdge = (nearEdge - zone.edge) * zone.sign;
    if (depthFromEdge < available) {
      available = Math.max(0, depthFromEdge);
      blockedBy = object;
    }
  }
  return { available: Math.round(available), blockedBy };
}

export function evaluateClearance(
  zones: UsageZone[],
  objects: FurnitureObject[],
  room: Room,
  clearances: ClearanceSettings,
): ClearanceCheck[] {
  const checks: ClearanceCheck[] = [];
  for (const zone of zones) {
    const { available } = availableClearance(zone, objects, room);
    checks.push({
      id: zone.id,
      objectId: zone.objectId,
      label: zone.label,
      target: zone.target,
      available,
      ok: available >= zone.target - clearances.installationGap,
      zone: zone.rect,
    });
  }
  return checks;
}

export interface CirculationReport {
  doorBlocked: boolean;
  approachWidth: number;
  targetWidth: number;
  blockers: string[];
}

/** Check that each door has an approach corridor of the requested width. */
export function evaluateDoorApproach(
  opening: Opening,
  room: Room,
  objects: FurnitureObject[],
  target: number,
): CirculationReport {
  if (opening.kind !== 'door') {
    return { doorBlocked: false, approachWidth: target, targetWidth: target, blockers: [] };
  }
  const zone = doorApproachZone(opening, room, target);
  const blockers = objects.filter((f) => rectsOverlap(footprint(f), zone));
  const doorLo = opening.offset;
  const doorHi = opening.offset + opening.width;
  const horizontal = opening.wall === 'north' || opening.wall === 'south';

  // Conservative measure: subtract the union of blocked spans across the
  // doorway from the doorway width.
  const intervals = blockers
    .map((b) => {
      const rect = footprint(b);
      const lo = horizontal ? rect.x1 : rect.y1;
      const hi = horizontal ? rect.x2 : rect.y2;
      return [Math.max(lo, doorLo), Math.min(hi, doorHi)] as [number, number];
    })
    .filter(([lo, hi]) => hi > lo)
    .sort((a, b) => a[0] - b[0]);

  let blockedSpan = 0;
  let cursor = -Infinity;
  for (const [lo, hi] of intervals) {
    if (lo > cursor) {
      blockedSpan += hi - lo;
      cursor = hi;
    } else if (hi > cursor) {
      blockedSpan += hi - cursor;
      cursor = hi;
    }
  }
  const approachWidth = Math.max(0, Math.round(opening.width - blockedSpan));
  return {
    doorBlocked: approachWidth < target || blockers.some((b) => openingBlocksObject(opening, room, b)),
    approachWidth,
    targetWidth: target,
    blockers: blockers.map((b) => b.id),
  };
}
