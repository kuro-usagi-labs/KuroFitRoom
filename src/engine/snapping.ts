import type { FurnitureObject, Room } from '@/types';
import { footprint, roomRect } from './geometry';

export interface SnapGuide {
  axis: 'x' | 'y';
  value: number;
  type: 'wall' | 'object' | 'grid' | 'center';
}

export interface SnapOptions {
  /** Snap distance in world millimetres (screen px converted by caller). */
  threshold: number;
  gridSize: number;
  snapGrid: boolean;
  snapWalls: boolean;
  snapObjects: boolean;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
  snappedX: boolean;
  snappedY: boolean;
}

interface Candidate {
  center: number;
  guideValue: number;
  type: SnapGuide['type'];
  distance: number;
}

function bestCandidate(candidates: Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  for (const candidate of candidates) {
    if (candidate.distance > (best?.distance ?? Infinity)) continue;
    best = candidate;
  }
  return best;
}

/**
 * Snap a proposed object centre. Snapping only affects position — never size.
 * Priority: walls / object edges are considered equally by distance; grid is
 * the fallback when nothing else is close.
 */
export function snapPosition(
  proposed: { x: number; y: number },
  width: number,
  depth: number,
  room: Room,
  objects: FurnitureObject[],
  options: SnapOptions,
  excludeId?: string,
): SnapResult {
  const container = roomRect(room);
  const xCandidates: Candidate[] = [];
  const yCandidates: Candidate[] = [];

  const pushCandidate = (
    list: Candidate[],
    axis: 'x' | 'y',
    center: number,
    guideValue: number,
    type: SnapGuide['type'],
  ) => {
    const current = axis === 'x' ? proposed.x : proposed.y;
    list.push({ center, guideValue, type, distance: Math.abs(center - current) });
  };

  if (options.snapWalls) {
    pushCandidate(xCandidates, 'x', container.x1 + width / 2, container.x1, 'wall');
    pushCandidate(xCandidates, 'x', container.x2 - width / 2, container.x2, 'wall');
    pushCandidate(yCandidates, 'y', container.y1 + depth / 2, container.y1, 'wall');
    pushCandidate(yCandidates, 'y', container.y2 - depth / 2, container.y2, 'wall');
  }

  pushCandidate(xCandidates, 'x', container.x2 / 2, container.x2 / 2, 'center');
  pushCandidate(yCandidates, 'y', container.y2 / 2, container.y2 / 2, 'center');

  if (options.snapObjects) {
    for (const object of objects) {
      if (object.id === excludeId) continue;
      const rect = footprint(object);
      const objectWidth = rect.x2 - rect.x1;
      const objectDepth = rect.y2 - rect.y1;
      // Edge against edge (touching), plus alignment of edges and centres.
      pushCandidate(xCandidates, 'x', rect.x2 + width / 2, rect.x2, 'object');
      pushCandidate(xCandidates, 'x', rect.x1 - width / 2, rect.x1, 'object');
      pushCandidate(xCandidates, 'x', rect.x1 + width / 2, rect.x1, 'object');
      pushCandidate(xCandidates, 'x', rect.x2 - width / 2, rect.x2, 'object');
      pushCandidate(xCandidates, 'x', rect.x1 + objectWidth / 2, rect.x1 + objectWidth / 2, 'object');

      pushCandidate(yCandidates, 'y', rect.y2 + depth / 2, rect.y2, 'object');
      pushCandidate(yCandidates, 'y', rect.y1 - depth / 2, rect.y1, 'object');
      pushCandidate(yCandidates, 'y', rect.y1 + depth / 2, rect.y1, 'object');
      pushCandidate(yCandidates, 'y', rect.y2 - depth / 2, rect.y2, 'object');
      pushCandidate(yCandidates, 'y', rect.y1 + objectDepth / 2, rect.y1 + objectDepth / 2, 'object');
    }
  }

  const bestX = bestCandidate(xCandidates);
  const bestY = bestCandidate(yCandidates);

  let x = proposed.x;
  let y = proposed.y;
  const guides: SnapGuide[] = [];
  let snappedX = false;
  let snappedY = false;

  if (bestX && bestX.distance <= options.threshold) {
    x = bestX.center;
    snappedX = true;
  }
  if (bestY && bestY.distance <= options.threshold) {
    y = bestY.center;
    snappedY = true;
  }

  if (!snappedX) {
    if (options.snapGrid && options.gridSize > 0) {
      x = Math.round(x / options.gridSize) * options.gridSize;
      snappedX = true;
    }
  }

  if (!snappedY) {
    if (options.snapGrid && options.gridSize > 0) {
      y = Math.round(y / options.gridSize) * options.gridSize;
      snappedY = true;
    }
  }

  if (bestX && bestX.distance <= options.threshold) {
    guides.push({ axis: 'x', value: bestX.guideValue, type: bestX.type });
  }
  if (bestY && bestY.distance <= options.threshold) {
    guides.push({ axis: 'y', value: bestY.guideValue, type: bestY.type });
  }

  return { x, y, guides, snappedX, snappedY };
}

/** Snap a wall offset for doors / windows. */
export function snapOffset(offset: number, roomLength: number, gridSize: number): number {
  const clamped = Math.min(Math.max(offset, 0), roomLength);
  if (gridSize <= 0) return clamped;
  return Math.round(clamped / gridSize) * gridSize;
}
