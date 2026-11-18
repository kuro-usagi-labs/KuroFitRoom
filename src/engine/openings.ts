import type { FurnitureObject, Opening, Rect, Room, WallSide } from '@/types';
import { footprint, pointInRect } from './geometry';

export const WALL_SIDES: WallSide[] = ['north', 'south', 'east', 'west'];

export const WALL_LABEL: Record<WallSide, string> = {
  north: 'Top wall',
  south: 'Bottom wall',
  east: 'Right wall',
  west: 'Left wall',
};

export function wallLength(room: Room, wall: WallSide): number {
  return wall === 'north' || wall === 'south' ? room.width : room.length;
}

interface WallFrame {
  /** World position of the wall's starting corner. */
  start: { x: number; y: number };
  /** Unit vector along the wall (offset direction). */
  along: { x: number; y: number };
  /** Unit vector pointing into the room. */
  inward: { x: number; y: number };
}

export function wallFrame(room: Room, wall: WallSide): WallFrame {
  switch (wall) {
    case 'north':
      return { start: { x: 0, y: 0 }, along: { x: 1, y: 0 }, inward: { x: 0, y: 1 } };
    case 'south':
      return { start: { x: 0, y: room.length }, along: { x: 1, y: 0 }, inward: { x: 0, y: -1 } };
    case 'west':
      return { start: { x: 0, y: 0 }, along: { x: 0, y: 1 }, inward: { x: 1, y: 0 } };
    case 'east':
      return { start: { x: room.width, y: 0 }, along: { x: 0, y: 1 }, inward: { x: -1, y: 0 } };
  }
}

export function openingStart(opening: Opening, room: Room) {
  const frame = wallFrame(room, opening.wall);
  return {
    x: frame.start.x + frame.along.x * opening.offset,
    y: frame.start.y + frame.along.y * opening.offset,
  };
}

export function openingEnd(opening: Opening, room: Room) {
  const frame = wallFrame(room, opening.wall);
  const distance = opening.offset + opening.width;
  return {
    x: frame.start.x + frame.along.x * distance,
    y: frame.start.y + frame.along.y * distance,
  };
}

