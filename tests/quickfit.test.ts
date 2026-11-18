import { describe, expect, it } from 'vitest';
import type { FurnitureObject, Opening, Project, Rotation } from '@/types';
import {
  candidateToObject,
  findPlacements,
  recommendSizes,
  type CandidateSpec,
} from '@/engine/layout-search';
import { footprint, rectsOverlap } from '@/engine/geometry';
import { doorSweep, rectIntersectsSweep } from '@/engine/openings';
import { createBlankProject } from '@/features/project-manager/defaults';

const bedSpec: CandidateSpec = {
  name: 'Double bed',
  kind: 'bed',
  category: 'Bedroom',
  width: 1600,
  depth: 2000,
  color: '#F1ECE3',
};

function projectFor(
  width: number,
  length: number,
  options: { opening?: Opening; furniture?: FurnitureObject[] } = {},
): Project {
  const base = createBlankProject('Quick fit test');
  return {
    ...base,
    room: { ...base.room, width, length },
    openings: options.opening ? [options.opening] : [],
    furniture: options.furniture ?? [],
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

function makeWardrobe(): FurnitureObject {
  return {
    id: 'furn_wardrobe',
    name: 'Wardrobe',
    kind: 'wardrobe',
    category: 'Bedroom',
    x: 600,
    y: 300,
    width: 1200,
    depth: 600,
    rotation: 0,
    color: '#A6B8A8',
    locked: false,
  };
}

describe('placement search', () => {
  it('finds at least one valid physical position in an empty room', () => {
    const project = projectFor(3000, 3600);
    const result = findPlacements(project, bedSpec);
    expect(result.best).not.toBeNull();
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.evaluated).toBeGreaterThan(0);
    expect(result.analysis).not.toBeNull();
    expect(result.note).toMatch(/position found|access space/i);
  });

  it('keeps the chosen footprint inside the room', () => {
    const result = findPlacements(projectFor(3000, 3600), bedSpec);
    const object = candidateToObject(bedSpec, result.best!, 'furn_test');
    const rect = footprint(object);
    expect(rect.x1).toBeGreaterThanOrEqual(-0.5);
    expect(rect.y1).toBeGreaterThanOrEqual(-0.5);
    expect(rect.x2).toBeLessThanOrEqual(3000.5);
    expect(rect.y2).toBeLessThanOrEqual(3600.5);
    expect(result.best!.valid).toBe(true);
  });

  it('uses the default 0° and 90° orientations', () => {
    const result = findPlacements(projectFor(3000, 3600), bedSpec);
    for (const candidate of result.candidates) {
      expect([0, 90]).toContain(candidate.rotation);
    }
  });

  it('honours an explicit rotation restriction', () => {
    const result = findPlacements(projectFor(3000, 3600), bedSpec, {
      rotations: [180] as Rotation[],
    });
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const candidate of result.candidates) {
      expect(candidate.rotation).toBe(180);
    }
  });

  it('returns a review note instead of claiming a hard no when nothing is sampled', () => {
    const result = findPlacements(projectFor(1000, 1000), bedSpec);
    expect(result.best).toBeNull();
    expect(result.candidates).toHaveLength(0);
    expect(result.analysis).toBeNull();
    expect(result.note).toMatch(/heuristic|proof/i);
  });

  it('never overlaps existing furniture', () => {
    const wardrobe = makeWardrobe();
    const result = findPlacements(projectFor(4000, 4000, { furniture: [wardrobe] }), bedSpec);
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const [index, candidate] of result.candidates.entries()) {
      const object = candidateToObject(bedSpec, candidate, `furn_test_${index}`);
      expect(rectsOverlap(footprint(object), footprint(wardrobe))).toBe(false);
    }
  });

  it('keeps every candidate clear of the door swing', () => {
    const door = makeDoor();
    const project = projectFor(3000, 3600, { opening: door });
    const sweep = doorSweep(door, project.room);
    const result = findPlacements(project, bedSpec);
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const [index, candidate] of result.candidates.entries()) {
      const object = candidateToObject(bedSpec, candidate, `furn_test_${index}`);
      expect(rectIntersectsSweep(footprint(object), sweep)).toBe(false);
    }
  });

  it('caps results and keeps alternatives visually distinct', () => {
    const result = findPlacements(projectFor(4000, 4000), bedSpec, { maxResults: 2 });
    expect(result.candidates.length).toBeLessThanOrEqual(2);
    expect(result.candidates.length).toBeGreaterThan(0);
    for (let i = 0; i < result.candidates.length; i += 1) {
      for (let j = i + 1; j < result.candidates.length; j += 1) {
        const a = result.candidates[i];
        const b = result.candidates[j];
        const tooClose = a.rotation === b.rotation && Math.hypot(a.x - b.x, a.y - b.y) < 120;
        expect(tooClose).toBe(false);
      }
    }
  });

  it('does not mutate the source project', () => {
    const project = projectFor(3000, 3600);
    const before = JSON.stringify(project);
    findPlacements(project, bedSpec);
    expect(JSON.stringify(project)).toBe(before);
  });
});

