import type { User, UserStats } from '../types';

export interface ExtractedMatchStats {
  playerName: string | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  minions: number | null;
  gold: number | null;
  notes?: string;
}

const integerLimits: Record<keyof UserStats, number> = {
  kills: 100,
  deaths: 100,
  assists: 100,
  minions: 2_000,
  gold: 1_000_000,
};

export function parseOcrInteger(value: unknown): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim().replace(/\s/g, '');
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(trimmed)) return Number(trimmed.replace(/[.,]/g, ''));
  return null;
}

export function parseOcrMatchStats(responseText: string): ExtractedMatchStats {
  const withoutFence = responseText.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const jsonText = withoutFence.startsWith('{')
    ? withoutFence
    : withoutFence.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) throw new Error('A imagem não produziu dados legíveis. Tente um print mais nítido.');

  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(jsonText);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    parsed = value as Record<string, unknown>;
  } catch {
    throw new Error('O OCR retornou um formato inválido. Tente enviar o print novamente.');
  }

  const rawName = parsed.playerName ?? parsed.player ?? parsed.name ?? parsed.nick;
  const playerName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null;
  const rawStats = parsed.stats && typeof parsed.stats === 'object'
    ? parsed.stats as Record<string, unknown>
    : parsed;

  const stats = {} as Pick<ExtractedMatchStats, keyof UserStats>;
  (Object.keys(integerLimits) as (keyof UserStats)[]).forEach((key) => {
    const value = parseOcrInteger(rawStats[key] ?? (key === 'minions' ? rawStats.cs : undefined));
    stats[key] = value !== null && value <= integerLimits[key] ? value : null;
  });

  const notes = typeof parsed.notes === 'string' ? parsed.notes.slice(0, 300) : undefined;
  return { playerName, ...stats, ...(notes ? { notes } : {}) };
}

export function normalizePlayerLookup(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9]/g, '');
}

export function matchOcrPlayerName(playerName: string | null, users: User[]): { userId?: string; ambiguous: boolean } {
  const query = normalizePlayerLookup(playerName || '');
  if (query.length < 2) return { ambiguous: false };

  const aliasesByUser = users.map((user) => ({
    user,
    aliases: [user.name, user.handle, user.riotId.split('#')[0]]
      .map(normalizePlayerLookup)
      .filter(Boolean),
  }));
  const exact = aliasesByUser.filter(({ aliases }) => aliases.includes(query));
  if (exact.length === 1) return { userId: exact[0].user.id, ambiguous: false };
  if (exact.length > 1) return { ambiguous: true };

  if (query.length < 3) return { ambiguous: false };
  const partial = aliasesByUser.filter(({ aliases }) => aliases.some((alias) => alias.includes(query) || query.includes(alias)));
  if (partial.length === 1) return { userId: partial[0].user.id, ambiguous: false };
  return { ambiguous: partial.length > 1 };
}

export function isCompleteMatchStats(stats: ExtractedMatchStats): stats is ExtractedMatchStats & UserStats {
  return (Object.keys(integerLimits) as (keyof UserStats)[]).every((key) =>
    typeof stats[key] === 'number' && Number.isSafeInteger(stats[key]) && stats[key]! >= 0 && stats[key]! <= integerLimits[key],
  );
}