export function openingCenter(opening: Opening, room: Room) {
  const start = openingStart(opening, room);
  const end = openingEnd(opening, room);
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

export function maxOpeningOffset(room: Room, opening: Opening): number {
  return Math.max(0, wallLength(room, opening.wall) - opening.width);
}

/**
 * Zone directly in front of a door, inside the room. Used to check that the
 * entrance is approachable, not just that the door leaf can swing.
 */
export function doorApproachZone(opening: Opening, room: Room, depth = 800): Rect {
  const frame = wallFrame(room, opening.wall);
  const start = openingStart(opening, room);
  const alongEnd = {
    x: start.x + frame.along.x * opening.width,
    y: start.y + frame.along.y * opening.width,
  };
  const inner1 = {
    x: start.x + frame.inward.x * depth,
    y: start.y + frame.inward.y * depth,
  };
  const inner2 = {
    x: alongEnd.x + frame.inward.x * depth,
    y: alongEnd.y + frame.inward.y * depth,
  };
  return {
    x1: Math.min(start.x, alongEnd.x, inner1.x, inner2.x),
    y1: Math.min(start.y, alongEnd.y, inner1.y, inner2.y),
    x2: Math.max(start.x, alongEnd.x, inner1.x, inner2.x),
    y2: Math.max(start.y, alongEnd.y, inner1.y, inner2.y),
  };
}

export interface DoorSweep {
  hinge: { x: number; y: number };
  radius: number;
  /** Start angle (radians) of the closed door leaf. */
  startAngle: number;
  /** Signed sweep in radians, ±π/2. */
  delta: number;
  closedTip: { x: number; y: number };
  openTip: { x: number; y: number };
  inward: boolean;
}

function normalizeAngle(a: number): number {
  let angle = a;
  while (angle <= -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}

/**
 * Sweep of a hinged door. The leaf is modelled as a line rotating 90° from the
 * closed position to fully open. The swept area is the enclosed quarter disc.
 */
export function doorSweep(opening: Opening, room: Room): DoorSweep {
  const frame = wallFrame(room, opening.wall);
  const width = Math.max(1, opening.width);
  const hinge = opening.hinge === 'start' ? openingStart(opening, room) : openingEnd(opening, room);
  const closedDirection =
    opening.hinge === 'start' ? frame.along : { x: -frame.along.x, y: -frame.along.y };
  const swingSign = opening.swing === 'in' ? 1 : -1;
  const openDirection = {
    x: frame.inward.x * swingSign,
    y: frame.inward.y * swingSign,
  };
  const closedTip = {
    x: hinge.x + closedDirection.x * width,
    y: hinge.y + closedDirection.y * width,
  };
  const openTip = {
    x: hinge.x + openDirection.x * width,
    y: hinge.y + openDirection.y * width,
  };
  const startAngle = Math.atan2(closedDirection.y, closedDirection.x);
  const openAngle = Math.atan2(openDirection.y, openDirection.x);
  return {
    hinge,
    radius: width,
    startAngle,
    delta: normalizeAngle(openAngle - startAngle),
    closedTip,
    openTip,
    inward: opening.swing === 'in',
  };
}

function angleInSweep(angle: number, sweep: DoorSweep): boolean {
  const relative = normalizeAngle(angle - sweep.startAngle);
  if (sweep.delta >= 0) return relative >= -1e-9 && relative <= sweep.delta + 1e-9;
  return relative <= 1e-9 && relative >= sweep.delta - 1e-9;
}

function pointInSweep(x: number, y: number, sweep: DoorSweep): boolean {
  const dx = x - sweep.hinge.x;
  const dy = y - sweep.hinge.y;
  const distance = Math.hypot(dx, dy);
  if (distance > sweep.radius + 1e-6) return false;
  if (distance < 1e-6) return true;
  return angleInSweep(Math.atan2(dy, dx), sweep);
}

function segmentRectIntersection(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rect: Rect,
): boolean {
  const edges: [{ x: number; y: number }, { x: number; y: number }][] = [
    [{ x: rect.x1, y: rect.y1 }, { x: rect.x2, y: rect.y1 }],
    [{ x: rect.x2, y: rect.y1 }, { x: rect.x2, y: rect.y2 }],
    [{ x: rect.x2, y: rect.y2 }, { x: rect.x1, y: rect.y2 }],
    [{ x: rect.x1, y: rect.y2 }, { x: rect.x1, y: rect.y1 }],
  ];
  const d = { x: b.x - a.x, y: b.y - a.y };
  for (const [p1, p2] of edges) {
    const e = { x: p2.x - p1.x, y: p2.y - p1.y };
    const denom = d.x * e.y - d.y * e.x;
    if (Math.abs(denom) < 1e-9) continue;
    const t = ((p1.x - a.x) * e.y - (p1.y - a.y) * e.x) / denom;
    const u = ((p1.x - a.x) * d.y - (p1.y - a.y) * d.x) / denom;
    if (t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) return true;
  }
  return false;
}

function circleSegmentHitsRect(
  center: { x: number; y: number },
  radius: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
  _rect: Rect,
  sweep: DoorSweep,
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - center.x;
  const fy = a.y - center.y;
  const A = dx * dx + dy * dy;
  if (A < 1e-9) return false;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - radius * radius;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return false;
  const sqrt = Math.sqrt(disc);
  for (const t of [(-B - sqrt) / (2 * A), (-B + sqrt) / (2 * A)]) {
    if (t < 0 || t > 1) continue;
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    if (angleInSweep(Math.atan2(py - center.y, px - center.x), sweep)) return true;
  }
  return false;
}

/** True when a physical footprint intersects the door swing area. */
export function rectIntersectsSweep(rect: Rect, sweep: DoorSweep): boolean {
  if (pointInRect(sweep.hinge.x, sweep.hinge.y, rect)) return true;
  if (pointInRect(sweep.closedTip.x, sweep.closedTip.y, rect)) return true;
  if (pointInRect(sweep.openTip.x, sweep.openTip.y, rect)) return true;

  const corners = [
    { x: rect.x1, y: rect.y1 },
    { x: rect.x2, y: rect.y1 },
    { x: rect.x2, y: rect.y2 },
    { x: rect.x1, y: rect.y2 },
  ];
  for (const corner of corners) {
    if (pointInSweep(corner.x, corner.y, sweep)) return true;
  }

  if (segmentRectIntersection(sweep.hinge, sweep.closedTip, rect)) return true;
  if (segmentRectIntersection(sweep.hinge, sweep.openTip, rect)) return true;

  // Arc vs rectangle edges.
  const edges: [{ x: number; y: number }, { x: number; y: number }][] = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];
  for (const [a, b] of edges) {
    if (circleSegmentHitsRect(sweep.hinge, sweep.radius, a, b, rect, sweep)) return true;
  }
  return false;
}

export function openingBlocksObject(
  opening: Opening,
  room: Room,
  object: FurnitureObject,
): boolean {
  if (opening.kind !== 'door') return false;
  return rectIntersectsSweep(footprint(object), doorSweep(opening, room));
}

/** World-space segment used to draw an opening on its wall. */
export function openingSegment(opening: Opening, room: Room) {
  return { start: openingStart(opening, room), end: openingEnd(opening, room) };
}

/** Convert a point on a wall into an opening offset (centre point). */
export function pointToWallOffset(
  x: number,
  y: number,
  wall: WallSide,
  _room: Room,
): number {
  switch (wall) {
    case 'north':
      return x;
    case 'south':
      return x;
    case 'west':
      return y;
    case 'east':
      return y;
  }
}
