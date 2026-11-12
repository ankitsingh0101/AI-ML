import { Memory } from '../types';

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Calculates memory strength in [0, 1] using exponential decay:
 * strength = exp(-daysSinceLastRecall / 14)
 * At >= 48 days (or if strength < 0.03), snaps cleanly to 0 so candles can go fully out.
 */
export function computeMemoryStrength(
  memory: Memory,
  nowMs: number,
  timeTravelDays: number = 0
): number {
  const effectiveNow = nowMs + timeTravelDays * MS_PER_DAY;
  const elapsedDays = Math.max(0, (effectiveNow - memory.lastRecalledAt) / MS_PER_DAY);
  const raw = Math.exp(-elapsedDays / 14);
  if (raw < 0.035) {
    return 0;
  }
  return Math.min(1, Number(raw.toFixed(3)));
}

export function getDaysSinceRecall(
  memory: Memory,
  nowMs: number,
  timeTravelDays: number = 0
): number {
  const effectiveNow = nowMs + timeTravelDays * MS_PER_DAY;
  return Math.max(0, Math.floor((effectiveNow - memory.lastRecalledAt) / MS_PER_DAY));
}

export function getStrengthLabel(strength: number): string {
  if (strength <= 0) return 'extinguished';
  if (strength < 0.3) return 'fading...';
  if (strength < 0.65) return 'steady';
  return 'radiant';
}
