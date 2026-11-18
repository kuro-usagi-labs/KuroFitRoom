import type { Unit } from '@/types';

/**
 * Unit conversion helpers. Internally RoomFit always uses integer millimetres.
 * Converting for display must never write back to the project unless the user
 * explicitly edits a field.
 */

export const UNIT_FACTOR: Record<Unit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
};

export const UNIT_LABEL: Record<Unit, string> = {
  mm: 'mm',
  cm: 'cm',
  m: 'm',
};

export function mmToUnit(mm: number, unit: Unit): number {
  const value = mm / UNIT_FACTOR[unit];
  const decimals = unit === 'mm' ? 0 : unit === 'cm' ? 1 : 2;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function unitToMm(value: number, unit: Unit): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * UNIT_FACTOR[unit]);
}

/** Rounded display number, without unit suffix. */
export function formatNumber(mm: number, unit: Unit): string {
  return mmToUnit(mm, unit).toString();
}

export function formatLength(mm: number, unit: Unit): string {
  const value = mmToUnit(mm, unit);
  return `${value} ${UNIT_LABEL[unit]}`;
}

/** Compact, human readable length: 120 cm, 1.6 m, 800 mm. */
export function formatSmartLength(mm: number): string {
  if (Math.abs(mm) < 1000) return `${Math.round(mm)} mm`;
  return `${Math.round(mm / 10) / 100} m`;
}

export function formatArea(mm2: number): string {
  return `${(mm2 / 1_000_000).toFixed(2)} m²`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function uid(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
