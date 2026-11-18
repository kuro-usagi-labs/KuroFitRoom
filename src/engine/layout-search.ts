import type {
  AnalysisResult,
  FurnitureCategory,
  FurnitureKind,
  FurnitureObject,
  Project,
  Rect,
  Rotation,
} from '@/types';
import { analyzeProject } from './fit-analysis';
import {
  availableClearance,
  evaluateDoorApproach,
  zonesForObject,
} from './clearance';
import {
  footprint,
  rectInside,
  rectsOverlap,
  roomRect,
  unionArea,
  intersectRect,
  rectArea,
} from './geometry';
import { openingBlocksObject } from './openings';
import { uid } from './units';

export interface CandidateSpec {
  name: string;
  kind: FurnitureKind;
  category: FurnitureCategory;
  width: number;
  depth: number;
  color: string;
}

export interface PlacementCandidate {
  x: number;
  y: number;
  rotation: Rotation;
  score: number;
  touchesWall: boolean;
  clearanceSatisfied: number;
  clearanceTotal: number;
  freeArea: number;
  blockedDoor: boolean;
  valid: boolean;
}

export interface PlacementResult {
  candidates: PlacementCandidate[];
  best: PlacementCandidate | null;
  analysis: AnalysisResult | null;
  note: string;
  evaluated: number;
}

export interface PlacementOptions {
  gridStep?: number;
  maxResults?: number;
  excludeDoorIds?: string[];
  /** Restrict the orientations tested by the search. */
  rotations?: Rotation[];
}

const DEFAULT_GRID_STEP = 100;

function makeCandidateObject(spec: CandidateSpec, x: number, y: number, rotation: Rotation): FurnitureObject {
  return {
    id: 'candidate_preview',
    name: spec.name,
    kind: spec.kind,
    category: spec.category,
    x,
    y,
    width: spec.width,
    depth: spec.depth,
    rotation,
    color: spec.color,
    locked: false,
  };
}

function wallTouching(rect: Rect, room: Project['room'], tolerance = 10): boolean {
  return (
    Math.abs(rect.x1) <= tolerance ||
    Math.abs(rect.y1) <= tolerance ||
    Math.abs(room.width - rect.x2) <= tolerance ||
    Math.abs(room.length - rect.y2) <= tolerance
  );
}

function physicalCheck(
  candidate: FurnitureObject,
  project: Project,
): { ok: boolean; reason?: string } {
  const rect = footprint(candidate);
  if (!rectInside(rect, roomRect(project.room), 0.5)) {
    return { ok: false, reason: 'outside-room' };
  }
  for (const object of project.furniture) {
    if (rectsOverlap(rect, footprint(object))) return { ok: false, reason: 'collision' };
  }
  for (const opening of project.openings) {
    if (opening.kind === 'door' && openingBlocksObject(opening, project.room, candidate)) {
      return { ok: false, reason: 'door-swing' };
    }
  }
  return { ok: true };
}

function scoreCandidate(
  candidate: FurnitureObject,
  project: Project,
): PlacementCandidate {
  const zones = zonesForObject(candidate, project.settings.clearances);
  let satisfied = 0;
  for (const zone of zones) {
    const { available } = availableClearance(zone, [...project.furniture, candidate], project.room);
    if (available >= zone.target - project.settings.clearances.installationGap) satisfied += 1;
  }

  const allObjects = [...project.furniture, candidate];
  const container = roomRect(project.room);
  const rects = allObjects
    .map((f) => intersectRect(footprint(f), container))
    .filter((r): r is Rect => r !== null && rectArea(r) > 0);
  const roomArea = project.room.width * project.room.length;
  const freeArea = Math.max(0, roomArea - unionArea(rects));
  const touchesWall = wallTouching(footprint(candidate), project.room);

  let blockedDoor = false;
  for (const opening of project.openings) {
    if (opening.kind !== 'door') continue;
    const approach = evaluateDoorApproach(
      opening,
      project.room,
      allObjects,
      project.settings.clearances.walkwayLimited,
    );
    if (approach.doorBlocked) blockedDoor = true;
  }

  const clearanceRatio = zones.length > 0 ? satisfied / zones.length : 0.5;
  const freeRatio = roomArea > 0 ? freeArea / roomArea : 0;
  const score =
    clearanceRatio * 60 +
    freeRatio * 25 +
    (touchesWall ? 6 : 0) +
    (zones.length === 0 ? 5 : 0) -
    (blockedDoor ? 25 : 0);

  return {
    x: candidate.x,
    y: candidate.y,
    rotation: candidate.rotation as Rotation,
    score: Math.round(score * 10) / 10,
    touchesWall,
    clearanceSatisfied: satisfied,
    clearanceTotal: zones.length,
    freeArea,
    blockedDoor,
    valid: true,
  };
}

