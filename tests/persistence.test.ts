import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Project } from '@/types';
import {
  ProjectValidationError,
  duplicateProject,
  parseProjectJSON,
  serializeProject,
  validateProject,
} from '@/storage/schema';
import {
  clearAllProjects,
  deleteProjectRecord,
  isStorageFallback,
  listProjects,
  loadProject,
  saveProject,
} from '@/storage/db';
import {
  SCHEMA_VERSION,
  createSampleProject,
} from '@/features/project-manager/defaults';

function rawProject(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(createSampleProject())) as Record<string, unknown>;
}

function expectValidationError(run: () => unknown, pattern: RegExp) {
  expect(run).toThrow(ProjectValidationError);
  expect(run).toThrow(pattern);
}

describe('project validation', () => {
  it('normalises a valid project without changing its identity', () => {
    const sample = createSampleProject();
    const project = validateProject(JSON.parse(JSON.stringify(sample)));
    expect(project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(project.id).toBe(sample.id);
    expect(project.name).toBe(sample.name);
    expect(project.room).toEqual(sample.room);
    expect(project.furniture).toEqual(sample.furniture);
  });

  it('rejects a payload without room data', () => {
    const raw = rawProject();
    delete raw.room;
    expectValidationError(() => validateProject(raw), /missing room/i);
  });

  it('rejects a room smaller than 30 cm', () => {
    const raw = rawProject();
    (raw.room as Record<string, unknown>).width = 200;
    expectValidationError(() => validateProject(raw), /at least 30 cm/i);
  });

  it('rejects projects written by a newer schema', () => {
    const raw = rawProject();
    raw.schemaVersion = SCHEMA_VERSION + 1;
    expectValidationError(() => validateProject(raw), /newer version/i);
  });

  it('falls back to safe defaults for missing settings', () => {
    const raw = rawProject();
    delete raw.settings;
    const project = validateProject(raw);
    expect(project.settings.unit).toBe('cm');
    expect(project.settings.gridSize).toBe(100);
    expect(project.settings.clearances.walkwayLimited).toBe(600);
    expect(project.settings.clearances.installationGap).toBe(30);
  });

  it('normalises an unknown rotation, kind and category', () => {
    const raw = rawProject();
    const furniture = raw.furniture as Record<string, unknown>[];
    furniture[0].rotation = 45;
    furniture[0].kind = 'spaceship';
    furniture[0].category = 'Alien';
    const project = validateProject(raw);
    expect(project.furniture[0].rotation).toBe(0);
    expect(project.furniture[0].kind).toBe('custom');
    expect(project.furniture[0].category).toBe('Custom');
  });

  it('rejects furniture smaller than 5 cm', () => {
    const raw = rawProject();
    const furniture = raw.furniture as Record<string, unknown>[];
    furniture[0].width = 10;
    expectValidationError(() => validateProject(raw), /invalid size/i);
  });

  it('rejects openings narrower than 20 cm', () => {
    const raw = rawProject();
    const openings = raw.openings as Record<string, unknown>[];
    openings[0].width = 100;
    expectValidationError(() => validateProject(raw), /narrower than 20 cm/i);
  });

  it('rejects malformed JSON with a friendly validation error', () => {
    expectValidationError(() => parseProjectJSON('{ this is not json'), /not valid JSON/i);
  });

  it('round-trips a serialized project', () => {
    const sample = createSampleProject();
    const parsed = parseProjectJSON(serializeProject(sample));
    expect(parsed).toEqual(sample);
  });

  it('duplicates a project with fresh independent identifiers', () => {
    const sample = createSampleProject();
    const copy = duplicateProject(sample);
    expect(copy.id).not.toBe(sample.id);
    expect(copy.name).toBe(`${sample.name} copy`);
    expect(copy.furniture[0].id).not.toBe(sample.furniture[0].id);
    expect(copy.openings[0].id).not.toBe(sample.openings[0].id);
    expect(copy.furniture.map((item) => item.name)).toEqual(
      sample.furniture.map((item) => item.name),
    );
    expect(copy.activeLayoutId).toBeNull();
  });
});

describe('IndexedDB project storage', () => {
  beforeEach(async () => {
    await clearAllProjects();
  });

  it('uses the real IndexedDB backend under fake-indexeddb', () => {
    expect(isStorageFallback()).toBe(false);
  });

  it('saves and loads a project by id', async () => {
    const sample = createSampleProject();
    await saveProject(sample);
    const loaded = await loadProject(sample.id);
    expect(loaded?.name).toBe(sample.name);
    expect(loaded?.room).toEqual(sample.room);
    expect(loaded?.furniture.map((item) => item.id)).toEqual(
      sample.furniture.map((item) => item.id),
    );
  });

  it('returns null for an unknown project id', async () => {
    expect(await loadProject('project_does_not_exist')).toBeNull();
  });

  it('updates the stored timestamp when saving', async () => {
    const sample = createSampleProject();
    sample.updatedAt = 1000;
    await saveProject(sample);
    const loaded = await loadProject(sample.id);
    expect(loaded?.updatedAt).toBeGreaterThan(1000);
  });

  it('lists saved projects newest first', async () => {
    const first = createSampleProject();
    first.name = 'First project';
    await saveProject(first);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = createSampleProject();
    second.name = 'Second project';
    await saveProject(second);

    const projects = await listProjects();
    expect(projects.map((project) => project.name)).toEqual(['Second project', 'First project']);
  });

  it('persists edits made to an already saved project', async () => {
    const sample = createSampleProject();
    await saveProject(sample);
    const edited: Project = { ...sample, name: 'Renamed room' };
    await saveProject(edited);
    expect((await loadProject(sample.id))?.name).toBe('Renamed room');
  });

  it('deletes a single project without touching the others', async () => {
    const first = createSampleProject();
    const second = createSampleProject();
    await saveProject(first);
    await saveProject(second);
    await deleteProjectRecord(first.id);

    expect(await loadProject(first.id)).toBeNull();
    expect(await loadProject(second.id)).not.toBeNull();
    expect((await listProjects()).map((project) => project.id)).toEqual([second.id]);
  });

  it('clears every saved project', async () => {
    await saveProject(createSampleProject());
    await saveProject(createSampleProject());
    await clearAllProjects();
    expect(await listProjects()).toEqual([]);
  });
});