describe('candidate conversion', () => {
  it('maps a candidate and spec into a complete furniture object', () => {
    const result = findPlacements(projectFor(3000, 3600), bedSpec);
    const candidate = result.best!;
    const object = candidateToObject(bedSpec, candidate, 'furn_fixed');
    expect(object).toMatchObject({
      id: 'furn_fixed',
      name: bedSpec.name,
      kind: bedSpec.kind,
      category: bedSpec.category,
      x: candidate.x,
      y: candidate.y,
      width: bedSpec.width,
      depth: bedSpec.depth,
      rotation: candidate.rotation,
      color: bedSpec.color,
      locked: false,
    });
  });

  it('generates a fresh furniture id by default', () => {
    const result = findPlacements(projectFor(3000, 3600), bedSpec);
    const object = candidateToObject(bedSpec, result.best!);
    expect(object.id).toMatch(/^furn_/);
  });
});

describe('size recommendations', () => {
  it('compares sizes and reports which ones have a sampled position', () => {
    const options = [
      { id: 'small', label: 'Small', width: 900, depth: 2000 },
      { id: 'large', label: 'Large', width: 2400, depth: 2000 },
    ];
    const recommendations = recommendSizes(
      projectFor(2000, 2000),
      { name: 'Bed', kind: 'bed', category: 'Bedroom', color: '#F1ECE3' },
      options,
    );

    expect(recommendations).toHaveLength(2);
    expect(recommendations.map((item) => item.option.id)).toEqual(['small', 'large']);
    expect(recommendations[0].fits).toBe(true);
    expect(recommendations[0].best).not.toBeNull();
    expect(recommendations[0].freeArea).toBeGreaterThan(0);
    expect(recommendations[1].fits).toBe(false);
    expect(recommendations[1].best).toBeNull();
    expect(recommendations[1].freeArea).toBe(0);
  });

  it('uses the same placement constraints for each alternative size', () => {
    const wardrobe = makeWardrobe();
    const recommendations = recommendSizes(
      projectFor(4000, 4000, { furniture: [wardrobe] }),
      { name: 'Bed', kind: 'bed', category: 'Bedroom', color: '#F1ECE3' },
      [
        { id: 'standard', label: 'Standard', width: 1400, depth: 2000 },
        { id: 'compact', label: 'Compact', width: 900, depth: 1900 },
      ],
    );

    for (const recommendation of recommendations) {
      if (!recommendation.best) continue;
      const object = candidateToObject(
        {
          name: 'Bed',
          kind: 'bed',
          category: 'Bedroom',
          width: recommendation.option.width,
          depth: recommendation.option.depth,
          color: '#F1ECE3',
        },
        recommendation.best,
        `furn_${recommendation.option.id}`,
      );
      expect(rectsOverlap(footprint(object), footprint(wardrobe))).toBe(false);
    }
  });
});
