import type { FurnitureObject, Rect, Room } from '@/types';

/** Minimum positive overlap (mm) before two footprints count as intersecting. */
export const OVERLAP_EPSILON = 0.5;

export function footprint(f: FurnitureObject): Rect {
  const rotated = f.rotation % 180 !== 0;
  const halfW = (rotated ? f.depth : f.width) / 2;
  const halfD = (rotated ? f.width : f.depth) / 2;
  return { x1: f.x - halfW, y1: f.y - halfD, x2: f.x + halfW, y2: f.y + halfD };
}

/** World-space size of a rotated object. */
export function effectiveSize(f: FurnitureObject): { width: number; depth: number } {
  const rotated = f.rotation % 180 !== 0;
  return rotated ? { width: f.depth, depth: f.width } : { width: f.width, depth: f.depth };
}

export function roomRect(room: Room): Rect {
  return { x1: 0, y1: 0, x2: room.width, y2: room.length };
}

export function rectFromCenter(x: number, y: number, width: number, depth: number): Rect {
  return { x1: x - width / 2, y1: y - depth / 2, x2: x + width / 2, y2: y + depth / 2 };
}

export function rectWidth(r: Rect): number {
  return r.x2 - r.x1;
}

export function rectHeight(r: Rect): number {
  return r.y2 - r.y1;
}

export function rectArea(r: Rect): number {
  return Math.max(0, rectWidth(r)) * Math.max(0, rectHeight(r));
}

export function rectCenter(r: Rect): { x: number; y: number } {
  return { x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2 };
}

export function overlapSize(a: Rect, b: Rect): { width: number; height: number } {
  return {
    width: Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1),
    height: Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1),
  };
}

/**
 * True when the two rectangles share a positive physical area. Merely touching
 * edges (or a hairline float error) is not a collision.
 */
export function rectsOverlap(a: Rect, b: Rect, epsilon = OVERLAP_EPSILON): boolean {
  const { width, height } = overlapSize(a, b);
  return width > epsilon && height > epsilon;
}

/** Shortest distance between two rectangles. 0 when they overlap or touch. */
export function rectDistance(a: Rect, b: Rect): number {
  const dx = Math.max(b.x1 - a.x2, a.x1 - b.x2, 0);
  const dy = Math.max(b.y1 - a.y2, a.y1 - b.y2, 0);
  return Math.hypot(dx, dy);
}

/** Distance from a rectangle to a container's edges (negative if outside). */
export function rectToRoomEdges(r: Rect, room: Room) {
  return {
    left: r.x1,
    top: r.y1,
    right: room.width - r.x2,
    bottom: room.length - r.y2,
  };
}

export function rectInside(r: Rect, container: Rect, tolerance = 0): boolean {
  return (
    r.x1 >= container.x1 - tolerance &&
    r.y1 >= container.y1 - tolerance &&
    r.x2 <= container.x2 + tolerance &&
    r.y2 <= container.y2 + tolerance
  );
}

export function pointInRect(x: number, y: number, r: Rect, tolerance = 0): boolean {
  return (
    x >= r.x1 - tolerance &&
    x <= r.x2 + tolerance &&
    y >= r.y1 - tolerance &&
    y <= r.y2 + tolerance
  );
}

/** Corner points of the rotated rectangle, in world coordinates. */
export function cornersOf(f: FurnitureObject): { x: number; y: number }[] {
  const rad = (f.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = f.width / 2;
  const hd = f.depth / 2;
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([x, y]) => ({
    x: f.x + x * cos - y * sin,
    y: f.y + x * sin + y * cos,
  }));
}

/** Axis-aligned bounds of a rotated object (same as `footprint` for 90° steps). */
export function boundsOf(f: FurnitureObject): Rect {
  return footprint(f);
}

export function rectsUnion(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  return rects.reduce(
    (acc, r) => ({
      x1: Math.min(acc.x1, r.x1),
      y1: Math.min(acc.y1, r.y1),
      x2: Math.max(acc.x2, r.x2),
      y2: Math.max(acc.y2, r.y2),
    }),
    { ...rects[0] },
  );
}

export function intersectRect(a: Rect, b: Rect): Rect | null {
  const rect = {
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
    x2: Math.min(a.x2, b.x2),
    y2: Math.min(a.y2, b.y2),
  };
  if (rect.x2 <= rect.x1 || rect.y2 <= rect.y1) return null;
  return rect;
}

export function expandRect(r: Rect, amount: number): Rect {
  return { x1: r.x1 - amount, y1: r.y1 - amount, x2: r.x2 + amount, y2: r.y2 + amount };
}

/**
 * Exact union area of axis-aligned rectangles using coordinate compression.
 * Overlapping furniture must not be counted twice.
 */
export function unionArea(rects: Rect[]): number {
  const valid = rects.filter((r) => rectArea(r) > 0);
  if (valid.length === 0) return 0;
  const xs = [...new Set(valid.flatMap((r) => [r.x1, r.x2]))].sort((a, b) => a - b);
  const ys = [...new Set(valid.flatMap((r) => [r.y1, r.y2]))].sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      if (valid.some((r) => pointInRect(cx, cy, r))) {
        total += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
      }
    }
  }
  return total;
}

export function totalFootprintArea(objects: FurnitureObject[]): number {
  return objects.reduce((sum, f) => sum + f.width * f.depth, 0);
}

export function rotateVector(x: number, y: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/**
 * Map a rectangle described in the object's local space (origin at the object
 * centre) into world space, for rotations that are multiples of 90°.
 */
export function localRectToWorld(
  f: FurnitureObject,
  lx1: number,
  ly1: number,
  lx2: number,
  ly2: number,
): Rect {
  const rotated = f.rotation % 180 !== 0;
  const w = Math.abs(lx2 - lx1);
  const h = Math.abs(ly2 - ly1);
  const cx = (lx1 + lx2) / 2;
  const cy = (ly1 + ly2) / 2;
  const offset = rotateVector(cx, cy, f.rotation);
  const worldW = rotated ? h : w;
  const worldH = rotated ? w : h;
  return rectFromCenter(f.x + offset.x, f.y + offset.y, worldW, worldH);
}

/** Rotate an object around its own centre. Dimensions are preserved. */
export function rotateObject(
  f: FurnitureObject,
  direction: 'cw' | 'ccw' = 'cw',
): FurnitureObject {
  const delta = direction === 'cw' ? 90 : -90;
  const next = (((f.rotation + delta) % 360) + 360) % 360;
  return { ...f, rotation: next as FurnitureObject['rotation'] };
}

/** Keep an object inside the room after a room-resize. Returns new centre. */
export function clampCenterIntoRoom(
  f: FurnitureObject,
  room: Room,
  margin = 0,
): { x: number; y: number } {
  const size = effectiveSize(f);
  const minX = Math.min(size.width / 2 + margin, room.width / 2);
  const maxX = Math.max(room.width - size.width / 2 - margin, room.width / 2);
  const minY = Math.min(size.depth / 2 + margin, room.length / 2);
  const maxY = Math.max(room.length - size.depth / 2 - margin, room.length / 2);
  return {
    x: Math.min(maxX, Math.max(minX, f.x)),
    y: Math.min(maxY, Math.max(minY, f.y)),
  };
}
