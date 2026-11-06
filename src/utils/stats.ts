import type { UserStats } from '../types';

const readCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;

/** Normalizes prior saves without inventing match statistics that were never recorded. */
export function normalizeStats(input: unknown): UserStats {
  const stats = input && typeof input === 'object' ? input as Record<string, unknown> : {};

  return {
    kills: readCount(stats.kills),
    deaths: readCount(stats.deaths),
    assists: readCount(stats.assists),
    minions: readCount(stats.minions),
    gold: readCount(stats.gold),
  };
}

export function formatKda(stats: Pick<UserStats, 'kills' | 'deaths' | 'assists'>): string {
  return `${stats.kills}/${stats.deaths}/${stats.assists}`;
}

export function formatGold(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString('pt-BR');
}