function generateCenters(
  spec: CandidateSpec,
  project: Project,
  rotation: Rotation,
  gridStep: number,
): { x: number; y: number }[] {
  const rotated = rotation % 180 !== 0;
  const width = rotated ? spec.depth : spec.width;
  const depth = rotated ? spec.width : spec.depth;
  const { room } = project;
  const gap = project.settings.clearances.installationGap;
  const points: { x: number; y: number }[] = [];

  const add = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x - width / 2 < -0.5 || y - depth / 2 < -0.5) return;
    if (x + width / 2 > room.width + 0.5 || y + depth / 2 > room.length + 0.5) return;
    points.push({ x: Math.round(x), y: Math.round(y) });
  };

  // Corners and wall-aligned positions.
  add(width / 2, depth / 2);
  add(room.width - width / 2, depth / 2);
  add(width / 2, room.length - depth / 2);
  add(room.width - width / 2, room.length - depth / 2);
  add(room.width / 2, depth / 2);
  add(room.width / 2, room.length - depth / 2);
  add(width / 2, room.length / 2);
  add(room.width - width / 2, room.length / 2);

  // Adjacent to existing furniture.
  for (const object of project.furniture) {
    const rect = footprint(object);
    add(rect.x1 - gap - width / 2, rect.y1 + depth / 2);
    add(rect.x2 + gap + width / 2, rect.y1 + depth / 2);
    add(rect.x1 + width / 2, rect.y1 - gap - depth / 2);
    add(rect.x1 + width / 2, rect.y2 + gap + depth / 2);
    add(rect.x2 + gap + width / 2, (rect.y1 + rect.y2) / 2);
    add(rect.x1 - gap - width / 2, (rect.y1 + rect.y2) / 2);
    add((rect.x1 + rect.x2) / 2, rect.y2 + gap + depth / 2);
    add((rect.x1 + rect.x2) / 2, rect.y1 - gap - depth / 2);
  }

  // Grid sweep.
  const step = Math.max(50, gridStep);
  for (let x = width / 2; x <= room.width - width / 2 + 0.5; x += step) {
    for (let y = depth / 2; y <= room.length - depth / 2 + 0.5; y += step) {
      add(x, y);
    }
  }

  // De-duplicate close centres.
  const unique: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const point of points) {
    const key = `${Math.round(point.x / 25)}:${Math.round(point.y / 25)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(point);
  }
  return unique;
}

/**
 * Deterministic, heuristic placement search. Physical conflicts are hard
 * constraints; clearances and free area only rank otherwise valid positions.
 * Not finding a candidate is not proof that no layout exists.
 */
export function findPlacements(
  project: Project,
  spec: CandidateSpec,
  options: PlacementOptions = {},
): PlacementResult {
  const gridStep = options.gridStep ?? DEFAULT_GRID_STEP;
  const maxResults = options.maxResults ?? 3;
  const candidates: PlacementCandidate[] = [];
  let evaluated = 0;

  for (const rotation of options.rotations ?? ([0, 90] as Rotation[])) {
    const centers = generateCenters(spec, project, rotation, gridStep);
    for (const center of centers) {
      evaluated += 1;
      const object = makeCandidateObject(spec, center.x, center.y, rotation);
      if (!physicalCheck(object, project).ok) continue;
      candidates.push(scoreCandidate(object, project));
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Keep results visually distinct.
  const chosen: PlacementCandidate[] = [];
  for (const candidate of candidates) {
    if (chosen.length >= maxResults) break;
    const tooClose = chosen.some(
      (c) =>
        c.rotation === candidate.rotation &&
        Math.hypot(c.x - candidate.x, c.y - candidate.y) < 120,
    );
    if (tooClose) continue;
    chosen.push(candidate);
  }

  const best = chosen[0] ?? null;
  let analysis: AnalysisResult | null = null;
  if (best) {
    const object = makeCandidateObject(spec, best.x, best.y, best.rotation);
    analysis = analyzeProject({ ...project, furniture: [...project.furniture, object] });
  }

  let note = '';
  if (!best) {
    note =
      'No valid position was found in the sampled grid. This is a heuristic search, not proof that the furniture cannot fit — try another orientation, a smaller size, or clear floor space.';
  } else if (analysis && analysis.status === 'no-fit') {
    note = 'A position was found but the surrounding layout still has physical conflicts.';
  } else if (analysis && analysis.status === 'tight') {
    note = 'A position exists, but access space around it remains below target.';
  } else {
    note = 'Position found with the required access space available where checked.';
  }

  return { candidates: chosen, best, analysis, note, evaluated };
}

export interface SizeOption {
  id: string;
  label: string;
  width: number;
  depth: number;
}

export interface SizeRecommendation {
  option: SizeOption;
  fits: boolean;
  best: PlacementCandidate | null;
  analysis: AnalysisResult | null;
  freeArea: number;
}

/** Compare alternative furniture sizes using the same placement engine. */
export function recommendSizes(
  project: Project,
  spec: Omit<CandidateSpec, 'width' | 'depth'>,
  sizes: SizeOption[],
): SizeRecommendation[] {
  return sizes.map((option) => {
    const result = findPlacements(
      project,
      { ...spec, width: option.width, depth: option.depth },
      { maxResults: 1, gridStep: 100 },
    );
    return {
      option,
      fits: Boolean(result.best),
      best: result.best,
      analysis: result.analysis,
      freeArea: result.best?.freeArea ?? 0,
    };
  });
}

export function candidateToObject(
  spec: CandidateSpec,
  candidate: PlacementCandidate,
  id = uid('furn'),
): FurnitureObject {
  return {
    id,
    name: spec.name,
    kind: spec.kind,
    category: spec.category,
    x: candidate.x,
    y: candidate.y,
    width: spec.width,
    depth: spec.depth,
    rotation: candidate.rotation,
    color: spec.color,
    locked: false,
  };
}
