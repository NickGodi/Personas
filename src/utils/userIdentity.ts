import { User } from '../types';

const CREATOR_LOGIN_ALIASES = new Set(['nicolas', 'nicolaslike']);

export const normalizeHandle = (value: string): string => {
  const clean = value.trim().replace(/^@+/, '').toLocaleLowerCase('pt-BR');
  return clean ? `@${clean}` : '';
};

/** Display-only login; the canonical database handle remains prefixed internally. */
export const displayLogin = (value: string): string => value.trim().replace(/^@+/, '');

export const normalizeRiotId = (value: string): string => value.trim().replace(/\s*#\s*/g, '#').toLocaleLowerCase('pt-BR');

export const validateUniqueUserIdentity = (users: User[], candidate: User, creatorId: string): string | null => {
  const handle = normalizeHandle(candidate.handle);
  const handleName = handle.slice(1);
  if (!/^[a-z0-9._-]{2,24}$/.test(handleName)) {
    return 'O login deve ter de 2 a 24 caracteres: letras, números, ponto, hífen ou sublinhado.';
  }
  if (candidate.id !== creatorId && CREATOR_LOGIN_ALIASES.has(handleName)) {
    return 'Esse login é reservado à conta do criador.';
  }

  const duplicateHandle = users.find((user) => user.id !== candidate.id && normalizeHandle(user.handle) === handle);
  if (duplicateHandle) return `O login "${handleName}" já pertence a ${duplicateHandle.name}. Escolha outro login.`;

  const riotId = normalizeRiotId(candidate.riotId);
  if (riotId) {
    const duplicateRiotId = users.find((user) => user.id !== candidate.id && normalizeRiotId(user.riotId) === riotId);
    if (duplicateRiotId) return `O Riot ID ${candidate.riotId.trim()} já pertence a ${duplicateRiotId.name}.`;
  }

  return null;
};
