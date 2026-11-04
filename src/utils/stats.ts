import { UserStats } from '../types';

const readNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Normalizes older browser saves that used the former skill/luck/tilt fields. */
export function normalizeStats(input: unknown): UserStats {
  const stats = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const legacySkill = readNumber(stats.skill, 50);
  const legacyTilt = readNumber(stats.tilte, 50);

  return {
    kills: readNumber(stats.kills, 0),
    deaths: readNumber(stats.deaths, 0),
    assists: readNumber(stats.assists, 0),
    wards: readNumber(stats.wards, Math.max(3, Math.round(legacySkill / 8))),
    damageDealt: readNumber(stats.damageDealt, 10_000 + legacySkill * 250),
    damageReceived: readNumber(stats.damageReceived, 9_000 + legacyTilt * 180),
  };
}

export function formatDamage(value: number): string {
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.', ',')}k`;
  return String(value);
}
