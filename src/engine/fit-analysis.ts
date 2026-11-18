import type {
  AnalysisIssue,
  AnalysisResult,
  ClearanceCheck,
  FurnitureObject,
  Project,
  Rect,
} from '@/types';
import {
  formatLength,
  formatPercent,
} from './units';
import {
  footprint,
  intersectRect,
  overlapSize,
  rectArea,
  rectsOverlap,
  rectToRoomEdges,
  roomRect,
  unionArea,
} from './geometry';
import {
  availableClearance,
  evaluateClearance,
  evaluateDoorApproach,
  zonesForObject,
  type UsageZone,
} from './clearance';
import { openingBlocksObject } from './openings';

const EPS = 0.5;

export function analyzeProject(project: Project): AnalysisResult {
  const { room, furniture, openings, settings } = project;
  const roomArea = room.width * room.length;
  const container = roomRect(room);
  const issues: AnalysisIssue[] = [];

  const clipped: Rect[] = furniture
    .map((f) => intersectRect(footprint(f), container))
    .filter((r): r is Rect => r !== null && rectArea(r) > 0);
  const occupiedArea = unionArea(clipped);

  // ---- Boundary checks -----------------------------------------------------
  for (const f of furniture) {
    const rect = footprint(f);
    const edges = rectToRoomEdges(rect, room);
    if (rect.x1 < -EPS || rect.y1 < -EPS || rect.x2 > room.width + EPS || rect.y2 > room.length + EPS) {
      const overflow = Math.max(-edges.left, -edges.top, -edges.right, -edges.bottom, 0);
      issues.push({
        id: `boundary_${f.id}`,
        category: 'boundary',
        severity: 'error',
        title: `${f.name} is outside the room`,
        message: `${f.name} extends approximately ${Math.round(overflow)} mm beyond the room boundary.`,
        objectIds: [f.id],
        measurements: [{ label: 'Outside boundary by', value: Math.round(overflow) }],
        suggestion: 'Move the object inward, reduce its size, or increase the room dimensions.',
      });
    }
  }

  // ---- Collision checks ----------------------------------------------------
  const pairCollisions: AnalysisResult['collisions'] = [];
  for (let i = 0; i < furniture.length; i += 1) {
    for (let j = i + 1; j < furniture.length; j += 1) {
      const a = furniture[i];
      const b = furniture[j];
      const ra = footprint(a);
      const rb = footprint(b);
      if (!rectsOverlap(ra, rb)) continue;
      const size = overlapSize(ra, rb);
      pairCollisions.push({
        aId: a.id,
        bId: b.id,
        overlapWidth: Math.round(size.width),
        overlapHeight: Math.round(size.height),
      });
      issues.push({
        id: `collision_${a.id}_${b.id}`,
        category: 'collision',
        severity: 'error',
        title: `${a.name} overlaps ${b.name}`,
        message: `The physical footprints overlap by ${Math.round(size.width)} × ${Math.round(
          size.height,
        )} mm.`,
        objectIds: [a.id, b.id],
        measurements: [
          { label: 'Overlap width', value: Math.round(size.width) },
          { label: 'Overlap depth', value: Math.round(size.height) },
        ],
        suggestion: 'Move one of the objects or adjust their dimensions.',
      });
    }
  }

  // ---- Door checks ---------------------------------------------------------
  const doorChecks: AnalysisResult['doorChecks'] = [];
  const doors = openings.filter((o) => o.kind === 'door');
  for (const door of doors) {
    const blockedBy = furniture.filter((f) => openingBlocksObject(door, room, f)).map((f) => f.id);
    doorChecks.push({ openingId: door.id, blocked: blockedBy.length > 0, blockedBy });
    if (blockedBy.length > 0) {
      const names = furniture.filter((f) => blockedBy.includes(f.id)).map((f) => f.name);
      issues.push({
        id: `door_swing_${door.id}`,
        category: 'opening',
        severity: 'error',
        title: `${door.name} cannot open fully`,
        message: `The door swing is obstructed by ${names.join(', ')}.`,
        objectIds: blockedBy,
        measurements: [{ label: 'Door width', value: door.width }],
        suggestion: 'Clear the swing area or change the hinge / opening direction.',
      });
    }
    const approach = evaluateDoorApproach(
      door,
      room,
      furniture,
      settings.clearances.walkwayLimited,
    );
    if (approach.doorBlocked) {
      issues.push({
        id: `door_approach_${door.id}`,
        category: 'circulation',
        severity: 'warning',
        title: `Entrance ${door.name} is hard to reach`,
        message: `Only ${formatLength(
          approach.approachWidth,
          'cm',
        )} of clear width is available across this door. The limited walkway target is ${formatLength(
          approach.targetWidth,
          'cm',
        )}.`,
        objectIds: approach.blockers,
        measurements: [
          { label: 'Free entrance width', value: approach.approachWidth },
          { label: 'Target clear width', value: approach.targetWidth },
        ],
        suggestion: 'Keep the area immediately inside the door free of furniture.',
      });
    }
  }

  // ---- Clearance checks ----------------------------------------------------
  const checks: ClearanceCheck[] = [];
  const zones: UsageZone[] = [];
  for (const f of furniture) {
    const objectZones = zonesForObject(f, settings.clearances);
    zones.push(...objectZones);
    checks.push(
      ...evaluateClearance(objectZones, furniture, room, settings.clearances).map((c) => ({
        ...c,
        objectId: f.id,
      })),
    );
  }

  // Grouped "any" checks (bed sides): satisfied if at least one side is free.
  const handledGroups = new Set<string>();
  for (const zone of zones) {
    if (!zone.group) continue;
    const groupChecks = checks.filter((c) => zones.find((z) => z.id === c.id)?.group === zone.group);
    if (handledGroups.has(zone.group)) continue;
    handledGroups.add(zone.group);
    if (groupChecks.some((c) => c.ok)) continue;
    const best = groupChecks.reduce((acc, c) => (c.available > acc.available ? c : acc), groupChecks[0]);
    const object = furniture.find((f) => f.id === zone.objectId);
    if (!object || !best) continue;
    issues.push({
      id: `clearance_${zone.group}`,
      category: 'clearance',
      severity: 'warning',
      title: `${object.name} has no usable side access`,
      message: `Both sides of ${object.name} provide less than ${formatLength(
        best.target,
        'cm',
      )} of access. The widest free side is ${formatLength(best.available, 'cm')}.`,
      objectIds: [object.id],
      measurements: [
        { label: 'Best free side', value: best.available },
        { label: 'Target access', value: best.target },
      ],
      suggestion: 'Pull the bed away from a wall or move neighbouring furniture.',
    });
  }

  for (const check of checks) {
    const zone = zones.find((z) => z.id === check.id);
    if (!zone || zone.group) continue;
    if (check.ok) continue;
    const object = furniture.find((f) => f.id === check.objectId);
    if (!object) continue;
    const { blockedBy } = availableClearance(zone, furniture, room);
    issues.push({
      id: `clearance_${check.id}`,
      category: 'clearance',
      severity: 'warning',
      title: `${check.label} is below target`,
      message: `${object.name} has ${formatLength(check.available, 'cm')} of free space — ${formatLength(
        Math.max(0, check.target - check.available),
        'cm',
      )} less than the ${formatLength(check.target, 'cm')} target.${
        blockedBy ? ` ${blockedBy.name} is the closest obstruction.` : ''
      }`,
      objectIds: blockedBy ? [object.id, blockedBy.id] : [object.id],
      measurements: [
        { label: 'Available', value: check.available },
        { label: 'Target', value: check.target },
      ],
      suggestion: 'Move the object or reduce its size to recover the working space.',
    });
  }

  // ---- Circulation between objects ----------------------------------------
  const usableFloor = Math.max(0, roomArea - occupiedArea);
  if (furniture.length > 1) {
    const tightPairs: { a: FurnitureObject; b: FurnitureObject; gap: number }[] = [];
    for (let i = 0; i < furniture.length; i += 1) {
      for (let j = i + 1; j < furniture.length; j += 1) {
        const a = furniture[i];
        const b = furniture[j];
        const ra = footprint(a);
        const rb = footprint(b);
        if (rectsOverlap(ra, rb)) continue;
        const dx = Math.max(rb.x1 - ra.x2, ra.x1 - rb.x2, 0);
        const dy = Math.max(rb.y1 - ra.y2, ra.y1 - rb.y2, 0);
        const gap = Math.hypot(dx, dy);
        if (gap > 0 && gap < settings.clearances.walkwayLimited && dx * dy === 0) {
          tightPairs.push({ a, b, gap });
        }
      }
    }
    tightPairs
      .sort((p1, p2) => p1.gap - p2.gap)
      .slice(0, 3)
      .forEach(({ a, b, gap }) => {
        issues.push({
          id: `circ_${a.id}_${b.id}`,
          category: 'circulation',
          severity: 'warning',
          title: `Tight passage between ${a.name} and ${b.name}`,
          message: `Only ${formatLength(gap, 'cm')} of space separates ${a.name} and ${b.name}; the limited walkway target is ${formatLength(
            settings.clearances.walkwayLimited,
            'cm',
          )}.`,
          objectIds: [a.id, b.id],
          measurements: [
            { label: 'Clearance', value: Math.round(gap) },
            { label: 'Walkway target', value: settings.clearances.walkwayLimited },
          ],
          suggestion: 'If this gap is your main walkway, allow more space before buying.',
        });
      });
  }

  // ---- Review notes --------------------------------------------------------
  if (furniture.length === 0) {
    issues.push({
      id: 'review_empty',
      category: 'review',
      severity: 'info',
      title: 'No furniture to analyse',
      message: 'Add furniture to see physical fit, clearance and circulation results.',
      objectIds: [],
      measurements: [],
    });
  } else if (doors.length === 0) {
    issues.push({
      id: 'review_no_door',
      category: 'review',
      severity: 'info',
      title: 'No door placed yet',
      message: 'Entrance accessibility is not analysed. Add a door for a complete fit review.',
      objectIds: [],
      measurements: [],
    });
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const evaluatedZones = checks.length;

  let status: AnalysisResult['status'];
  if (errorCount > 0) status = 'no-fit';
  else if (warningCount > 0) status = 'tight';
  else if (evaluatedZones === 0) status = 'review';
  else status = 'comfortable';

  const statusLabel =
    status === 'comfortable'
      ? 'Fits comfortably'
      : status === 'tight'
        ? 'Fits, but tight'
        : status === 'no-fit'
          ? "Doesn't fit"
          : 'Needs review';

  const summary =
    status === 'no-fit'
      ? `${errorCount} physical conflict${errorCount === 1 ? '' : 's'} must be resolved before this layout works.`
      : status === 'tight'
        ? `The layout is physically possible, but ${warningCount} access or circulation warning${
            warningCount === 1 ? '' : 's'
          } need review.`
        : status === 'comfortable'
          ? `All ${furniture.length} object${furniture.length === 1 ? '' : 's'} fit and the checked clearances are satisfied.`
          : 'Furniture fits physically where checked, but some access areas have not been verified yet.';

  return {
    status,
    statusLabel,
    summary,
    issues,
    collisions: pairCollisions,
    doorChecks,
    clearanceChecks: checks,
    roomArea,
    occupiedArea,
    freeArea: usableFloor,
    occupancyPct: roomArea > 0 ? (occupiedArea / roomArea) * 100 : 0,
    objectCount: furniture.length,
  };
}

export function statusText(status: AnalysisResult['status']): string {
  return status === 'comfortable'
    ? 'Fits comfortably'
    : status === 'tight'
      ? 'Fits, but tight'
      : status === 'no-fit'
        ? "Doesn't fit"
        : 'Needs review';
}

export function occupancyText(result: AnalysisResult): string {
  return formatPercent(result.occupancyPct);
}
