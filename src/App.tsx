import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  User, 
  CardItem, 
  MatchDeckCard, 
  Team, 
  DraftPreset, 
  ReportItem, 
  NotificationItem, 
  VoteRecord,
  EloTier,
  UserRole,
  ActiveSeason,
  SeasonArchive,
  SeasonCommentArchive,
  PlayerComment,
  CardOrnamentSettings,
  SharedTournamentState,
  CaptainRerollRequest,
  InterClassDraw,
  Lane,
  MatchRecord,
  TestRole,
} from './types';
import { 
  INITIAL_USERS, 
  INITIAL_PRESETS,
  getTierFromScore 
} from './data/initialData';
import { PERSONAS_INITIAL_MATCH_DECK } from './data/personasCustomDeck';
import { Navbar } from './components/Navbar';
import { PORTABLE_CARD_ORNAMENT_SETTINGS } from './data/cardOrnamentSettings';
import { RankedCard } from './components/RankedCard';
import { CardRoulette } from './components/CardRoulette';
import { TeamDraft } from './components/TeamDraft';
import { VotingSection } from './components/VotingSection';
import { CreatorPanel } from './components/CreatorPanel';
import { RulesSection } from './components/RulesSection';
import { OcrParserModal } from './components/OcrParserModal';
import { ProfileModal } from './components/ProfileModal';
import { LoginModal } from './components/LoginModal';
import { ReportModal } from './components/ReportModal';
import { StatisticsSection } from './components/StatisticsSection';
import { SeasonControlBanner } from './components/SeasonControlBanner';
import { SeasonCelebration } from './components/SeasonCelebration';
import mascotAvatar from './assets/images/personas_duck_mascot_1793729518059.jpg';
import { readStorage, writeStorage } from './utils/storage';
import { CARD_ORNAMENT_SETTINGS_VERSION, CARD_ORNAMENT_SETTINGS_VERSION_KEY, CARD_ORNAMENT_STORAGE_KEY, DEFAULT_CARD_ORNAMENT_SETTINGS, loadCardOrnamentSettings, loadTierCardOrnamentSettings, migrateCardOrnamentSettings, normalizeCardOrnamentSettings, normalizeTierCardOrnamentSettings, ORNAMENT_TIER_ORDER, TIER_CARD_ORNAMENT_STORAGE_KEY } from './utils/cardOrnament';
import { formatGold, formatKda, normalizeStats } from './utils/stats';
import { displayLogin, normalizeHandle, normalizeRiotId, validateUniqueUserIdentity } from './utils/userIdentity';
import { supabase, getSupabaseAuthorizationHeaders, loadAuthenticatedProfile, loadRegisteredProfiles, loadSharedCardOrnamentSettings, loadSharedNotifications, loadSharedPlayerMatchRecords, loadSharedSeasonControl, loadSharedSeasonVotes, mergeRegisteredProfiles, saveAuthenticatedProfile, saveSharedCardOrnamentSettings, saveSharedNotification, saveSharedPlayerMatchRecord, saveSharedPlayerMatchStats, saveSharedSeasonControl, saveSharedSeasonVote, setSharedNotificationRead, deleteSharedNotification, deleteAllSharedNotifications, deleteSharedSeasonVotes, deleteRegisteredAccount } from './lib/supabase';
import { 
  Sparkles, 
  Trophy, 
  Flame, 
  Search,
  FlaskConical,
} from 'lucide-react';

// Strict tier rank hierarchy (from highest to lowest)
const TIER_ORDER: Record<EloTier, number> = {
  lenda: 1,
  challenger: 2,
  grao_mestre: 3,
  mestre: 4,
  diamante: 5,
  esmeralda: 6,
  platina: 7,
  ouro: 8,
  prata: 9,
  bronze: 10,
  ferro: 11,
  madeira: 12,
  criminoso: 13,
  mencao_honrosa: 14,
};

const createPlayerCard = (user: User, season: number, score: number, isMvp = false): CardItem => ({
  id: `card_${user.id}_s${season}_${Date.now()}`,
  userId: user.id,
  userName: user.name,
  userHandle: user.handle,
  userAvatar: user.avatar,
  season,
  score,
  tier: getSeasonCardTier(score, false, season),
  lane: user.primaryLane,
  favoriteChampion: user.favoriteChampion,
  isMvp,
  isAce: false,
  isCriminoso: false,
  isLegend: season >= 4 && Boolean(user.isLegend),
  stats: { ...user.stats },
  date: new Date().toLocaleDateString('pt-BR'),
});

const getSeasonCardTier = (score: number, isCriminoso: boolean, season: number): EloTier => {
  const tier = getTierFromScore(score, isCriminoso);
  return tier === 'lenda' && season < 4 ? 'challenger' : tier;
};

const reconcileSeasonCriminalCards = (cards: CardItem[], archives: SeasonArchive[]): CardItem[] => {
  const criminalBySeason = new Map(archives.map((archive) => [
    archive.number,
    archive.criminalUserId || (archive.playerSnapshots || []).find((player) => player.tier === 'criminoso')?.userId || null,
  ] as const));

  return cards.map((card) => {
    const isCriminoso = criminalBySeason.get(card.season) === card.userId;
    const tier = getSeasonCardTier(card.score, isCriminoso, card.season);
    return card.isCriminoso === isCriminoso && card.tier === tier
      ? card
      : { ...card, isCriminoso, tier };
  });
};

const selectSeasonCriminalId = (users: User[], votes: VoteRecord[], seasonNumber: number, attendeeIds: string[]) => {
  const seasonTotals = new Map<string, { sum: number; count: number }>();
  votes.filter((vote) => vote.season === seasonNumber).forEach((vote) => {
    const total = seasonTotals.get(vote.targetUserId) || { sum: 0, count: 0 };
    seasonTotals.set(vote.targetUserId, { sum: total.sum + vote.score, count: total.count + 1 });
  });

  const ratedCandidates = users
    .filter((user) => seasonTotals.has(user.id))
    .map((user) => ({ user, average: seasonTotals.get(user.id)!.sum / seasonTotals.get(user.id)!.count }));
  const presentCandidates = users
    .filter((user) => attendeeIds.includes(user.id))
    .map((user) => ({ user, average: null as number | null }));
  const candidates = ratedCandidates.length ? ratedCandidates : presentCandidates.length ? presentCandidates : users.map((user) => ({ user, average: null as number | null }));

  const kda = (user: User) => (user.stats.kills + user.stats.assists) / Math.max(1, user.stats.deaths);
  return [...candidates].sort((a, b) => {
    if (a.average !== null && b.average !== null && a.average !== b.average) return a.average - b.average;
    if (a.average !== null && b.average === null) return -1;
    if (a.average === null && b.average !== null) return 1;
    const kdaDifference = kda(a.user) - kda(b.user);
    if (kdaDifference) return kdaDifference;
    if (a.user.stats.deaths !== b.user.stats.deaths) return b.user.stats.deaths - a.user.stats.deaths;
    if (a.user.stats.minions !== b.user.stats.minions) return a.user.stats.minions - b.user.stats.minions;
    if (a.user.stats.gold !== b.user.stats.gold) return a.user.stats.gold - b.user.stats.gold;
    return a.user.name.localeCompare(b.user.name, 'pt-BR');
  })[0]?.user.id ?? null;
};

const normalizeCardList = (cards: CardItem[]): CardItem[] => {
  const normalized = cards.map((card) => ({ ...card, stats: normalizeStats(card.stats) }));
  const seasonCounts = new Map<number, number>();
  const seasonUsers = new Map<number, Set<string>>();
  return normalized.filter((card) => {
    if (!card.isLegend) return true;
    const count = seasonCounts.get(card.season) || 0;
    const usersInSeason = seasonUsers.get(card.season) || new Set<string>();
    if (count >= 3 || usersInSeason.has(card.userId)) return false;
    seasonCounts.set(card.season, count + 1);
    usersInSeason.add(card.userId);
    seasonUsers.set(card.season, usersInSeason);
    return true;
  });
};

const ProfileOnlyCard: React.FC<{ user: User; onClick: () => void }> = ({ user, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Abrir perfil de ${user.name}`}
    className="group flex min-h-[360px] w-[260px] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900 via-slate-950 to-black text-left shadow-xl transition duration-200 hover:-translate-y-1 hover:border-amber-500/60 hover:shadow-amber-950/30 focus-visible:outline-2 focus-visible:outline-amber-400"
  >
    <span className="flex h-9 w-full items-center justify-between border-b border-slate-800 bg-slate-950/95 px-3">
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Perfil do jogador</span>
      <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[9px] font-bold tracking-wider text-slate-300">SEM MÉDIA</span>
    </span>
    <span className="relative flex h-[210px] w-full items-center justify-center overflow-hidden bg-slate-900/80 p-3">
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(148,163,184,0.16),transparent_70%)]" />
      <img src={user.avatar} alt={`Foto de ${user.name}`} className="relative z-10 h-full w-full object-contain drop-shadow-lg" />
    </span>
    <span className="flex flex-1 flex-col items-center justify-center border-t border-slate-800 px-4 py-5 text-center">
      <span className="max-w-full truncate font-display text-lg font-black uppercase tracking-wide text-white group-hover:text-amber-200">{user.name}</span>
      <span className="mt-1 font-mono text-xs text-slate-400">{displayLogin(user.handle)}</span>
      <span className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {user.primaryLane === 'JUNGLE' ? 'JUNGLER' : user.primaryLane === 'PREENCHER' ? 'PREENCHER' : user.primaryLane}
      </span>
      <span className="mt-4 text-xs text-slate-500">Perfil sem carta ranqueada</span>
      <span className="mt-3 text-[11px] font-mono text-amber-300">Abrir perfil →</span>
    </span>
  </button>
);

const MVP_CARD_FLAG_MIGRATION_KEY = 'personas_mvp_match_only_v1';
const SHARED_TOURNAMENT_STORAGE_KEY = 'personas_shared_tournament_v1';
const FIRST_SEASON_RESET_MIGRATION_KEY = 'personas_first_season_reset_v1';
const FIRST_SEASON_VOTE_RESET_MIGRATION_KEY = 'personas_first_season_vote_reset_v1';
const SEASON_COMMENT_ARCHIVE_STORAGE_KEY = 'personas_comments_by_season_v1';
const BRUTUS_DEMO_STATS_RESET_KEY = 'personas_brutus_demo_stats_reset_v1';
const EMPTY_MATCH_STATS: User['stats'] = { kills: 0, deaths: 0, assists: 0, minions: 0, gold: 0 };

const averageMatchStats = (records: MatchRecord[]): User['stats'] => {
  if (!records.length) return { ...EMPTY_MATCH_STATS };
  const sum = records.reduce((total, record) => ({
    kills: total.kills + record.stats.kills,
    deaths: total.deaths + record.stats.deaths,
    assists: total.assists + record.stats.assists,
    minions: total.minions + record.stats.minions,
    gold: total.gold + record.stats.gold,
  }), { ...EMPTY_MATCH_STATS });
  return {
    kills: Math.round(sum.kills / records.length),
    deaths: Math.round(sum.deaths / records.length),
    assists: Math.round(sum.assists / records.length),
    minions: Math.round(sum.minions / records.length),
    gold: Math.round(sum.gold / records.length),
  };
};

const getCommentSeason = (
  targetUserId: string,
  comment: PlayerComment,
  votes: VoteRecord[],
  archives: SeasonArchive[],
  activeSeasonNumber: number,
): number => {
  if (Number.isInteger(comment.season)) return comment.season!;

  const matchingVote = votes.find((vote) => (
    vote.targetUserId === targetUserId
    && vote.score === comment.scoreGiven
    && (vote.fromUserId === comment.authorId
      || normalizeHandle(vote.fromUserHandle) === normalizeHandle(comment.authorHandle))
    && vote.comment?.trim() === comment.text.trim()
  ));
  if (matchingVote) return matchingVote.season;

  // Preserve the original demo comments as season-one history, never as live comments.
  if (comment.id === 'c_1' || comment.id === 'c_2') return 1;

  const createdAt = Date.parse(comment.createdAt);
  if (Number.isFinite(createdAt)) {
    const matchingArchive = archives.find((archive) => {
      if (!archive.startedAt) return false;
      const startedAt = Date.parse(archive.startedAt);
      const endedAt = Date.parse(archive.endedAt);
      return Number.isFinite(startedAt) && Number.isFinite(endedAt) && createdAt >= startedAt && createdAt <= endedAt;
    });
    if (matchingArchive) return matchingArchive.number;
  }

  const latestCompletedSeason = archives
    .filter((archive) => archive.number < activeSeasonNumber)
    .sort((a, b) => b.number - a.number)[0];
  return latestCompletedSeason?.number ?? Math.max(1, activeSeasonNumber - 1);
};

const mergeSeasonCommentArchive = (
  previous: SeasonCommentArchive,
  incoming: SeasonCommentArchive,
): SeasonCommentArchive => {
  let changed = false;
  const next = { ...previous };
  Object.entries(incoming).forEach(([seasonKey, users]) => {
    const season = Number(seasonKey);
    const existingUsers = next[season] || {};
    let seasonChanged = false;
    const mergedUsers = { ...existingUsers };
    Object.entries(users).forEach(([userId, comments]) => {
      const existingComments = existingUsers[userId] || [];
      const existingIds = new Set(existingComments.map((comment) => comment.id));
      const newComments = comments.filter((comment) => !existingIds.has(comment.id));
      if (!newComments.length) return;
      seasonChanged = true;
      mergedUsers[userId] = [...newComments, ...existingComments];
    });
    if (!seasonChanged) return;
    changed = true;
    next[season] = mergedUsers;
  });
  return changed ? next : previous;
};

const resetLegacyBrutusDemoStats = () => {
  if (readStorage<boolean>(BRUTUS_DEMO_STATS_RESET_KEY, false)) return;
  const savedUsers = readStorage<User[]>('personas_users_v2', INITIAL_USERS);
  const target = savedUsers.find((user) => user.id === 'user_brutus');
  if (!target) return;
  const activeSeason = readStorage<ActiveSeason>('personas_active_season_v1', { number: 1, status: 'ready', startedAt: null, endsAt: null });
  const records = readStorage<MatchRecord[]>('personas_match_records_v1', []);
  const hasRecordedMatch = records.some((record) => record.playerId === target.id && record.season === activeSeason.number);
  const stats = normalizeStats(target.stats);
  const isSeedStats = stats.kills === 3 && stats.deaths === 8 && stats.assists === 3 && stats.minions === 0 && stats.gold === 0;
  if (!hasRecordedMatch && isSeedStats) {
    writeStorage('personas_users_v2', savedUsers.map((user) => user.id === target.id ? { ...user, stats: { ...EMPTY_MATCH_STATS } } : user));
    const savedCards = readStorage<CardItem[]>('personas_cards_v2', []);
    writeStorage('personas_cards_v2', savedCards.map((card) => {
      const cardStats = normalizeStats(card.stats);
      const hasRecordedSeasonMatch = records.some((record) => record.playerId === target.id && record.season === card.season);
      return card.userId === target.id && !hasRecordedSeasonMatch
        && cardStats.kills === 3 && cardStats.deaths === 8 && cardStats.assists === 3
        ? { ...card, stats: { ...EMPTY_MATCH_STATS } }
        : card;
    }));
  }
  writeStorage(BRUTUS_DEMO_STATS_RESET_KEY, true);
};

const normalizeSharedTournament = (value?: Partial<SharedTournamentState> | null): SharedTournamentState => {
  const attendeeIds = [...new Set((Array.isArray(value?.attendeeIds) ? value.attendeeIds : [])
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0))];
  const rawCaptains = Array.isArray(value?.captainIds) ? value.captainIds : ['', ''];
  const firstCaptain = attendeeIds.includes(rawCaptains[0] || '') ? rawCaptains[0] : '';
  const secondCaptain = rawCaptains[1] && rawCaptains[1] !== firstCaptain && attendeeIds.includes(rawCaptains[1])
    ? rawCaptains[1]
    : '';
  const captainIds: [string, string] = [firstCaptain || '', secondCaptain || ''];
  const tournamentStarted = Boolean(value?.tournamentStarted) && attendeeIds.length > 0 && captainIds.every(Boolean);
  const attendeeSet = new Set(attendeeIds);
  const teams = (Array.isArray(value?.teams) ? value.teams : [])
    .filter((team) => attendeeSet.has(team.captainId) && (tournamentStarted || captainIds.includes(team.captainId)))
    .map((team) => ({
      ...team,
      members: [...new Set([
        ...(attendeeSet.has(team.captainId) ? [team.captainId] : []),
        ...team.members.filter((id) => attendeeSet.has(id)),
      ])].slice(0, 5),
    }));
  const rawReroll = value?.captainRerollRequest;
  const captainRerollRequest: CaptainRerollRequest | null = rawReroll
    && typeof rawReroll.id === 'string'
    && typeof rawReroll.requesterId === 'string'
    && typeof rawReroll.requesterName === 'string'
    && typeof rawReroll.opponentId === 'string'
    && (rawReroll.status === 'waiting_opponent' || rawReroll.status === 'waiting_creator')
    && Number.isFinite(rawReroll.createdAt)
    ? {
        id: rawReroll.id,
        requesterId: rawReroll.requesterId,
        requesterName: rawReroll.requesterName,
        opponentId: rawReroll.opponentId,
        status: rawReroll.status,
        ...(typeof rawReroll.acceptedBy === 'string' ? { acceptedBy: rawReroll.acceptedBy } : {}),
        ...(typeof rawReroll.acceptedByName === 'string' ? { acceptedByName: rawReroll.acceptedByName } : {}),
        createdAt: rawReroll.createdAt,
      }
    : null;
  const rawInterClassDraw = value?.interClassDraw;
  const interClassDraw: InterClassDraw | null = rawInterClassDraw
    && typeof rawInterClassDraw.cardId === 'string'
    && typeof rawInterClassDraw.blueClass === 'string'
    && typeof rawInterClassDraw.redClass === 'string'
    && Number.isFinite(rawInterClassDraw.drawnAt)
    ? {
        cardId: rawInterClassDraw.cardId,
        blueClass: rawInterClassDraw.blueClass,
        redClass: rawInterClassDraw.redClass,
        drawnAt: rawInterClassDraw.drawnAt,
      }
    : null;

  return {
    updatedAt: value?.updatedAt || 0,
    ...(Number.isFinite(value?.seasonResetAt) ? { seasonResetAt: value?.seasonResetAt } : {}),
    confirmedDeckCardId: typeof value?.confirmedDeckCardId === 'string' ? value.confirmedDeckCardId : null,
    captainRerollRequest,
    interClassDraw,
    ...(Number.isFinite(value?.attendanceSeason) ? { attendanceSeason: value?.attendanceSeason } : {}),
    tournamentStarted,
    attendeeIds,
    captainIds,
    draftMode: value?.draftMode || 'random',
    seriesFormat: value?.seriesFormat || 'MD3',
    predefinedTeams: value?.predefinedTeams || null,
    captainDraftTurn: tournamentStarted ? value?.captainDraftTurn ?? null : null,
    playerPoolIds: (value?.playerPoolIds || []).filter((id) => attendeeSet.has(id)),
    draftStage: tournamentStarted ? value?.draftStage || 'setup' : 'setup',
    teams,
  };
};

const loadInitialCards = (): CardItem[] => {
  const savedCards = readStorage<CardItem[]>('personas_cards_v2', []);
  const savedVotes = readStorage<VoteRecord[]>('personas_votes_v1', []);
  const savedArchives = readStorage<SeasonArchive[]>('personas_season_archives_v1', []);
  const votedUserIds = new Set(savedVotes.map((vote) => vote.targetUserId));
  const cardsWithVotes = reconcileSeasonCriminalCards(savedCards, savedArchives).filter((card) =>
    votedUserIds.has(card.userId)
  );
  if (!readStorage<boolean>(MVP_CARD_FLAG_MIGRATION_KEY, false)) {
    writeStorage(MVP_CARD_FLAG_MIGRATION_KEY, true);
    const migratedCards = normalizeCardList(cardsWithVotes.map((card) => ({ ...card, isMvp: false })));
    writeStorage('personas_cards_v2', migratedCards);
    return migratedCards;
  }
  const normalizedCards = normalizeCardList(cardsWithVotes);
  writeStorage('personas_cards_v2', normalizedCards);
  return normalizedCards;
};

const normalizeUserList = (users: User[]): User[] => {
  const usedHandles = new Set<string>();
  const usedRiotIds = new Set<string>();
  const reservedCreatorLogins = new Set(['nicolas', 'nicolaslike']);
  return users.map((user) => {
    const normalized = { ...user } as User & { password?: string; email?: string };
    // Remove any plaintext passwords left by older local demo builds.
    delete normalized.password;
    delete normalized.email;
    delete normalized.secondaryLane;
    const knownLanes = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPORTE', 'PREENCHER'];
    let handle = normalizeHandle(user.handle);
    if (user.id === 'user_nicolas' && ['@nicolas', '@nicolaslike'].includes(handle)) handle = '@nick';
    // Corrige o @ duplicado já presente nos dados antigos do Nick Presidiário.
    if (user.id === 'user_nick' && handle === '@nick') handle = '@nickpresidiario';

    const baseHandle = handle.slice(1) || 'jogador';
    let uniqueHandle = handle;
    let handleSuffix = 2;
    while (
      usedHandles.has(uniqueHandle) ||
      (user.id !== 'user_nicolas' && reservedCreatorLogins.has(uniqueHandle.slice(1)))
    ) {
      uniqueHandle = `@${baseHandle}-${handleSuffix++}`;
    }
    usedHandles.add(uniqueHandle);

    let riotId = user.riotId.trim();
    if (user.id === 'user_nick' && normalizeRiotId(riotId) === 'nick#br1') riotId = 'NickPresidiario#BR1';
    const [gameName, tagline] = riotId.split('#');
    let uniqueRiotId = riotId;
    let riotSuffix = 2;
    while (uniqueRiotId && usedRiotIds.has(normalizeRiotId(uniqueRiotId))) {
      uniqueRiotId = tagline ? `${gameName}${riotSuffix++}#${tagline}` : `${riotId}-${riotSuffix++}`;
    }
    if (uniqueRiotId) usedRiotIds.add(normalizeRiotId(uniqueRiotId));

    return {
      ...normalized,
      isOnline: false,
      role: user.role === 'criador' ? 'criador' : 'jogador',
      primaryLane: knownLanes.includes(user.primaryLane) ? user.primaryLane : 'PREENCHER',
      // Criminal status belongs to a completed season card, never to a live player profile.
      isCriminoso: false,
      handle: uniqueHandle,
      riotId: uniqueRiotId,
      stats: normalizeStats(user.stats),
    };
  });
};

const resetSeasonHistoryForFirstSeason = () => {
  if (readStorage<boolean>(FIRST_SEASON_RESET_MIGRATION_KEY, false)) return;

  const savedSeason = readStorage<ActiveSeason>('personas_active_season_v1', {
    number: 4,
    status: 'ready',
    startedAt: null,
    endsAt: null,
  });
  const savedCards = readStorage<CardItem[]>('personas_cards_v2', []);
  const currentSeasonCards = savedCards.filter((card) => card.season === savedSeason.number);
  const latestSavedSeason = savedCards.reduce((latest, card) => Math.max(latest, card.season), 0);
  const cardsToKeep = currentSeasonCards.length
    ? currentSeasonCards
    : savedCards.filter((card) => card.season === latestSavedSeason);
  const uniqueCards = new Map<string, CardItem>();

  for (const card of cardsToKeep) {
    if (uniqueCards.has(card.userId)) continue;
    uniqueCards.set(card.userId, {
      ...card,
      season: 1,
      tier: card.isLegend && card.tier === 'lenda' ? 'challenger' : card.tier,
      isLegend: false,
      isMvp: false,
      isAce: false,
      isMencaoHonrosa: false,
    });
  }

  const savedUsers = readStorage<User[]>('personas_users_v2', INITIAL_USERS);
  writeStorage('personas_users_v2', savedUsers.map((user) => ({ ...user, seasonsPlayed: 0 })));
  writeStorage('personas_cards_v2', [...uniqueCards.values()]);
  writeStorage('personas_active_season_v1', {
    number: 1,
    status: 'ready',
    startedAt: null,
    endsAt: null,
  } satisfies ActiveSeason);
  writeStorage('personas_season_archives_v1', [] as SeasonArchive[]);
  writeStorage('personas_votes_v1', [] as VoteRecord[]);
  writeStorage(FIRST_SEASON_RESET_MIGRATION_KEY, true);
};

resetSeasonHistoryForFirstSeason();

const resetVoteCountsForFirstSeason = () => {
  if (readStorage<boolean>(FIRST_SEASON_VOTE_RESET_MIGRATION_KEY, false)) return;

  const savedUsers = readStorage<User[]>('personas_users_v2', INITIAL_USERS);
  writeStorage('personas_users_v2', savedUsers.map((user) => ({ ...user, totalVotes: 0 })));
  writeStorage('personas_votes_v1', [] as VoteRecord[]);
  writeStorage(FIRST_SEASON_VOTE_RESET_MIGRATION_KEY, true);
};

resetVoteCountsForFirstSeason();
const INITIAL_APP_CARDS = loadInitialCards();

const loadDeck = (): MatchDeckCard[] => {
  const currentDeck = readStorage<MatchDeckCard[] | null>('personas_deck_v3', null);
  if (Array.isArray(currentDeck)) return currentDeck;

  const legacyDeck = readStorage<MatchDeckCard[] | null>('personas_deck_v2', null);
  const isOldUncustomizedCatalog = Array.isArray(legacyDeck)
    && legacyDeck.length >= 28
    && legacyDeck.every((card) => !card.backgroundImage);

  // Keep customized local decks, but replace the old photo-less 28-card catalog
  // with the creator's portable 18-card deck on the first upgraded launch.
  return Array.isArray(legacyDeck) && !isOldUncustomizedCatalog
    ? legacyDeck
    : PERSONAS_INITIAL_MATCH_DECK;
};

export default function App() {
  resetLegacyBrutusDemoStats();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const savedTheme = readStorage<'dark' | 'light'>('personas_theme_v1', 'dark');
    return savedTheme === 'light' ? 'light' : 'dark';
  });
  const [cardOrnamentSettings, setCardOrnamentSettings] = useState<CardOrnamentSettings>(loadCardOrnamentSettings);
  const [tierOrnamentSettings, setTierOrnamentSettings] = useState(() =>
    loadTierCardOrnamentSettings(INITIAL_APP_CARDS, loadCardOrnamentSettings(), PORTABLE_CARD_ORNAMENT_SETTINGS)
  );
  const legacyTierOrnamentSettings = useRef(tierOrnamentSettings);

  // Core Data States
  const [users, setUsers] = useState<User[]>(() =>
    normalizeUserList(readStorage<User[]>('personas_users_v2', INITIAL_USERS))
  );
  const [cards, setCards] = useState<CardItem[]>(INITIAL_APP_CARDS);
  const [deck, setDeck] = useState<MatchDeckCard[]>(() =>
    loadDeck()
  );
  const [sharedTournament, setSharedTournament] = useState<SharedTournamentState>(() => {
    const saved = readStorage<Partial<SharedTournamentState> | null>(SHARED_TOURNAMENT_STORAGE_KEY, null);
    return normalizeSharedTournament(saved);
  });
  const teams = sharedTournament.teams;
  const [isSharedTournamentReady, setIsSharedTournamentReady] = useState(false);
  const [isCheckInSaving, setIsCheckInSaving] = useState(false);
  const checkInSavingRef = useRef(false);
  const [checkInError, setCheckInError] = useState('');
  const previousTournamentNotificationsRef = useRef<{ started: boolean; assignments: Map<string, string> } | null>(null);
  const [presets, setPresets] = useState<DraftPreset[]>(() =>
    readStorage('personas_presets_v2', INITIAL_PRESETS)
  );
  const [reports, setReports] = useState<ReportItem[]>(() =>
    readStorage('personas_reports_v2', [
      {
        id: 'rep_1',
        reporterId: 'user_derick',
        reporterHandle: '@derick',
        targetUserId: 'user_nick',
        targetUserHandle: '@nick',
        targetUserName: 'Nick Presidiário',
        reason: 'Descumprimento da Regra da Carta Sorteada',
        details: 'Comprou poções nos primeiros 10 minutos durante vigência da Lei Seca.',
        status: 'pendente',
        createdAt: new Date().toISOString(),
      }
    ])
  );
  const [activeSeason, setActiveSeason] = useState<ActiveSeason>(() =>
    readStorage('personas_active_season_v1', {
      number: 1,
      status: 'ready',
      startedAt: null,
      endsAt: null,
    })
  );
  const activeSeasonRef = useRef(activeSeason);
  const [seasonEvent, setSeasonEvent] = useState<{ kind: 'start' | 'finish'; season: number; automatic?: boolean; id: number } | null>(null);
  const [seasonArchives, setSeasonArchives] = useState<SeasonArchive[]>(() =>
    readStorage('personas_season_archives_v1', [])
  );
  const [seasonCommentArchive, setSeasonCommentArchive] = useState<SeasonCommentArchive>(() =>
    readStorage(SEASON_COMMENT_ARCHIVE_STORAGE_KEY, {})
  );

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => readStorage<NotificationItem[]>('personas_notifications_v1', [
    {
      id: 'notif_welcome',
      userId: 'user_nicolas',
      title: 'Bem-vindo ao Personas!',
      message: 'Você tem acesso irrestrito ao painel supremo, impersonação de contas e OCR de partidas.',
      type: 'system',
      read: false,
      createdAt: 'Agora',
    }
  ]));
  const notificationSyncRevisionRef = useRef(0);
  const deletedNotificationIdsRef = useRef(new Set<string>());

  const [recentVotes, setRecentVotes] = useState<VoteRecord[]>(() =>
    readStorage('personas_votes_v1', [])
  );
  const pendingSharedVotesRef = useRef<Map<string, VoteRecord>>(new Map());
  const seasonResetGenerationRef = useRef(0);
  const [isSharedVotingReady, setIsSharedVotingReady] = useState(() => !supabase);
  const [matchRecords, setMatchRecords] = useState<MatchRecord[]>(() =>
    readStorage('personas_match_records_v1', [])
  );
  const cardsWithAverage = useMemo(() => {
    const votedPlayers = new Map<string, { userId: string; season: number; sum: number; count: number }>();
    recentVotes.forEach((vote) => {
      const key = `${vote.season}:${vote.targetUserId}`;
      const aggregate = votedPlayers.get(key) || {
        userId: vote.targetUserId,
        season: vote.season,
        sum: 0,
        count: 0,
      };
      aggregate.sum += vote.score;
      aggregate.count += 1;
      votedPlayers.set(key, aggregate);
    });

    const currentUserById = new Map(users.map((user) => [user.id, user]));
    const existingCardsBySeasonPlayer = new Map<string, CardItem>();
    cards.forEach((card) => {
      const key = `${card.season}:${card.userId}`;
      if (!existingCardsBySeasonPlayer.has(key)) existingCardsBySeasonPlayer.set(key, card);
    });

    const votedCards = [...votedPlayers.values()].flatMap(({ userId, season, sum, count }) => {
      const user = currentUserById.get(userId);
      if (!user || count === 0) return [];
      const score = Math.round(sum / count);
      const existing = existingCardsBySeasonPlayer.get(`${season}:${userId}`);
      const base = existing || createPlayerCard(user, season, score);
      return [{
        ...base,
        id: existing?.id || `card_${userId}_s${season}`,
        userName: user.name,
        userHandle: user.handle,
        userAvatar: user.avatar,
        score,
        tier: getSeasonCardTier(score, false, season),
        lane: user.primaryLane,
        favoriteChampion: user.favoriteChampion,
      }];
    });

    return reconcileSeasonCriminalCards(votedCards, seasonArchives);
  }, [cards, recentVotes, seasonArchives, users]);

  // Navigation & Session
  const [activeTab, setActiveTab] = useState<string>('cards');
  const creatorUser = users.find((u) => u.role === 'criador') || users[0];
  const isLocalPreview = import.meta.env.DEV && window.location.hostname === 'localhost';
  const hasLoggedOutOfLocalPreview = (() => {
    try {
      return window.localStorage.getItem('personas_logged_out_v1') === 'true';
    } catch {
      return false;
    }
  })();
  // Once Supabase is configured, a local dev preview is not a signed-in account.
  // Require the real session so profile edits can be saved under the owner's identity.
  const startsAsLocalCreator = isLocalPreview && !supabase && !hasLoggedOutOfLocalPreview;
  const [currentUser, setCurrentUser] = useState<User | null>(() => startsAsLocalCreator ? creatorUser : null);
  const [isCreatorSession, setIsCreatorSession] = useState(startsAsLocalCreator);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false);
  const [isCaptainRolePreview, setIsCaptainRolePreview] = useState(false);
  // Local creator impersonation is a preview tool; keep its test votes in this browser only.
  const canSimulateLocalVotes = isLocalPreview && isImpersonating;
  const isVotingReadyForCurrentSession = isSharedVotingReady || canSimulateLocalVotes;
  const canCurrentUserVoteInSeason = Boolean(currentUser
    && activeSeason.status === 'active'
    && isVotingReadyForCurrentSession
    && (!isImpersonating || canSimulateLocalVotes));
  // Authentication IDs can differ from the stable roster IDs used by attendance and teams.
  // Resolve both stored check-ins and the active account to the same roster identity.
  const currentRosterUser = currentUser
    ? users.find((user) => user.id === currentUser.id)
      || (currentUser.authId ? users.find((user) => user.authId === currentUser.authId) : undefined)
      || users.find((user) => normalizeHandle(user.handle) === normalizeHandle(currentUser.handle))
    : undefined;
  const currentRosterUserId = currentRosterUser?.id || currentUser?.id || null;
  const resolveRosterUserId = (id: string) => {
    if (currentUser && (id === currentUser.id || id === currentUser.authId)) return currentRosterUserId || id;
    return users.find((user) => user.id === id || user.authId === id)?.id || id;
  };
  const canonicalRosterIds = (ids: string[]) => [...new Set(ids
    .map(resolveRosterUserId)
    .filter((id) => users.some((user) => user.id === id)))];
  const checkedInRosterIds = canonicalRosterIds(sharedTournament.attendeeIds);
  const canAccessCreatorPanel = currentUser?.id === creatorUser.id && !isImpersonating;
  const voteDisabledReason = !currentUser
    ? 'Entre na sua conta para avaliar.'
    : activeSeason.status !== 'active'
      ? 'A votação abre quando a temporada começa e fecha quando ela termina.'
      : isImpersonating && !canSimulateLocalVotes
        ? 'Volte para sua conta para registrar um voto com sua própria identidade.'
        : supabase && !isVotingReadyForCurrentSession
          ? 'Aguarde a sincronização da temporada e dos votos.'
          : 'A votação está indisponível no momento.';
  const visibleNotifications = useMemo(() => notifications.filter((notification) => (
    currentUser
    && notification.userId === currentUser.id
    && (notification.type !== 'vote' || canAccessCreatorPanel)
    && (!isImpersonating || notification.type !== 'report')
  )), [notifications, currentUser?.id, canAccessCreatorPanel, isImpersonating]);

  const publishNotifications = useCallback((items: NotificationItem[]) => {
    if (!items.length) return;
    notificationSyncRevisionRef.current += 1;
    setNotifications((previous) => [
      ...items.filter((item) => !previous.some((existing) => existing.id === item.id)),
      ...previous,
    ].slice(0, 200));
    if (!supabase || !canAccessCreatorPanel) return;
    items.forEach((item) => {
      if (item.type === 'vote') return;
      const recipient = item.userId === creatorUser.id
        ? creatorUser
        : users.find((user) => user.id === item.userId);
      if (!recipient?.authId) return;
      void saveSharedNotification(item, recipient.authId).catch((error) => {
        console.warn('Não foi possível salvar uma notificação compartilhada.', error);
      });
    });
  }, [canAccessCreatorPanel, creatorUser, users]);

  const handleMarkNotificationRead = useCallback((id: string) => {
    notificationSyncRevisionRef.current += 1;
    setNotifications((previous) => previous.map((notification) => notification.id === id ? { ...notification, read: true } : notification));
    void setSharedNotificationRead(id, true).catch((error) => console.warn('Não foi possível marcar a notificação como lida.', error));
  }, []);

  const handleDeleteNotification = useCallback((id: string) => {
    notificationSyncRevisionRef.current += 1;
    deletedNotificationIdsRef.current.add(id);
    setNotifications((previous) => previous.filter((notification) => notification.id !== id));
    void deleteSharedNotification(id).catch((error) => console.warn('Não foi possível excluir a notificação compartilhada.', error));
  }, []);

  const handleMarkAllNotificationsRead = useCallback(() => {
    const unreadIds = visibleNotifications.filter((notification) => !notification.read).map((notification) => notification.id);
    if (unreadIds.length === 0) return;
    notificationSyncRevisionRef.current += 1;
    setNotifications((previous) => previous.map((notification) => unreadIds.includes(notification.id) ? { ...notification, read: true } : notification));
    unreadIds.forEach((id) => {
      void setSharedNotificationRead(id, true).catch((error) => console.warn('Não foi possível sincronizar a leitura da notificação.', error));
    });
  }, [visibleNotifications]);

  const handleDeleteAllNotifications = useCallback(async () => {
    if (!currentUser || isImpersonating || visibleNotifications.length === 0) return;
    const idsToDelete = visibleNotifications.map((notification) => notification.id);
    notificationSyncRevisionRef.current += 1;
    idsToDelete.forEach((id) => deletedNotificationIdsRef.current.add(id));
    try {
      await deleteAllSharedNotifications();
      notificationSyncRevisionRef.current += 1;
      setNotifications((previous) => previous.filter((notification) => notification.userId !== currentUser.id));
    } catch (error) {
      idsToDelete.forEach((id) => deletedNotificationIdsRef.current.delete(id));
      notificationSyncRevisionRef.current += 1;
      console.warn('Não foi possível excluir todas as notificações.', error);
    }
  }, [currentUser, isImpersonating, visibleNotifications]);
  // Role preview and account impersonation change the displayed user, not the signed-in session.
  // The displayed profile is the one that should be online while the creator assumes it.
  const presenceActorId = currentUser?.id || null;
  const presenceSessionId = useMemo(() => {
    try {
      const key = 'personas_presence_session_v1';
      const existing = window.sessionStorage.getItem(key);
      if (existing) return existing;
      const generated = typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem(key, generated);
      return generated;
    } catch {
      return `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  }, []);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [presenceStatusByUserId, setPresenceStatusByUserId] = useState<Record<string, {
    online: boolean;
    lastSeenAt: string | null;
    offlineSince: string | null;
  }>>({});
  const creatorPanelUsers = useMemo(() => users.map((user) => ({
    ...user,
    isOnline: onlineUserIds.includes(user.id),
    lastSeenAt: presenceStatusByUserId[user.id]?.lastSeenAt || null,
    offlineSince: presenceStatusByUserId[user.id]?.offlineSince || null,
  })), [users, onlineUserIds, presenceStatusByUserId]);

  useEffect(() => {
    if (!presenceActorId) {
      setOnlineUserIds([]);
      setPresenceStatusByUserId({});
      return;
    }

    const sessionNonce = typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const sessionId = `${presenceSessionId}:${presenceActorId}:${sessionNonce}`;
    let isCancelled = false;
    const refreshPresence = async () => {
      try {
        const authorization = await getSupabaseAuthorizationHeaders();
        await fetch('/api/presence', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authorization },
          body: JSON.stringify({ sessionId, userId: presenceActorId }),
        });
        const response = await fetch('/api/presence');
        if (!response.ok) throw new Error('Falha ao buscar presença.');
        const result = await response.json() as {
          userIds?: unknown;
          statuses?: Record<string, { online?: unknown; lastSeenAt?: unknown; offlineSince?: unknown }>;
        };
        if (!isCancelled) {
          const statuses = result.statuses && typeof result.statuses === 'object'
            ? Object.fromEntries(Object.entries(result.statuses).map(([id, status]) => [id, {
              online: status.online === true,
              lastSeenAt: typeof status.lastSeenAt === 'string' ? status.lastSeenAt : null,
              offlineSince: typeof status.offlineSince === 'string' ? status.offlineSince : null,
            }]))
            : {};
          setPresenceStatusByUserId(statuses);
          setOnlineUserIds(Array.isArray(result.userIds)
            ? result.userIds.filter((id): id is string => typeof id === 'string')
            : Object.entries(statuses).filter(([, status]) => status.online).map(([id]) => id));
        }
      } catch {
        // Keep the current browser session accurate if the API is temporarily unavailable.
        if (!isCancelled) {
          setOnlineUserIds([presenceActorId]);
          setPresenceStatusByUserId((previous) => ({
            ...previous,
            [presenceActorId]: { online: true, lastSeenAt: new Date().toISOString(), offlineSince: null },
          }));
        }
      }
    };

    void refreshPresence();
    const heartbeat = window.setInterval(() => void refreshPresence(), 15_000);
    return () => {
      isCancelled = true;
      window.clearInterval(heartbeat);
      void getSupabaseAuthorizationHeaders().then((authorization) => fetch(`/api/presence?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: authorization,
        keepalive: true,
      })).catch(() => undefined);
    };
  }, [presenceActorId, presenceSessionId]);

  const updateSharedTournament = (update: Partial<SharedTournamentState> | ((previous: SharedTournamentState) => Partial<SharedTournamentState>)) => {
    setSharedTournament((previous) => {
      const normalizedPrevious = normalizeSharedTournament(previous);
      const changes = typeof update === 'function' ? update(normalizedPrevious) : update;
      return normalizeSharedTournament({ ...normalizedPrevious, ...changes, updatedAt: Math.max(Date.now(), normalizedPrevious.updatedAt + 1) });
    });
  };

  const persistSharedTournament = async (state: SharedTournamentState, actorId: string, actorRole: string) => {
    try {
      const isLocalPreview = import.meta.env.DEV && window.location.hostname === 'localhost';
      const authorization = isLocalPreview ? {} : await getSupabaseAuthorizationHeaders();
      const response = await fetch('/api/tournament-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authorization },
        body: JSON.stringify({ state, actorId, actorRole }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        console.warn('Não foi possível sincronizar o estado do torneio:', response.status, payload?.error || 'erro desconhecido');
        return;
      }
      const payload = await response.json();
      if (payload.state) {
        const normalizedState = normalizeSharedTournament(payload.state as Partial<SharedTournamentState>);
        setSharedTournament((previous) => Number(normalizedState.updatedAt) > previous.updatedAt
          ? normalizedState
          : previous);
      }
    } catch (error) {
      console.warn('Não foi possível sincronizar o estado do torneio:', error);
    }
  };

  const handleSetTeamCaptain = (userId: string, slot: 0 | 1 | null) => {
    updateSharedTournament((previous) => {
      if (previous.tournamentStarted) return {};
      if (slot !== null && !previous.attendeeIds.includes(userId)) return {};

      const nextCaptains: [string, string] = [...previous.captainIds];
      const currentSlot = nextCaptains.findIndex((captainId) => captainId === userId);
      if (currentSlot >= 0) nextCaptains[currentSlot] = '';
      if (slot !== null) nextCaptains[slot] = userId;

      return { captainIds: nextCaptains, predefinedTeams: null };
    });
  };

  const setTeams: React.Dispatch<React.SetStateAction<Team[]>> = (update) => {
    updateSharedTournament((previous) => ({
      teams: typeof update === 'function' ? update(previous.teams) : update,
    }));
  };

  useEffect(() => {
    if (activeTab === 'creator' && !canAccessCreatorPanel) setActiveTab('cards');
  }, [activeTab, canAccessCreatorPanel]);

  // Modals
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [profileModalTarget, setProfileModalTarget] = useState<User | null>(null);
  const [reportModalTarget, setReportModalTarget] = useState<User | null>(null);

  // Cards gallery filters
  const [cardTierFilter, setCardTierFilter] = useState<string>('all');
  const [cardSeasonFilter, setCardSeasonFilter] = useState<string>('current');
  const [cardLaneFilter, setCardLaneFilter] = useState<string>('all');
  const [cardAwardFilter, setCardAwardFilter] = useState<string>('all');
  const [cardSearchQuery, setCardSearchQuery] = useState<string>('');

  // Persist data
  useEffect(() => {
    writeStorage('personas_users_v2', users);
  }, [users]);

  // Migrate legacy profile comments into their season archive and keep only this season's comments active.
  useEffect(() => {
    const archivedComments: SeasonCommentArchive = {};
    setUsers((previous) => {
      let changed = false;
      const next = previous.map((user) => {
        if (!user.comments?.length) return user;
        const activeComments: PlayerComment[] = [];
        user.comments.forEach((comment) => {
          if (comment.id === 'c_1' || comment.id === 'c_2') {
            archivedComments[1] ||= {};
            archivedComments[1][user.id] ||= [];
            archivedComments[1][user.id].push({ ...comment, season: 1 });
            changed = true;
            return;
          }
          const season = getCommentSeason(user.id, comment, recentVotes, seasonArchives, activeSeason.number);
          const seasonalComment = comment.season === season ? comment : { ...comment, season };
          if (season === activeSeason.number) {
            activeComments.push(seasonalComment);
          } else {
            archivedComments[season] ||= {};
            archivedComments[season][user.id] ||= [];
            archivedComments[season][user.id].push(seasonalComment);
          }
          if (season !== activeSeason.number || comment.season !== season) changed = true;
        });
        if (activeComments.length === user.comments.length
          && activeComments.every((comment, index) => comment === user.comments[index])) return user;
        changed = true;
        return { ...user, comments: activeComments };
      });
      return changed ? next : previous;
    });
    if (Object.keys(archivedComments).length) {
      setSeasonCommentArchive((previous) => mergeSeasonCommentArchive(previous, archivedComments));
    }
  }, [users, recentVotes, activeSeason.number, seasonArchives]);

  useEffect(() => {
    writeStorage(SEASON_COMMENT_ARCHIVE_STORAGE_KEY, seasonCommentArchive);
  }, [seasonCommentArchive]);

  // Pull registered public profiles so all visitors see the same player directory.
  useEffect(() => {
    if (!supabase) return;
    let isDisposed = false;
    const refreshProfiles = async () => {
      try {
        const profiles = await loadRegisteredProfiles();
        if (!isDisposed) setUsers((previous) => normalizeUserList(mergeRegisteredProfiles(previous, profiles)));
      } catch {
        // Keep cached profiles visible when the shared database is temporarily unavailable.
      }
    };
    void refreshProfiles();
    const interval = window.setInterval(() => { void refreshProfiles(); }, 15_000);
    return () => {
      isDisposed = true;
      window.clearInterval(interval);
    };
  }, []);

  // Use the shared match history as the source for the active season averages.
  useEffect(() => {
    const recordsByPlayer = new Map<string, MatchRecord[]>();
    matchRecords.filter((record) => record.season === activeSeason.number).forEach((record) => {
      recordsByPlayer.set(record.playerId, [...(recordsByPlayer.get(record.playerId) || []), record]);
    });
    setUsers((previous) => {
      let changed = false;
      const next = previous.map((user) => {
        const records = recordsByPlayer.get(user.id);
        const stats = records?.length ? averageMatchStats(records) : EMPTY_MATCH_STATS;
        const isUnchanged = user.stats.kills === stats.kills
          && user.stats.deaths === stats.deaths
          && user.stats.assists === stats.assists
          && user.stats.minions === stats.minions
          && user.stats.gold === stats.gold;
        if (isUnchanged) return user;
        changed = true;
        return { ...user, stats: { ...stats } };
      });
      return changed ? next : previous;
    });
    setCards((previous) => {
      let changed = false;
      const next = previous.map((card) => {
        if (card.season !== activeSeason.number) return card;
        const records = recordsByPlayer.get(card.userId);
        const stats = records?.length ? averageMatchStats(records) : EMPTY_MATCH_STATS;
        const isUnchanged = card.stats.kills === stats.kills
          && card.stats.deaths === stats.deaths
          && card.stats.assists === stats.assists
          && card.stats.minions === stats.minions
          && card.stats.gold === stats.gold;
        if (isUnchanged) return card;
        changed = true;
        return { ...card, stats: { ...stats } };
      });
      return changed ? next : previous;
    });
  }, [matchRecords, activeSeason.number, users, cards]);

  // Keep the complete seasonal match history synchronized for every visitor.
  useEffect(() => {
    if (!supabase) return;
    let isDisposed = false;
    const refreshMatchRecords = async () => {
      try {
        const rows = await loadSharedPlayerMatchRecords();
        if (!isDisposed && rows) setMatchRecords(rows);
      } catch {
        // Keep the locally cached season history available if Supabase is temporarily offline.
      }
    };
    void refreshMatchRecords();
    const interval = window.setInterval(() => { void refreshMatchRecords(); }, 15_000);
    return () => {
      isDisposed = true;
      window.clearInterval(interval);
    };
  }, []);

  // Restore the shared Supabase session and keep sign-in/out in sync with the interface.
  useEffect(() => {
    if (!supabase) return;
    let isDisposed = false;
    const applyAuthUser = async (authUser: import('@supabase/supabase-js').User | null) => {
      if (!authUser) {
        if (!startsAsLocalCreator && !isDisposed) {
          setCurrentUser(null);
          setIsCreatorSession(false);
        }
        return;
      }
      try {
        const [profile, profiles] = await Promise.all([
          loadAuthenticatedProfile(authUser),
          loadRegisteredProfiles(),
        ]);
        if (isDisposed) return;
        setUsers((previous) => normalizeUserList(mergeRegisteredProfiles(previous, profiles)));
        setCurrentUser(profile);
        setIsCreatorSession(profile.role === 'criador');
        setIsImpersonating(false);
      } catch {
        if (!isDisposed) {
          setCurrentUser(null);
          setIsCreatorSession(false);
        }
      }
    };

    void supabase.auth.getSession().then(({ data }) => applyAuthUser(data.session?.user || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer profile queries out of the auth callback to avoid holding the auth lock.
      window.setTimeout(() => { void applyAuthUser(session?.user || null); }, 0);
    });
    return () => {
      isDisposed = true;
      subscription.unsubscribe();
    };
  }, [startsAsLocalCreator]);

  useEffect(() => {
    if (readStorage<number>(CARD_ORNAMENT_SETTINGS_VERSION_KEY, 0) < CARD_ORNAMENT_SETTINGS_VERSION) {
      setCardOrnamentSettings((current) => migrateCardOrnamentSettings(current));
    }
  }, []);

  useEffect(() => {
    writeStorage(CARD_ORNAMENT_STORAGE_KEY, cardOrnamentSettings);
    writeStorage(CARD_ORNAMENT_SETTINGS_VERSION_KEY, CARD_ORNAMENT_SETTINGS_VERSION);
  }, [cardOrnamentSettings]);

  useEffect(() => {
    writeStorage(TIER_CARD_ORNAMENT_STORAGE_KEY, tierOrnamentSettings);
  }, [tierOrnamentSettings]);

  useEffect(() => {
    if (!supabase) return;
    let isDisposed = false;
    const refreshSharedOrnaments = async () => {
      try {
        const sharedSettings = await loadSharedCardOrnamentSettings();
        if (!sharedSettings || isDisposed) return;

        if (currentUser?.role === 'criador') {
          const mergedSettings = { ...sharedSettings };
          for (const tier of ORNAMENT_TIER_ORDER) {
            const sharedSettingsForTier = mergedSettings[tier];
            const needsMigration = !sharedSettingsForTier
              || Object.keys(sharedSettingsForTier).length === 0;
            if (needsMigration) {
              const legacySettings = normalizeCardOrnamentSettings(legacyTierOrnamentSettings.current[tier] ?? DEFAULT_CARD_ORNAMENT_SETTINGS);
              await saveSharedCardOrnamentSettings(tier, legacySettings);
              mergedSettings[tier] = legacySettings;
            }
          }
          if (!isDisposed) setTierOrnamentSettings(normalizeTierCardOrnamentSettings(mergedSettings));
        } else {
          setTierOrnamentSettings(normalizeTierCardOrnamentSettings(sharedSettings));
        }
      } catch (error) {
        console.warn('Não foi possível sincronizar os ornamentos compartilhados das cartas.', error);
      }
    };
    void refreshSharedOrnaments();
    return () => { isDisposed = true; };
  }, [currentUser?.role]);

  const handleUpdateTierOrnamentSettings = useCallback(async (tier: EloTier, settings: CardOrnamentSettings) => {
    setTierOrnamentSettings((previous) => ({ ...previous, [tier]: settings }));
    await saveSharedCardOrnamentSettings(tier, settings);
  }, []);

  useEffect(() => {
    writeStorage('personas_cards_v2', cards);
  }, [cards]);

  useEffect(() => {
    const limitedCards = normalizeCardList(cards);
    if (limitedCards.length !== cards.length) setCards(limitedCards);
  }, [cards]);

  useEffect(() => {
    const reconciledCards = reconcileSeasonCriminalCards(cards, seasonArchives);
    if (reconciledCards.some((card, index) => card !== cards[index])) setCards(reconciledCards);
  }, [cards, seasonArchives]);

  useEffect(() => {
    writeStorage('personas_deck_v3', deck);
  }, [deck]);

  useEffect(() => {
    writeStorage('personas_notifications_v1', notifications);
  }, [notifications]);

  useEffect(() => {
    if (!supabase || !currentUser?.authId || isImpersonating) return;
    let isDisposed = false;
    let isSyncing = false;
    const syncNotifications = async () => {
      if (isSyncing) return;
      isSyncing = true;
      const syncRevision = notificationSyncRevisionRef.current;
      try {
        const sharedNotifications = await loadSharedNotifications(currentUser.id);
        if (!sharedNotifications || isDisposed || syncRevision !== notificationSyncRevisionRef.current) return;
        setNotifications((previous) => {
          const previousById = new Map(previous.map((notification) => [notification.id, notification] as const));
          const visibleSharedNotifications = sharedNotifications
            .filter((notification) => !deletedNotificationIdsRef.current.has(notification.id))
            .map((notification) => previousById.get(notification.id)?.read
              ? { ...notification, read: true }
              : notification);
          const sharedIds = new Set(visibleSharedNotifications.map((notification) => notification.id));
          const localOnlyForCurrentUser = previous.filter((notification) => (
            notification.userId === currentUser.id
            && !sharedIds.has(notification.id)
            && !deletedNotificationIdsRef.current.has(notification.id)
          ));
          return [...visibleSharedNotifications, ...localOnlyForCurrentUser].slice(0, 200);
        });
      } catch (error) {
        console.warn('Não foi possível sincronizar as notificações da conta.', error);
      } finally {
        isSyncing = false;
      }
    };
    void syncNotifications();
    const interval = window.setInterval(() => { void syncNotifications(); }, 15_000);
    return () => {
      isDisposed = true;
      window.clearInterval(interval);
    };
  }, [currentUser?.authId, currentUser?.id, isImpersonating]);

  useEffect(() => {
    writeStorage(SHARED_TOURNAMENT_STORAGE_KEY, sharedTournament);
    writeStorage('personas_teams_v2', sharedTournament.teams);
  }, [sharedTournament]);

  useEffect(() => {
    const resetAt = sharedTournament.seasonResetAt;
    if (typeof resetAt !== 'number' || !Number.isFinite(resetAt)) return;
    const appliedResetAt = readStorage<number>('personas_last_season_reset_v1', 0);
    if (Number(resetAt) <= appliedResetAt) return;

    seasonResetGenerationRef.current += 1;
    writeStorage('personas_last_season_reset_v1', Number(resetAt));
    const firstSeason: ActiveSeason = { number: 1, status: 'ready', startedAt: null, endsAt: null };
    activeSeasonRef.current = firstSeason;
    setActiveSeason(firstSeason);
    setSeasonEvent(null);
    setSeasonArchives([]);
    setSeasonCommentArchive({});
    setRecentVotes([]);
    pendingSharedVotesRef.current.clear();
    setMatchRecords([]);
    setCards([]);
    setUsers((previous) => previous.map((user) => ({
      ...user,
      currentScore: 0,
      totalVotes: 0,
      seasonsPlayed: 0,
      mvpCount: 0,
      aceCount: 0,
      isCriminoso: false,
      isMencaoHonrosa: false,
      isLegend: false,
      stats: { ...EMPTY_MATCH_STATS },
      comments: [],
    })));
  }, [sharedTournament.seasonResetAt]);

  useEffect(() => {
    if (!isSharedTournamentReady || !isSharedVotingReady || !canAccessCreatorPanel) return;

    const attendanceSeason = sharedTournament.attendanceSeason;
    if (attendanceSeason === activeSeason.number) return;

    const resetPreviousTeams = activeSeason.status === 'ready'
      && (attendanceSeason === undefined || attendanceSeason < activeSeason.number)
      && sharedTournament.tournamentStarted;
    updateSharedTournament({
      attendanceSeason: activeSeason.number,
      ...(resetPreviousTeams ? {
        tournamentStarted: false,
        attendeeIds: [],
        captainIds: ['', ''],
        predefinedTeams: null,
        captainDraftTurn: null,
        playerPoolIds: [],
        draftStage: 'setup',
        teams: [],
      } : {}),
    });
  }, [activeSeason.number, activeSeason.status, canAccessCreatorPanel, isSharedTournamentReady, isSharedVotingReady, sharedTournament.attendanceSeason, sharedTournament.tournamentStarted]);

  useEffect(() => {
    if (!isSharedTournamentReady) return;
    const assignments = new Map<string, string>();
    sharedTournament.teams.forEach((team) => {
      team.members.forEach((userId) => assignments.set(userId, team.name));
      if (team.captainId) assignments.set(team.captainId, team.name);
    });
    const previous = previousTournamentNotificationsRef.current;
    if (previous && canAccessCreatorPanel) {
      const eventTimestamp = sharedTournament.updatedAt;
      const items: NotificationItem[] = [];
      if (!previous.started && sharedTournament.tournamentStarted) {
        users.forEach((user) => items.push({
          id: `tournament-start:${eventTimestamp}:${user.id}`,
          userId: user.id,
          title: 'Torneio Personas iniciado',
          message: 'O criador iniciou o torneio. Confira a aba Times para acompanhar as equipes.',
          type: 'system',
          read: false,
          createdAt: 'Agora',
        }));
      }
      assignments.forEach((teamName, userId) => {
        if (previous.assignments.get(userId) === teamName) return;
        const player = users.find((user) => user.id === userId);
        if (!player) return;
        items.push({
          id: `team-assigned:${eventTimestamp}:${userId}`,
          userId,
          title: 'Você foi escolhido para um time',
          message: `Você está na equipe ${teamName}. Acesse Times para ver a escalação.`,
          type: 'team',
          read: false,
          createdAt: 'Agora',
        });
      });
      publishNotifications(items);
    }
    previousTournamentNotificationsRef.current = {
      started: sharedTournament.tournamentStarted,
      assignments,
    };
  }, [isSharedTournamentReady, sharedTournament.tournamentStarted, sharedTournament.updatedAt, sharedTournament.teams, users, canAccessCreatorPanel, publishNotifications]);

  useEffect(() => {
    writeStorage('personas_presets_v2', presets);
  }, [presets]);

  useEffect(() => {
    writeStorage('personas_reports_v2', reports);
  }, [reports]);

  useEffect(() => {
    activeSeasonRef.current = activeSeason;
  }, [activeSeason]);

  // Season closure and votes are shared so the season's voting rules apply to every account.
  useEffect(() => {
    if (!supabase) {
      setIsSharedVotingReady(true);
      return;
    }
    let isDisposed = false;
    let isSyncing = false;
    const syncSharedVoting = async () => {
      if (isSyncing) return;
      isSyncing = true;
      const resetGeneration = seasonResetGenerationRef.current;
      try {
        const [sharedSeason, sharedVotes] = await Promise.all([
          loadSharedSeasonControl(),
          loadSharedSeasonVotes(),
        ]);
        if (isDisposed || resetGeneration !== seasonResetGenerationRef.current) return;
        if (sharedSeason && JSON.stringify(sharedSeason) !== JSON.stringify(activeSeasonRef.current)) {
          const previousSeason = activeSeasonRef.current;
          activeSeasonRef.current = sharedSeason;
          const isFullSeasonReset = sharedSeason.number === 1 && sharedSeason.status === 'ready'
            && (previousSeason.number !== 1 || previousSeason.status !== 'ready');
          if (!isFullSeasonReset && (previousSeason.number !== sharedSeason.number || previousSeason.status !== sharedSeason.status)) {
            setSeasonEvent({
              kind: sharedSeason.status === 'active' ? 'start' : 'finish',
              season: sharedSeason.status === 'active' ? sharedSeason.number : previousSeason.number,
              automatic: sharedSeason.status !== 'active',
              id: Date.now(),
            });
          }
          setActiveSeason(sharedSeason);
        }
        if (sharedVotes) setRecentVotes((previous) => {
          const sharedIds = new Set(sharedVotes.map((vote) => vote.id));
          const pendingSharedVotes = [...pendingSharedVotesRef.current.values()]
            .filter((vote) => !sharedIds.has(vote.id));
          sharedIds.forEach((id) => pendingSharedVotesRef.current.delete(id));
          const localSimulationVotes = isLocalPreview
            ? previous.filter((vote) => vote.id.startsWith('local_sim_vote_') && !sharedIds.has(vote.id))
            : [];
          const mergedVotes = [...sharedVotes, ...pendingSharedVotes, ...localSimulationVotes];
          return JSON.stringify(previous) === JSON.stringify(mergedVotes) ? previous : mergedVotes;
        });
        setIsSharedVotingReady(true);
      } catch (error) {
        console.warn('Não foi possível sincronizar as temporadas e as notas.', error);
      } finally {
        isSyncing = false;
      }
    };
    void syncSharedVoting();
    const interval = window.setInterval(() => { void syncSharedVoting(); }, 10_000);
    return () => {
      isDisposed = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    writeStorage('personas_active_season_v1', activeSeason);
  }, [activeSeason]);

  useEffect(() => {
    writeStorage('personas_season_archives_v1', seasonArchives);
  }, [seasonArchives]);

  useEffect(() => {
    writeStorage('personas_votes_v1', recentVotes);
  }, [recentVotes]);

  useEffect(() => {
    writeStorage('personas_match_records_v1', matchRecords);
  }, [matchRecords]);

  useEffect(() => {
    let isDisposed = false;
    let firstLoad = true;
    const pullSharedTournament = async () => {
      try {
        const response = await fetch('/api/tournament-state');
        if (response.ok) {
          const payload = await response.json();
          if (payload.state && Number.isFinite(payload.state.updatedAt)) {
            const isInitialResponse = firstLoad;
            setSharedTournament((previous) => isInitialResponse
              || Number(payload.state.updatedAt) > previous.updatedAt
              || (Number(payload.state.updatedAt) === previous.updatedAt && JSON.stringify(payload.state) !== JSON.stringify(previous))
              ? {
                  ...(payload.state as SharedTournamentState),
                  teams: (Array.isArray(payload.state.teams) ? payload.state.teams : []).map((team: Team) => ({
                    ...team,
                    members: [...new Set(team.members || [])].slice(0, 5),
                  })),
                }
              : previous);
          }
        }
      } catch {
        // Local storage remains available if the shared server is temporarily unreachable.
      } finally {
        if (firstLoad && !isDisposed) {
          firstLoad = false;
          setIsSharedTournamentReady(true);
        }
      }
    };

    void pullSharedTournament();
    const interval = window.setInterval(() => { void pullSharedTournament(); }, 1200);
    return () => {
      isDisposed = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isSharedTournamentReady || !currentUser) return;
    void persistSharedTournament(sharedTournament, currentUser.id, canAccessCreatorPanel ? 'criador' : 'viewer');
  }, [sharedTournament, isSharedTournamentReady, currentUser?.id, currentUser?.role, canAccessCreatorPanel]);

  useEffect(() => {
    const syncFromAnotherTab = (event: StorageEvent) => {
      if (!event.newValue) return;
      try {
        const value = JSON.parse(event.newValue);
        if (event.key === 'personas_users_v2' && Array.isArray(value)) {
          setUsers(normalizeUserList(value));
        } else if (event.key === 'personas_cards_v2' && Array.isArray(value)) {
          setCards(normalizeCardList(value));
        } else if (event.key === 'personas_season_archives_v1' && Array.isArray(value)) {
          setSeasonArchives(value);
        } else if (event.key === 'personas_votes_v1' && Array.isArray(value)) {
          setRecentVotes((previous) => {
            const incomingIds = new Set((value as VoteRecord[]).map((vote) => vote.id));
            const pendingSharedVotes = [...pendingSharedVotesRef.current.values()]
              .filter((vote) => !incomingIds.has(vote.id));
            const localSimulationVotes = isLocalPreview
              ? previous.filter((vote) => vote.id.startsWith('local_sim_vote_') && !incomingIds.has(vote.id))
              : [];
            const mergedVotes = [...value as VoteRecord[], ...pendingSharedVotes, ...localSimulationVotes];
            return JSON.stringify(previous) === JSON.stringify(mergedVotes) ? previous : mergedVotes;
          });
        } else if (event.key === SHARED_TOURNAMENT_STORAGE_KEY && Number.isFinite(value?.updatedAt)) {
          const normalizedState = normalizeSharedTournament(value as Partial<SharedTournamentState>);
          setSharedTournament((previous) => Number(normalizedState.updatedAt) > previous.updatedAt
            ? normalizedState
            : previous);
        } else if (event.key === 'personas_active_season_v1' && value?.number && value?.status) {
          if (value.number !== activeSeason.number || value.status !== activeSeason.status) {
            const kind = value.status === 'active' ? 'start' : 'finish';
            setSeasonEvent({
              kind,
              season: kind === 'start' ? value.number : activeSeason.number,
              automatic: kind === 'finish',
              id: Date.now(),
            });
          }
          setActiveSeason(value);
        }
      } catch {
        // Ignore incomplete writes from another tab.
      }
    };

    window.addEventListener('storage', syncFromAnotherTab);
    return () => window.removeEventListener('storage', syncFromAnotherTab);
  }, [activeSeason.number, activeSeason.status]);

  useEffect(() => {
    if (currentUser) {
      const latestUser = users.find((user) => user.id === currentUser.id);
      if (latestUser && latestUser !== currentUser) setCurrentUser(latestUser);
    }
    if (profileModalTarget) {
      const latestProfile = users.find((user) => user.id === profileModalTarget.id);
      if (latestProfile && latestProfile !== profileModalTarget) setProfileModalTarget(latestProfile);
    }
  }, [users, currentUser?.id, profileModalTarget?.id]);

  useEffect(() => {
    if (!seasonEvent) return;
    const timeout = window.setTimeout(() => setSeasonEvent(null), 4800);
    return () => window.clearTimeout(timeout);
  }, [seasonEvent]);

  const handleToggleTournamentAttendance = async (requestedTargetUserId?: string) => {
    if (!currentUser) {
      if (!requestedTargetUserId) setIsLoginModalOpen(true);
      return;
    }
    if (checkInSavingRef.current) return;
    // React's onClick passes a MouseEvent. Never treat it as a roster ID.
    const targetUserId = typeof requestedTargetUserId === 'string' && requestedTargetUserId.trim()
      ? requestedTargetUserId
      : undefined;
    const ownRosterUserId = currentRosterUserId || currentUser.id;
    if ((targetUserId && !canAccessCreatorPanel && targetUserId !== ownRosterUserId) || activeSeason.status === 'active' || sharedTournament.tournamentStarted || !isSharedTournamentReady
      || (sharedTournament.attendanceSeason !== undefined && sharedTournament.attendanceSeason !== activeSeason.number)) return;
    if (!targetUserId) {
      if (checkInSavingRef.current || isImpersonating) return;
      const attendeeId = ownRosterUserId;
      const isCheckedIn = canonicalRosterIds(sharedTournament.attendeeIds).includes(attendeeId);
      checkInSavingRef.current = true;
      setIsCheckInSaving(true);
      setCheckInError('');
      try {
        const authorization = await getSupabaseAuthorizationHeaders();
        const response = await fetch('/api/tournament-state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authorization },
          body: JSON.stringify({ action: 'set-attendance', checkedIn: !isCheckedIn }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'Não foi possível salvar o check-in. Tente novamente.');
        if (!payload?.state) throw new Error('O servidor não confirmou o check-in. Atualize a página e tente novamente.');
        const confirmedState = normalizeSharedTournament(payload.state as Partial<SharedTournamentState>);
        setSharedTournament((previous) => confirmedState.updatedAt >= previous.updatedAt ? confirmedState : previous);
      } catch (error) {
        setCheckInError(error instanceof Error ? error.message : 'Não foi possível salvar o check-in. Tente novamente.');
      } finally {
        checkInSavingRef.current = false;
        setIsCheckInSaving(false);
      }
      return;
    }

    const attendeeId = targetUserId && canAccessCreatorPanel ? targetUserId : ownRosterUserId;
    const previous = normalizeSharedTournament(sharedTournament);
    const normalizedAttendeeIds = canonicalRosterIds(previous.attendeeIds);
    const wasCheckedIn = normalizedAttendeeIds.includes(attendeeId);
    const nextState = normalizeSharedTournament({
      ...previous,
      attendeeIds: wasCheckedIn
        ? normalizedAttendeeIds.filter((id) => id !== attendeeId)
        : [...normalizedAttendeeIds, attendeeId],
      captainIds: previous.captainIds.map((id) => wasCheckedIn && resolveRosterUserId(id) === attendeeId ? '' : id) as [string, string],
      updatedAt: Math.max(Date.now(), previous.updatedAt + 1),
    });
    setSharedTournament(nextState);
    checkInSavingRef.current = true;
    setIsCheckInSaving(true);
    void persistSharedTournament(nextState, currentUser.id, canAccessCreatorPanel ? 'criador' : 'viewer')
      .finally(() => {
        checkInSavingRef.current = false;
        setIsCheckInSaving(false);
      });
  };

  const handleStartSeason = async () => {
    if (activeSeason.status === 'active' || currentUser?.role !== 'criador' || isImpersonating) return;
    if (sharedTournament.attendanceSeason !== undefined && sharedTournament.attendanceSeason !== activeSeason.number) {
      window.alert('Aguarde a sincronização do check-in desta temporada antes de iniciar.');
      return;
    }
    if (sharedTournament.attendeeIds.length === 0) {
      window.alert('Confirme o check-in de pelo menos uma pessoa antes de iniciar a temporada.');
      return;
    }
    const startedAt = new Date();
    const seasonNumber = activeSeason.number;
    const nextSeason: ActiveSeason = {
      number: seasonNumber,
      status: 'active',
      startedAt: startedAt.toISOString(),
      endsAt: new Date(startedAt.getTime() + 7 * 60 * 60 * 1000).toISOString(),
    };
    if (supabase && !isSharedVotingReady) {
      window.alert('Aguarde a sincronização da temporada antes de iniciar.');
      return;
    }
    try {
      await saveSharedSeasonControl(nextSeason);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Não foi possível abrir a temporada compartilhada.');
      return;
    }
    const seasonUsers = users.map((user) => ({ ...user, isCriminoso: false, stats: { ...EMPTY_MATCH_STATS } }));
    const existingSeasonPlayerIds = new Set(cardsWithAverage
      .filter((card) => card.season === seasonNumber)
      .map((card) => card.userId));
    const voteTotals = new Map<string, { sum: number; count: number }>();
    recentVotes.filter((vote) => vote.season === seasonNumber).forEach((vote) => {
      const total = voteTotals.get(vote.targetUserId) || { sum: 0, count: 0 };
      voteTotals.set(vote.targetUserId, { sum: total.sum + vote.score, count: total.count + 1 });
    });
    const openingCards = seasonUsers.flatMap((user) => {
      const total = voteTotals.get(user.id);
      if (!total || existingSeasonPlayerIds.has(user.id)) return [];
      return [createPlayerCard(user, seasonNumber, Math.round(total.sum / total.count))];
    });
    setCards((previous) => normalizeCardList([
      ...openingCards,
      ...previous.map((card) => {
        if (card.season !== seasonNumber) return card;
        const total = voteTotals.get(card.userId);
        const score = total ? Math.round(total.sum / total.count) : card.score;
        return { ...card, score, isCriminoso: false, stats: { ...EMPTY_MATCH_STATS }, tier: getSeasonCardTier(score, false, seasonNumber) };
      }),
    ]));
    setUsers(seasonUsers.map((user) => ({
      ...user,
      currentScore: voteTotals.has(user.id)
        ? Math.round(voteTotals.get(user.id)!.sum / voteTotals.get(user.id)!.count)
        : 0,
      totalVotes: recentVotes.filter((vote) => vote.targetUserId === user.id).length,
    })));
    if (supabase) void Promise.allSettled(seasonUsers.map((user) => saveSharedPlayerMatchStats(user.id, EMPTY_MATCH_STATS)));
    activeSeasonRef.current = nextSeason;
    setActiveSeason(nextSeason);
    setSeasonEvent({ kind: 'start', season: seasonNumber, id: Date.now() });
    publishNotifications(users.map((user) => ({
      id: `season-start:${seasonNumber}:${user.id}`,
      userId: user.id,
      title: `Temporada ${seasonNumber} iniciada`,
      message: 'A nova temporada do Personas começou. As avaliações já estão liberadas.',
      type: 'system',
      read: false,
      createdAt: 'Agora',
    })));
  };

  const handleResetAllSeasons = async () => {
    if (currentUser?.role !== 'criador' || isImpersonating) {
      throw new Error('Somente o Criador pode resetar todas as temporadas.');
    }

    const resetAt = Math.max(Date.now(), Number(sharedTournament.seasonResetAt || 0) + 1);
    let resetTournament = normalizeSharedTournament({
      updatedAt: resetAt,
      seasonResetAt: resetAt,
      attendanceSeason: 1,
      tournamentStarted: false,
      attendeeIds: [],
      captainIds: ['', ''],
        confirmedDeckCardId: null,
        captainRerollRequest: null,
        interClassDraw: null,
      draftMode: 'random',
      seriesFormat: 'MD3',
      predefinedTeams: null,
      captainDraftTurn: null,
      playerPoolIds: [],
      draftStage: 'setup',
      teams: [],
    });

    if (supabase) {
      const authorization = await getSupabaseAuthorizationHeaders();
      const response = await fetch('/api/reset-seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authorization },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível resetar as temporadas.');
      }
      if (payload?.tournamentState) {
        resetTournament = normalizeSharedTournament(payload.tournamentState as Partial<SharedTournamentState>);
      }
    }

    setSharedTournament(resetTournament);
  };

  const handleFinalizeSeason = useCallback(async (automatic = false) => {
    if (activeSeason.status !== 'active' || currentUser?.role !== 'criador' || isImpersonating) return;
    const alreadyArchived = seasonArchives.some((archive) => archive.number === activeSeason.number);
    if (alreadyArchived) return;

    const nextSeason: ActiveSeason = {
      number: activeSeason.number + 1,
      status: 'ready',
      startedAt: null,
      endsAt: null,
    };
    try {
      await saveSharedSeasonControl(nextSeason);
    } catch (error) {
      if (!automatic) window.alert(error instanceof Error ? error.message : 'Não foi possível encerrar a temporada compartilhada.');
      else console.warn('Não foi possível encerrar automaticamente a temporada compartilhada.', error);
      return;
    }

    const criminalId = selectSeasonCriminalId(users, recentVotes, activeSeason.number, sharedTournament.attendeeIds);
    const endNotifications = users.flatMap((user): NotificationItem[] => {
      const playerVotes = recentVotes.filter((vote) => vote.targetUserId === user.id && vote.season === activeSeason.number);
      const items: NotificationItem[] = [{
        id: `season-finish:${activeSeason.number}:${user.id}`,
        userId: user.id,
        title: `Temporada ${activeSeason.number} encerrada`,
        message: 'A votação foi encerrada. Confira o resultado e o histórico da temporada.',
        type: 'system',
        read: false,
        createdAt: 'Agora',
      }];
      if (playerVotes.length) {
        const average = Math.round(playerVotes.reduce((sum, vote) => sum + vote.score, 0) / playerVotes.length);
        items.push({
          id: `season-card:${activeSeason.number}:${user.id}`,
          userId: user.id,
          title: 'Sua carta da temporada foi gerada',
          message: `A carta da temporada ${activeSeason.number} foi criada com média ${average}. Veja-a na aba Cartas.`,
          type: 'card',
          read: false,
          createdAt: 'Agora',
        });
      }
      return items;
    });
    publishNotifications(endNotifications);

    const archive: SeasonArchive = {
      number: activeSeason.number,
      startedAt: activeSeason.startedAt,
      endedAt: new Date().toISOString(),
      automatic,
      cardCount: cardsWithAverage.filter((card) => card.season === activeSeason.number).length,
      criminalUserId: criminalId,
      playerSnapshots: users.map((user) => {
        const seasonVotes = recentVotes.filter((vote) => vote.targetUserId === user.id && vote.season === activeSeason.number);
        const seasonAverage = seasonVotes.length
          ? Math.round(seasonVotes.reduce((sum, vote) => sum + vote.score, 0) / seasonVotes.length)
          : null;
        return {
          userId: user.id,
          name: user.name,
          average: seasonAverage,
          totalVotes: seasonVotes.length,
          tier: user.id === criminalId
            ? 'criminoso'
            : seasonAverage === null ? null : getTierFromScore(seasonAverage),
        };
      }),
    };

    const commentsToArchive: SeasonCommentArchive = {};
    users.forEach((user) => {
      user.comments.forEach((comment) => {
        const commentSeason = getCommentSeason(user.id, comment, recentVotes, seasonArchives, activeSeason.number);
        commentsToArchive[commentSeason] ||= {};
        commentsToArchive[commentSeason][user.id] ||= [];
        commentsToArchive[commentSeason][user.id].push({ ...comment, season: commentSeason });
      });
    });
    if (Object.keys(commentsToArchive).length) {
      setSeasonCommentArchive((previous) => mergeSeasonCommentArchive(previous, commentsToArchive));
    }

    setSeasonArchives((previous) => [archive, ...previous.filter((item) => item.number !== archive.number)]);
    setUsers((previous) => previous.map((user) => ({
      ...user,
      comments: [],
      isCriminoso: false,
      seasonsPlayed: user.seasonsPlayed + 1,
    })));
    setCards((previous) => previous.map((card) => {
      if (card.season !== activeSeason.number) return card;
      const isCriminoso = card.userId === criminalId;
      return {
        ...card,
        isCriminoso,
        tier: getSeasonCardTier(card.score, isCriminoso, card.season),
      };
    }));
    setSeasonEvent({ kind: 'finish', season: activeSeason.number, automatic, id: Date.now() });
    setSharedTournament((previous) => {
      const normalizedPrevious = normalizeSharedTournament(previous);
      return normalizeSharedTournament({
        ...normalizedPrevious,
        updatedAt: Math.max(Date.now(), normalizedPrevious.updatedAt + 1),
        attendanceSeason: nextSeason.number,
        tournamentStarted: false,
        attendeeIds: [],
        captainIds: ['', ''],
        predefinedTeams: null,
        captainDraftTurn: null,
        playerPoolIds: [],
        draftStage: 'setup',
        teams: [],
      });
    });
    activeSeasonRef.current = nextSeason;
    setActiveSeason(nextSeason);
  }, [activeSeason, cardsWithAverage, currentUser?.role, isImpersonating, publishNotifications, recentVotes, seasonArchives, sharedTournament.attendeeIds, users]);

  const handleResetSeasonRatings = async (targetUserId?: string) => {
    if (!canAccessCreatorPanel) return;

    try {
      await deleteSharedSeasonVotes(activeSeason.number, targetUserId);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Não foi possível apagar as notas compartilhadas.');
      return;
    }

    const remainingVotes = recentVotes.filter((vote) =>
      vote.season !== activeSeason.number || (targetUserId && vote.targetUserId !== targetUserId)
    );
    const allVoteCounts = new Map<string, number>();
    const activeSeasonTotals = new Map<string, { sum: number; count: number }>();
    remainingVotes.forEach((vote) => {
      allVoteCounts.set(vote.targetUserId, (allVoteCounts.get(vote.targetUserId) || 0) + 1);
      if (vote.season === activeSeason.number) {
        const total = activeSeasonTotals.get(vote.targetUserId) || { sum: 0, count: 0 };
        activeSeasonTotals.set(vote.targetUserId, { sum: total.sum + vote.score, count: total.count + 1 });
      }
    });

    setRecentVotes(remainingVotes);
    setUsers((previous) => previous.map((user) => {
      const total = activeSeasonTotals.get(user.id);
      return {
        ...user,
        currentScore: total ? Math.round(total.sum / total.count) : 0,
        totalVotes: allVoteCounts.get(user.id) || 0,
        isCriminoso: targetUserId ? (user.id === targetUserId ? false : user.isCriminoso) : false,
      };
    }));
    setCards((previous) => previous.filter((card) =>
      card.season !== activeSeason.number || (targetUserId && card.userId !== targetUserId)
    ));
  };

  useEffect(() => {
    if (!activeSeason.endsAt) return;
    const remaining = new Date(activeSeason.endsAt).getTime() - Date.now();
    const timeout = window.setTimeout(() => handleFinalizeSeason(true), Math.max(0, remaining));
    return () => window.clearTimeout(timeout);
  }, [activeSeason.endsAt, handleFinalizeSeason]);

  // Dark/Light theme sync
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.style.colorScheme = theme;
    writeStorage('personas_theme_v1', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleLogout = () => {
    void supabase?.auth.signOut();
    try {
      if (isLocalPreview) window.localStorage.setItem('personas_logged_out_v1', 'true');
    } catch {
      // Logout still works for the current page if session storage is unavailable.
    }
    setCurrentUser(null);
    setIsCreatorSession(false);
    setIsImpersonating(false);
    setIsCaptainRolePreview(false);
    setProfileModalTarget(null);
    setReportModalTarget(null);
    setActiveTab('cards');
  };

  // Role testing simulator (Testar como é os cargos)
  const handleTestRole = (role: TestRole) => {
    if (!isCreatorSession) return;
    if (role === 'capitão') {
      const assignedCaptains = sharedTournament.captainIds.filter(Boolean);
      const currentCaptainIndex = assignedCaptains.indexOf(currentRosterUserId || '');
      const candidateId = assignedCaptains.length > 0
        ? assignedCaptains[currentCaptainIndex >= 0 ? (currentCaptainIndex + 1) % assignedCaptains.length : 0]
        : checkedInRosterIds[0] || users.find((user) => user.role === 'jogador')?.id;
      const captainPreviewUser = users.find((user) => user.id === candidateId);
      if (!captainPreviewUser) return;
      setCurrentUser(captainPreviewUser);
      setIsImpersonating(true);
      setIsCaptainRolePreview(true);
      return;
    }
    setIsCaptainRolePreview(false);
    if (role === 'visitante') {
      setCurrentUser(null);
      setIsImpersonating(false);
      return;
    }

    const targetUser = users.find((u) => u.role === role) || users[0];
    setCurrentUser(targetUser);
    setIsImpersonating(role !== 'criador');
  };

  // Impersonate User Flow
  const handleImpersonateUser = (targetUser: User) => {
    setCurrentUser(targetUser);
    setIsImpersonating(true);
    setIsCaptainRolePreview(false);
  };

  const handleStopImpersonating = () => {
    setCurrentUser(creatorUser);
    setIsCreatorSession(true);
    setIsImpersonating(false);
    setIsCaptainRolePreview(false);
  };

  const prepareUserUpdate = (updated: User) => {
    const existing = users.find((user) => user.id === updated.id)
      || users.find((user) => normalizeHandle(user.handle) === normalizeHandle(updated.handle));
    const previousHandle = normalizeHandle(existing?.handle || updated.handle);
    const normalized: User = {
      ...updated,
      id: existing?.id || updated.id,
      handle: normalizeHandle(updated.handle),
      riotId: updated.riotId.trim(),
      stats: normalizeStats(updated.stats),
    };
    return {
      normalized,
      previousHandle,
      existing,
      identityError: validateUniqueUserIdentity(users, normalized, creatorUser.id),
    };
  };

  const applyUserUpdate = (normalized: User, previousHandle: string) => {
    const matchesUpdatedUser = (user: User) =>
      user.id === normalized.id || normalizeHandle(user.handle) === previousHandle;
    const updateComments = (comments: User['comments']) => (comments || []).map((comment) =>
      comment.authorId === normalized.id || normalizeHandle(comment.authorHandle) === previousHandle
        ? {
            ...comment,
            authorId: normalized.id,
            authorName: normalized.name,
            authorHandle: normalized.handle,
            authorAvatar: normalized.avatar,
          }
        : comment,
    );

    setUsers((previous) => {
      const found = previous.some(matchesUpdatedUser);
      const updatedUsers = previous.map((user) => ({
        ...(matchesUpdatedUser(user) ? { ...user, ...normalized, id: user.id } : user),
        comments: updateComments(user.comments),
      }));
      return found
        ? updatedUsers
        : [...updatedUsers, { ...normalized, comments: updateComments(normalized.comments) }];
    });
    setCards((previous) => previous.map((card) => {
      if (card.userId !== normalized.id && normalizeHandle(card.userHandle) !== previousHandle) return card;
      const isCurrentSeason = card.season === activeSeason.number;
      return {
        ...card,
        userId: normalized.id,
        userName: normalized.name,
        userHandle: normalized.handle,
        userAvatar: normalized.avatar,
        lane: normalized.primaryLane,
        favoriteChampion: normalized.favoriteChampion,
        stats: { ...normalized.stats },
        ...(isCurrentSeason ? {
          score: normalized.currentScore,
          tier: getSeasonCardTier(normalized.currentScore, Boolean(normalized.isCriminoso), activeSeason.number),
          isCriminoso: Boolean(normalized.isCriminoso),
        } : {}),
      };
    }));
    setTeams((previous) => previous.map((team) => team.captainId === normalized.id
      ? { ...team, captainName: normalized.name }
      : team));
    setCurrentUser((previous) => previous && matchesUpdatedUser(previous) ? { ...normalized } : previous);
    setProfileModalTarget((previous) => previous && matchesUpdatedUser(previous) ? { ...normalized } : previous);
  };

  const isCurrentAccount = (user: User, previousHandle: string) =>
    !isImpersonating && Boolean(currentUser && (
      currentUser.id === user.id || normalizeHandle(currentUser.handle) === previousHandle
    ));

  const handleUpdateUser = (updated: User): string | null => {
    const { normalized, previousHandle, identityError } = prepareUserUpdate(updated);
    if (identityError) return identityError;

    applyUserUpdate(normalized, previousHandle);
    if (isCurrentAccount(normalized, previousHandle)) {
      void saveAuthenticatedProfile(normalized).catch((error) => console.error('Não foi possível sincronizar o perfil compartilhado.', error));
    }
    return null;
  };

  const handleDeleteAccount = async (target: User): Promise<void> => {
    if (!canAccessCreatorPanel || currentUser?.role !== 'criador' || isImpersonating) {
      throw new Error('Somente o criador pode excluir contas.');
    }
    if (target.role === 'criador'
      || target.id === creatorUser.id
      || target.id === currentUser.id
      || Boolean(target.authId && (target.authId === creatorUser.authId || target.authId === currentUser.authId))) {
      throw new Error('Esta conta não pode ser excluída por esta opção.');
    }

    if (target.authId) await deleteRegisteredAccount(target.authId);

    const deletedIds = new Set([target.id, target.authId].filter((id): id is string => Boolean(id)));
    const isDeletedUser = (id: string | undefined) => Boolean(id && deletedIds.has(id));

    setUsers((previous) => previous.filter((user) => !isDeletedUser(user.id) && !isDeletedUser(user.authId)));
    setRecentVotes((previous) => previous.filter((vote) =>
      !isDeletedUser(vote.targetUserId)
      && !isDeletedUser(vote.fromUserId)
      && !isDeletedUser(vote.fromAuthUserId)
    ));
    pendingSharedVotesRef.current.forEach((vote, id) => {
      if (isDeletedUser(vote.targetUserId) || isDeletedUser(vote.fromUserId) || isDeletedUser(vote.fromAuthUserId)) {
        pendingSharedVotesRef.current.delete(id);
      }
    });
    setCards((previous) => previous.filter((card) => !isDeletedUser(card.userId)));
    setNotifications((previous) => previous.filter((item) => !isDeletedUser(item.userId)));
    setReports((previous) => previous.filter((report) =>
      !isDeletedUser(report.reporterId) && !isDeletedUser(report.targetUserId)
    ));
    setSeasonCommentArchive((previous) => Object.fromEntries(
      Object.entries(previous).map(([season, commentsByUser]) => [
        season,
        Object.fromEntries(Object.entries(commentsByUser)
          .filter(([userId]) => !isDeletedUser(userId))
          .map(([userId, comments]) => [
            userId,
            comments.filter((comment) => !isDeletedUser(comment.authorId)),
          ])),
      ]),
    ));
    setProfileModalTarget((previous) => previous && (isDeletedUser(previous.id) || isDeletedUser(previous.authId)) ? null : previous);
    setReportModalTarget((previous) => previous && (isDeletedUser(previous.id) || isDeletedUser(previous.authId)) ? null : previous);
    updateSharedTournament((previous) => {
      const isDeletedAccount = (id: string) => isDeletedUser(id);
      return {
        attendeeIds: previous.attendeeIds.filter((id) => !isDeletedAccount(id)),
        captainIds: previous.captainIds.map((id) => isDeletedAccount(id) ? '' : id) as [string, string],
        playerPoolIds: previous.playerPoolIds.filter((id) => !isDeletedAccount(id)),
        teams: previous.teams.map((team) => ({
          ...team,
          captainId: isDeletedAccount(team.captainId) ? '' : team.captainId,
          members: team.members.filter((id) => !isDeletedAccount(id)),
        })),
      };
    });
  };

  const handleSaveProfile = async (updated: Partial<User>): Promise<string | null> => {
    const profile = (profileModalTarget && (
      users.find((user) => user.id === profileModalTarget.id)
      || users.find((user) => normalizeHandle(user.handle) === normalizeHandle(profileModalTarget.handle))
    )) || profileModalTarget;
    if (!profile) return 'Não foi possível localizar esse perfil.';

    const { normalized, previousHandle, identityError } = prepareUserUpdate({ ...profile, ...updated });
    if (identityError) return identityError;

    if (isCurrentAccount(normalized, previousHandle)) {
      try {
        await saveAuthenticatedProfile(normalized);
      } catch (error) {
        console.error('Não foi possível salvar o perfil no Supabase.', error);
        return error instanceof Error && /Entre na conta/.test(error.message)
          ? 'Entre na sua conta Personas para salvar a foto e sincronizá-la em todas as telas.'
          : 'Não foi possível salvar a foto no Supabase. Confira a conexão e tente novamente.';
      }
    }

    applyUserUpdate(normalized, previousHandle);
    return null;
  };

  const handleAddCommunityPlayer = (player: { name: string; handle: string; riotId: string; primaryLane: Lane }): string | null => {
    if (!canAccessCreatorPanel) return 'Somente o criador pode adicionar jogadores.';

    const handle = normalizeHandle(player.handle);
    if (!player.name.trim()) return 'Informe o nome do jogador.';

    const handleSlug = handle.slice(1).toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'jogador';
    const riotId = player.riotId.trim() || `${handle.slice(1)}#BR1`;
    const newUser: User = {
      id: `user_${handleSlug}_${Date.now()}`,
      handle,
      name: player.name.trim(),
      role: 'jogador',
      isOnline: false,
      avatar: mascotAvatar,
      bio: '',
      favoriteChampion: '',
      primaryLane: player.primaryLane,
      riotId,
      currentScore: 0,
      totalVotes: 0,
      seasonsPlayed: 0,
      mvpCount: 0,
      aceCount: 0,
      stats: { kills: 0, deaths: 0, assists: 0, minions: 0, gold: 0 },
      entryDate: new Date().toLocaleDateString('pt-BR'),
      createdAt: new Date().toISOString(),
      comments: [],
    };

    const identityError = validateUniqueUserIdentity(users, newUser, creatorUser.id);
    if (identityError) return identityError;

    setUsers((previous) => previous.some((user) =>
      normalizeHandle(user.handle) === handle ||
      (newUser.riotId && normalizeRiotId(user.riotId) === normalizeRiotId(newUser.riotId))
    )
      ? previous
      : [...previous, newUser]);
    return null;
  };

  const saveMatchStatsRecord = async (data: {
    userId: string;
    stats: User['stats'];
    result: 'victory' | 'defeat';
    imageFingerprint: string;
  }): Promise<string | null> => {
    if (!canAccessCreatorPanel || currentUser?.role !== 'criador' || isImpersonating) {
      return 'Somente a conta do criador pode atualizar as estatísticas da partida.';
    }
    const target = users.find((user) => user.id === data.userId);
    if (!target) return 'Não encontrei esse jogador no elenco. Atualize a página e tente novamente.';

    const stats = normalizeStats(data.stats);
    const record: MatchRecord = {
      id: `match_${target.id}_${activeSeason.number}_${data.imageFingerprint}`,
      playerId: target.id,
      season: activeSeason.number,
      result: data.result,
      stats,
      imageFingerprint: data.imageFingerprint,
      createdAt: new Date().toISOString(),
    };
    const nextRecords = [
      ...matchRecords.filter((item) => !(item.playerId === record.playerId
        && item.season === record.season && item.imageFingerprint === record.imageFingerprint)),
      record,
    ];
    const seasonAverage = averageMatchStats(nextRecords.filter((item) => item.playerId === target.id && item.season === activeSeason.number));
    try {
      await saveSharedPlayerMatchRecord({
        playerId: record.playerId,
        season: record.season,
        result: record.result,
        stats: record.stats,
        imageFingerprint: record.imageFingerprint,
      });
      await saveSharedPlayerMatchStats(target.id, seasonAverage);
    } catch (error) {
      return error instanceof Error ? error.message : 'Não foi possível salvar as estatísticas da partida.';
    }
    setMatchRecords(nextRecords);
    setUsers((previous) => previous.map((user) => user.id === target.id ? { ...user, stats: seasonAverage } : user));
    setCards((previous) => previous.map((card) =>
      card.userId === target.id && card.season === activeSeason.number ? { ...card, stats: seasonAverage } : card,
    ));
    publishNotifications([{
      id: `match-stats:${record.season}:${record.playerId}:${record.imageFingerprint}`,
      userId: target.id,
      title: data.result === 'victory' ? 'Vitória registrada na temporada' : 'Derrota registrada na temporada',
      message: `${formatKda(stats)} · ${stats.minions.toLocaleString('pt-BR')} minions · ${formatGold(stats.gold)} de ouro`,
      type: 'card',
      read: false,
      createdAt: 'Agora',
    }]);
    return null;
  };

  // OCR and manual entries share the same seasonal match history and average calculation.
  const handleApplyOcrMatchStats = async (data: {
    userId: string;
    playerName: string;
    stats: User['stats'];
    result: 'victory' | 'defeat';
    imageFingerprint: string;
  }) => {
    const error = await saveMatchStatsRecord(data);
    if (error) throw new Error(error);
  };

  const handleAddManualMatchStats = async (data: {
    userId: string;
    stats: User['stats'];
    result: 'victory' | 'defeat';
  }): Promise<string | null> => {
    const imageFingerprint = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return saveMatchStatsRecord({ ...data, imageFingerprint });
  };

  // Notes update the player's average, active-season card, and profile comments.
  const handleCastVote = (voteData: {
    targetUserId: string;
    score: number;
    comment?: string;
  }): Promise<string | null> => {
    return (async () => {
    if (!currentUser) return 'Entre na sua conta para dar uma nota.';
    if (currentUser.id === voteData.targetUserId && currentUser.role !== 'criador') return 'Você não pode avaliar o próprio perfil.';
    const isLocalSimulationVote = isLocalPreview && isImpersonating;
    if (isImpersonating && !isLocalSimulationVote) return 'Saia da conta assumida para registrar uma nota.';
    if (activeSeason.status !== 'active') return 'A votação está fechada. Aguarde o criador abrir uma nova temporada.';
    if (supabase && !isSharedVotingReady && !isLocalSimulationVote) return 'Aguarde a sincronização das notas antes de votar.';
    if (recentVotes.some((vote) => (vote.fromUserId === currentUser.id || Boolean(currentUser.authId && vote.fromAuthUserId === currentUser.authId)) && vote.targetUserId === voteData.targetUserId && vote.season === activeSeason.number)) {
      return 'Você já deu uma nota para este jogador nesta temporada.';
    }

    const target = users.find((u) => u.id === voteData.targetUserId);
    if (!target) return 'Não foi possível encontrar este jogador.';
    if (!sharedTournament.attendeeIds.includes(target.id)) return 'Este jogador não confirmou presença nesta temporada.';

    const score = Math.max(0, Math.min(100, Math.round(voteData.score)));
    let voteRecord: VoteRecord = {
      id: `${isLocalSimulationVote ? 'local_sim_vote' : 'vote'}_${Date.now()}`,
      fromUserId: currentUser.id,
      fromUserName: currentUser.name,
      fromUserHandle: currentUser.handle,
      targetUserId: target.id,
      targetUserName: target.name,
      score,
      comment: voteData.comment?.trim() || undefined,
      season: activeSeason.number,
      createdAt: new Date().toISOString(),
    };
    if (!isLocalSimulationVote) {
      try {
        const savedVote = await saveSharedSeasonVote(voteRecord);
        if (supabase && !savedVote) return 'O serviço compartilhado de notas não está disponível.';
        if (savedVote) {
          voteRecord = savedVote;
          pendingSharedVotesRef.current.set(savedVote.id, savedVote);
        }
      } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
        if (code === '23505') return 'Você já deu uma nota para este jogador nesta temporada.';
        if (code === '42501') return 'A votação está fechada ou sua sessão expirou. Atualize a página e tente novamente.';
        return error instanceof Error ? error.message : 'Não foi possível salvar sua nota compartilhada.';
      }
    }

    const targetSeasonVotes = recentVotes.filter((vote) => vote.targetUserId === target.id && vote.season === activeSeason.number);
    const newAverage = Math.round((targetSeasonVotes.reduce((sum, vote) => sum + vote.score, 0) + score) / (targetSeasonVotes.length + 1));

    // Add player comment if provided
    const commentText = voteData.comment?.trim();
    const newComment = commentText
      ? {
          id: `comm_${Date.now()}`,
          season: activeSeason.number,
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorHandle: currentUser.handle,
          authorAvatar: currentUser.avatar,
          text: commentText,
          scoreGiven: score,
          createdAt: 'Agora',
        }
      : undefined;

    const finalUsers = users.map((user) => {
      const playerVotes = recentVotes.filter((vote) => vote.targetUserId === user.id);
      const playerSeasonVotes = playerVotes.filter((vote) => vote.season === activeSeason.number);
      const includesNewVote = user.id === target.id;
      const seasonScoreTotal = playerSeasonVotes.reduce((sum, vote) => sum + vote.score, 0) + (includesNewVote ? score : 0);
      const seasonVoteCount = playerSeasonVotes.length + (includesNewVote ? 1 : 0);
      return {
        ...user,
        currentScore: seasonVoteCount ? Math.round(seasonScoreTotal / seasonVoteCount) : 0,
        totalVotes: playerVotes.length + (includesNewVote ? 1 : 0),
        ...(includesNewVote && newComment ? { comments: [newComment, ...(user.comments || [])] } : {}),
      };
    });

    setUsers(finalUsers);

    setCards((previousCards) => {
      let targetHasSeasonCard = false;
      const synchronizedCards = previousCards.map((card) => {
        if (card.season !== activeSeason.number) return card;
        const cardUser = finalUsers.find((user) => user.id === card.userId);
        if (!cardUser) return card;
        if (cardUser.id === target.id) targetHasSeasonCard = true;
        return {
          ...card,
          userName: cardUser.name,
          userHandle: cardUser.handle,
          userAvatar: cardUser.avatar,
          score: cardUser.currentScore,
          tier: getSeasonCardTier(cardUser.currentScore, Boolean(cardUser.isCriminoso), activeSeason.number),
          lane: cardUser.primaryLane,
          favoriteChampion: cardUser.favoriteChampion,
          isCriminoso: Boolean(cardUser.isCriminoso),
        };
      });
      return targetHasSeasonCard
        ? synchronizedCards
        : [createPlayerCard(finalUsers.find((user) => user.id === target.id)!, activeSeason.number, newAverage), ...synchronizedCards];
    });

    setRecentVotes((prev) => [...prev, voteRecord]);

    if (!supabase || isLocalSimulationVote) {
      publishNotifications([{
        id: `vote:${voteRecord.id}`,
        userId: creatorUser.id,
        title: 'Nova nota recebida',
        message: `${currentUser.name} avaliou ${target.name} com nota ${score} na temporada ${activeSeason.number}.`,
        type: 'vote',
        read: false,
        createdAt: 'Agora',
      }]);
    }
    return null;
    })();
  };

  const handleAddProfileComment = (targetUserId: string, text: string) => {
    if (!currentUser || currentUser.id === targetUserId || !text.trim()) return;
    const comment = {
      id: `comm_${Date.now()}`,
      season: activeSeason.number,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorHandle: currentUser.handle,
      authorAvatar: currentUser.avatar,
      text: text.trim(),
      createdAt: new Date().toLocaleString('pt-BR'),
    };
    setUsers((previous) => previous.map((user) =>
      user.id === targetUserId ? { ...user, comments: [comment, ...(user.comments || [])] } : user
    ));
  };

  const handleDeleteProfileComment = (targetUserId: string, commentId: string) => {
    if (currentUser?.role !== 'criador' || isImpersonating) return;
    setUsers((previous) => previous.map((user) =>
      user.id === targetUserId
        ? { ...user, comments: (user.comments || []).filter((comment) => comment.id !== commentId) }
        : user
    ));
    setSeasonCommentArchive((previous) => {
      let changed = false;
      const next = { ...previous };
      Object.entries(previous).forEach(([seasonKey, usersForSeason]) => {
        const archivedComments = usersForSeason[targetUserId];
        if (!archivedComments?.some((comment) => comment.id === commentId)) return;
        changed = true;
        const updatedUsers = { ...usersForSeason };
        updatedUsers[targetUserId] = archivedComments.filter((comment) => comment.id !== commentId);
        next[Number(seasonKey)] = updatedUsers;
      });
      return changed ? next : previous;
    });
  };

  const handleSubmitReport = (reportData: {
    targetUserId: string;
    reason: string;
    details: string;
  }) => {
    if (!currentUser) return;
    const target = users.find((u) => u.id === reportData.targetUserId);
    if (!target) return;

    const newReport: ReportItem = {
      id: `rep_${Date.now()}`,
      reporterId: currentUser.id,
      reporterHandle: currentUser.handle,
      targetUserId: target.id,
      targetUserHandle: target.handle,
      targetUserName: target.name,
      reason: reportData.reason,
      details: reportData.details,
      status: 'pendente',
      createdAt: new Date().toISOString(),
    };

    setReports((prev) => [newReport, ...prev]);

    publishNotifications([{
      id: `notif_rep_${Date.now()}`,
      userId: creatorUser.id,
      title: '⚠️ Nova Denúncia Recebida!',
      message: `${currentUser.name} denunciou ${target.name} por "${reportData.reason}".`,
      type: 'report',
      read: false,
      createdAt: 'Agora',
    }]);
  };

  const handleResolveReport = (reportId: string, status: 'resolvido' | 'descartado') => {
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
  };

  const hasThreeCompletedSeasons = new Set(seasonArchives.map((season) => season.number)).size >= 3;

  // Sort and filter cards strictly by tier hierarchy (from Lenda to Criminoso)
  const sortedAndFilteredCards = [...cardsWithAverage]
    .sort((a, b) => {
      if (a.isLegend !== b.isLegend) return a.isLegend ? -1 : 1;
      const orderA = TIER_ORDER[a.tier] || 99;
      const orderB = TIER_ORDER[b.tier] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return b.score - a.score;
    })
    .filter((card) => {
      if (card.isLegend && !hasThreeCompletedSeasons) return false;

      if (cardTierFilter !== 'all') {
        if (cardTierFilter === 'criminoso' && !card.isCriminoso) return false;
        if (cardTierFilter === 'lenda' && !card.isLegend) return false;
        if (cardTierFilter === 'mvp' && !card.isMvp) return false;
        if (cardTierFilter === 'ace' && !card.isAce) return false;
        if (
          !['criminoso', 'lenda', 'mvp', 'ace'].includes(cardTierFilter) &&
          card.tier !== cardTierFilter
        ) {
          return false;
        }
      }

      if (cardSeasonFilter === 'current' && card.season !== activeSeason.number) return false;
      if (cardSeasonFilter !== 'current' && cardSeasonFilter !== 'all' && card.season !== Number(cardSeasonFilter)) return false;
      if (cardLaneFilter !== 'all' && card.lane !== cardLaneFilter) return false;
      if (cardAwardFilter === 'mvp' && !card.isMvp) return false;
      if (cardAwardFilter === 'ace' && !card.isAce) return false;
      if (cardAwardFilter === 'honra' && !card.isMencaoHonrosa) return false;

      if (cardSearchQuery.trim()) {
        const q = cardSearchQuery.toLowerCase();
        return (
          card.userName.toLowerCase().includes(q) ||
          card.userHandle.toLowerCase().includes(q) ||
          card.lane.toLowerCase().includes(q) ||
          card.favoriteChampion.toLowerCase().includes(q)
        );
      }

      return true;
    });

  const cardsInSelectedSeason = cardsWithAverage.filter((card) => (
    cardSeasonFilter === 'all'
      || (cardSeasonFilter === 'current' ? card.season === activeSeason.number : card.season === Number(cardSeasonFilter))
  ));
  const usersWithRankedCards = new Set(cardsInSelectedSeason.map((card) => card.userId));
  const checkedInUsersWithoutRankedCards = users
    .filter((user) => checkedInRosterIds.includes(user.id))
    .filter((user) => !usersWithRankedCards.has(user.id));
  const checkedInPlayers = checkedInRosterIds.flatMap((userId) => {
    const user = users.find((candidate) => candidate.id === userId);
    return user ? [{ id: user.id, name: user.name }] : [];
  });
  const usersWithoutRankedCards = checkedInUsersWithoutRankedCards
    .filter(() => cardTierFilter === 'all' && cardAwardFilter === 'all')
    .filter(() => cardSeasonFilter === 'current' || cardSeasonFilter === 'all' || Number(cardSeasonFilter) === activeSeason.number)
    .filter((user) => cardLaneFilter === 'all' || user.primaryLane === cardLaneFilter)
    .filter((user) => {
      if (!cardSearchQuery.trim()) return true;
      const query = cardSearchQuery.toLocaleLowerCase('pt-BR');
      return [user.name, user.handle, user.riotId, user.primaryLane]
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(query));
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <div className="app-shell min-h-screen flex flex-col font-sans transition-colors duration-200">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      {/* Top Navigation */}
      <Navbar
        currentUser={currentUser}
        creatorUser={creatorUser}
        isImpersonating={isImpersonating}
        onStopImpersonating={handleStopImpersonating}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpenProfileModal={() => setProfileModalTarget(currentUser)}
        onLogout={handleLogout}
        notifications={visibleNotifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onDeleteNotification={handleDeleteNotification}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onDeleteAllNotifications={handleDeleteAllNotifications}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onTestRole={handleTestRole}
        canTestRoles={isCreatorSession}
        isCaptainPreview={isCaptainRolePreview}
      />

      {/* Main Container */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-8">
        {/* ========================================================= */}
        {/* TAB 1: CARTAS RANQUEADAS (DO MAIOR PARA O MENOR)          */}
        {/* ========================================================= */}
        {activeTab === 'cards' && (
          <div className="space-y-8">
            {/* Hero Banner */}
            <div className="cards-hero relative rounded-3xl overflow-hidden p-6 md:p-9 border shadow-2xl">
              <div className="relative z-10 max-w-3xl lg:max-w-[64%]">
                <div className="mb-3">
                  <button
                    type="button"
                    aria-label="Beta: site em desenvolvimento"
                    aria-describedby="site-beta-tooltip"
                    className="group relative inline-flex cursor-help items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-950/65 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200 outline-none transition hover:border-amber-300/70 hover:bg-amber-900/70 focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    <FlaskConical className="h-3.5 w-3.5 text-amber-300" />
                    <span>Beta</span>
                    <span
                      id="site-beta-tooltip"
                      role="tooltip"
                      className="pointer-events-none absolute left-0 top-[calc(100%+0.5rem)] z-30 w-60 rounded-xl border border-amber-700/60 bg-slate-950 px-3 py-2 text-left text-[11px] font-medium normal-case leading-relaxed tracking-normal text-slate-200 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      Site em desenvolvimento. Algumas funções e conteúdos ainda podem mudar.
                    </span>
                  </button>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-700/60 text-red-300 text-xs font-mono mb-4">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>ARQUIVO OFICIAL · TEMPORADA {String(activeSeason.number).padStart(2, '0')}</span>
                </div>

                <h1 className="max-w-2xl text-3xl md:text-5xl font-display font-black tracking-tight text-white leading-tight">
                  O seu legado no Rift, <span className="text-amber-300">carta por carta.</span>
                </h1>

                <p className="mt-3 max-w-xl text-slate-300 text-sm md:text-base leading-relaxed">
                  Consulte as cartas oficiais, acompanhe a evolução do elenco e descubra quem está no topo da temporada.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setActiveTab('roulette')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm transition-colors"
                  >
                    <Flame className="w-4 h-4 text-amber-400" />
                    Sortear regra da partida
                  </button>
                </div>
              </div>
              <div className="hero-mascot" aria-hidden="true">
                <div className="hero-mascot__ring" />
                <img src={mascotAvatar} alt="" />
                <div className="hero-mascot__badge">
                  <Trophy className="h-4 w-4 text-amber-300" />
                  <span>{cardsWithAverage.length} cartas · {checkedInUsersWithoutRankedCards.length} sem média</span>
                </div>
              </div>
            </div>

            <SeasonControlBanner
              activeSeason={activeSeason}
              canManageSeason={currentUser?.role === 'criador' && !isImpersonating}
              checkInOpen={activeSeason.status !== 'active' && !sharedTournament.tournamentStarted}
              isCheckedIn={Boolean(currentRosterUserId && checkedInRosterIds.includes(currentRosterUserId))}
              checkInCount={checkedInRosterIds.length}
              checkedInPlayers={checkedInPlayers}
              checkInDisabled={isCheckInSaving || isImpersonating || !isSharedTournamentReady || (sharedTournament.attendanceSeason !== undefined && sharedTournament.attendanceSeason !== activeSeason.number)}
              checkInSubmitting={isCheckInSaving}
              checkInError={checkInError}
              onCheckIn={() => handleToggleTournamentAttendance()}
              onStart={handleStartSeason}
              onFinish={() => handleFinalizeSeason(false)}
            />

            {/* Filter Bar */}
            <div className="filter-panel p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                {[
                  { id: 'all', label: 'Todas as Cartas' },
                  ...(hasThreeCompletedSeasons ? [{ id: 'lenda', label: '★ Lenda' }] : []),
                  { id: 'challenger', label: 'Challenger' },
                  { id: 'grao_mestre', label: 'Grão-Mestre' },
                  { id: 'mestre', label: 'Mestre' },
                  { id: 'diamante', label: 'Diamante' },
                  { id: 'esmeralda', label: 'Esmeralda' },
                  { id: 'platina', label: 'Platina' },
                  { id: 'ouro', label: 'Ouro' },
                  { id: 'prata', label: 'Prata' },
                  { id: 'bronze', label: 'Bronze' },
                  { id: 'ferro', label: 'Ferro' },
                  { id: 'madeira', label: 'Madeira' },
                  { id: 'criminoso', label: '🔒 Criminoso' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setCardTierFilter(f.id)}
                    aria-pressed={cardTierFilter === f.id}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      cardTierFilter === f.id
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 md:w-auto">
                <label className="sr-only" htmlFor="card-season-filter">Filtrar por temporada</label>
                <select id="card-season-filter" value={cardSeasonFilter === 'current' ? String(activeSeason.number) : cardSeasonFilter} onChange={(event) => {
                  const nextFilter = event.target.value;
                  setCardSeasonFilter(nextFilter === String(activeSeason.number) ? 'current' : nextFilter);
                }} className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none">
                  <option value="all">Todas as temporadas</option>
                  {[...new Set([...cardsWithAverage.map((card) => card.season), activeSeason.number])].sort((a, b) => b - a).map((season) => <option key={season} value={season}>Temporada {season}</option>)}
                </select>
                <label className="sr-only" htmlFor="card-lane-filter">Filtrar por rota</label>
                <select id="card-lane-filter" value={cardLaneFilter} onChange={(event) => setCardLaneFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none">
                  <option value="all">Todas as rotas</option>
                  {['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPORTE', 'PREENCHER'].map((lane) => <option key={lane} value={lane}>{lane === 'JUNGLE' ? 'Jungler' : lane === 'PREENCHER' ? 'Preencher' : lane}</option>)}
                </select>
                <label className="sr-only" htmlFor="card-award-filter">Filtrar por destaque</label>
                <select id="card-award-filter" value={cardAwardFilter} onChange={(event) => setCardAwardFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none">
                  <option value="all">Todos os destaques</option><option value="mvp">MVP</option><option value="ace">ACE</option><option value="honra">Menção honrosa</option>
                </select>
                <div className="relative col-span-2 sm:col-span-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <label htmlFor="card-search" className="sr-only">Buscar por jogador, rota ou campeão</label>
                  <input id="card-search" type="text" placeholder="Buscar jogador ou campeão..." value={cardSearchQuery} onChange={(event) => setCardSearchQuery(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none" />
                </div>
              </div>
            </div>

            {/* Cards Showcase in Exact Hierarchy Order */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 justify-items-center gap-x-6 gap-y-10 py-2">
              {sortedAndFilteredCards.length === 0 && usersWithoutRankedCards.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-950/60 p-10 text-center text-sm text-slate-400">
                  {cardsWithAverage.length === 0
                    ? 'Nenhum perfil encontrado com os filtros selecionados.'
                    : 'Nenhuma carta encontrada para os filtros selecionados.'}
                </div>
              ) : (
                <>
                  {sortedAndFilteredCards.map((card) => {
                    const targetUser = users.find((u) => u.id === card.userId);
                    const currentCard = targetUser ? {
                      ...card,
                      userName: targetUser.name,
                      userHandle: targetUser.handle,
                      userAvatar: targetUser.avatar,
                      stats: card.season === activeSeason.number ? targetUser.stats : card.stats,
                      lane: targetUser.primaryLane,
                      favoriteChampion: targetUser.favoriteChampion,
                    } : card;
                    return (
                      <div key={card.id} className="flex flex-col items-center">
                        <RankedCard
                          card={currentCard}
                          size="md"
                          ornamentSettings={tierOrnamentSettings[card.tier] ?? cardOrnamentSettings}
                          onClick={() => {
                            if (targetUser) setProfileModalTarget(targetUser);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (targetUser) setProfileModalTarget(targetUser);
                          }}
                          className="mt-2.5 text-[11px] font-mono text-slate-400 hover:text-amber-400 transition-colors"
                        >
                          Ver Perfil de {card.userName} →
                        </button>
                      </div>
                    );
                  })}
                  {usersWithoutRankedCards.length > 0 && (
                    <div className="col-span-full flex w-full items-center gap-3 pt-3">
                      <span className="h-px flex-1 bg-slate-800" />
                      <h2 className="text-center font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Perfis aguardando a primeira média</h2>
                      <span className="h-px flex-1 bg-slate-800" />
                    </div>
                  )}
                  {usersWithoutRankedCards.map((user) => (
                    <div key={`profile-card-${user.id}`} className="flex flex-col items-center">
                      <ProfileOnlyCard user={user} onClick={() => setProfileModalTarget(user)} />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: SORTEIO PRÉ-PARTIDA (Roleta de Regras Personas)   */}
        {/* ========================================================= */}
        {activeTab === 'roulette' && (
          <CardRoulette
            deck={deck}
            currentUser={currentUser}
            isCaptain={isCaptainRolePreview || Boolean(currentUser && currentRosterUserId && checkedInRosterIds.includes(currentRosterUserId) && sharedTournament.captainIds.includes(currentRosterUserId))}
            currentUserRosterId={currentRosterUserId}
            captainIds={sharedTournament.captainIds}
            canEditCards={canAccessCreatorPanel}
            confirmedDeckCardId={sharedTournament.confirmedDeckCardId || null}
            captainRerollRequest={sharedTournament.captainRerollRequest || null}
            interClassDraw={sharedTournament.interClassDraw || null}
            onUpdateDeck={setDeck}
            onConfirmCard={(card) => {
              const wasAlreadyConfirmed = sharedTournament.confirmedDeckCardId === card.id;
              updateSharedTournament((previous) => ({
                confirmedDeckCardId: card.id,
                interClassDraw: previous.interClassDraw?.cardId === card.id ? previous.interClassDraw : null,
              }));
              if (wasAlreadyConfirmed) return;
              publishNotifications([{
                id: `notif_card_${Date.now()}`,
                userId: creatorUser.id,
                title: 'Carta Confirmada para a Partida',
                message: `A regra "${card.title}" está valendo no Rift!`,
                type: 'card',
                read: false,
                createdAt: 'Agora',
              }]);
            }}
            onCaptainRerollRequest={(request) => {
              if (!currentRosterUserId || !sharedTournament.confirmedDeckCardId
                || !sharedTournament.captainIds.includes(currentRosterUserId)
                || !request.opponentId || request.opponentId === currentRosterUserId) return;
              updateSharedTournament({ captainRerollRequest: request });
            }}
            onRespondToCaptainReroll={(accepted) => {
              const request = sharedTournament.captainRerollRequest;
              if (!request || request.status !== 'waiting_opponent' || request.opponentId !== currentRosterUserId) return;
              updateSharedTournament({
                captainRerollRequest: accepted
                  ? { ...request, status: 'waiting_creator', acceptedBy: currentRosterUserId || '', acceptedByName: currentUser?.name || 'Capitão' }
                  : null,
              });
            }}
            onApproveCaptainReroll={(card) => {
              if (!canAccessCreatorPanel || sharedTournament.captainRerollRequest?.status !== 'waiting_creator') return;
              updateSharedTournament({
                confirmedDeckCardId: card.id,
                captainRerollRequest: null,
                interClassDraw: null,
              });
              publishNotifications(users.filter((user) => sharedTournament.attendeeIds.includes(user.id)).map((user) => ({
                id: `reroll-card:${card.id}:${Date.now()}:${user.id}`,
                userId: user.id,
                title: 'A carta da partida mudou',
                message: `O Criador confirmou a carta ${card.title} após o pedido conjunto dos capitães.`,
                type: 'card' as const,
                read: false,
                createdAt: 'Agora',
              })));
            }}
            onDrawInterClass={(card, blueClass, redClass) => {
              if (!canAccessCreatorPanel || sharedTournament.confirmedDeckCardId !== card.id
                || card.title.trim().toLocaleLowerCase('pt-BR') !== 'inter classe' || blueClass === redClass) return;
              updateSharedTournament({ interClassDraw: { cardId: card.id, blueClass, redClass, drawnAt: Date.now() } });
            }}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 3: TIMES & PRESIDENTES (Equipes como Prioridade)      */}
        {/* ========================================================= */}
        {activeTab === 'teams' && (
          <TeamDraft
            users={users}
            votes={recentVotes}
            teams={teams}
            presets={presets}
            currentUser={currentUser}
            canManageTournament={canAccessCreatorPanel}
            sharedTournament={sharedTournament}
            isSharedTournamentReady={isSharedTournamentReady}
            onUpdateTournament={updateSharedTournament}
            onSavePreset={(preset) => setPresets((prev) => [preset, ...prev])}
            onDeletePreset={(id) => setPresets((prev) => prev.filter((p) => p.id !== id))}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 4: JOGADORES & PERFIS                                */}
        {/* ========================================================= */}
        {activeTab === 'voting' && (
          <VotingSection
            users={users}
            currentUser={currentUser}
            recentVotes={recentVotes}
            activeSeasonNumber={activeSeason.number}
            activeSeasonStatus={activeSeason.status}
            canVoteInSeason={canCurrentUserVoteInSeason}
            voteDisabledReason={voteDisabledReason}
            canViewRecentActivity={canAccessCreatorPanel}
            attendeeIds={checkedInRosterIds}
            canManageAttendance={Boolean(canAccessCreatorPanel && activeSeason.status !== 'active' && !sharedTournament.tournamentStarted && isSharedTournamentReady && (sharedTournament.attendanceSeason === undefined || sharedTournament.attendanceSeason === activeSeason.number))}
            canManagePlayers={canAccessCreatorPanel}
            canResetRatings={canAccessCreatorPanel}
            onToggleAttendance={handleToggleTournamentAttendance}
            onResetPlayerRating={(userId) => handleResetSeasonRatings(userId)}
            onResetSeasonRatings={() => handleResetSeasonRatings()}
            onAddPlayer={handleAddCommunityPlayer}
            onOpenProfile={setProfileModalTarget}
            onRequestLogin={() => setIsLoginModalOpen(true)}
            onCastVote={handleCastVote}
          />
        )}

        {activeTab === 'statistics' && (
          <StatisticsSection
            users={users}
            cards={cardsWithAverage}
            votes={recentVotes}
            matchRecords={matchRecords}
            activeSeason={activeSeason}
            seasonArchives={seasonArchives}
            onOpenProfile={setProfileModalTarget}
            canImportOcr={canAccessCreatorPanel}
            onOpenOcr={() => {
              if (canAccessCreatorPanel) setIsOcrModalOpen(true);
            }}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 5: REGRAS (Regulamento Oficial Personas)              */}
        {/* ========================================================= */}
        {activeTab === 'rules' && <RulesSection />}

        {/* ========================================================= */}
        {/* TAB 6: PAINEL DO CRIADOR (Gerenciar Jogadores)            */}
        {/* ========================================================= */}
        {activeTab === 'creator' && canAccessCreatorPanel && (
          <CreatorPanel
            users={creatorPanelUsers}
            votes={recentVotes}
            captainIds={sharedTournament.captainIds}
            attendeeIds={checkedInRosterIds}
            tournamentStarted={sharedTournament.tournamentStarted}
            canManageAttendance={Boolean(activeSeason.status !== 'active' && !sharedTournament.tournamentStarted && isSharedTournamentReady && (sharedTournament.attendanceSeason === undefined || sharedTournament.attendanceSeason === activeSeason.number))}
            onToggleAttendance={handleToggleTournamentAttendance}
            onSetTeamCaptain={handleSetTeamCaptain}
            cards={cardsWithAverage}
            deck={deck}
            reports={reports}
            currentCreatorUser={creatorUser}
            onImpersonateUser={handleImpersonateUser}
            onOpenProfile={setProfileModalTarget}
            onUpdateUser={handleUpdateUser}
            onDeleteAccount={handleDeleteAccount}
            onUpdateDeck={setDeck}
            onUpdateCards={setCards}
            onResolveReport={handleResolveReport}
            onOpenOcrModal={() => {
              if (canAccessCreatorPanel) setIsOcrModalOpen(true);
            }}
            onTestRole={handleTestRole}
            currentSeason={activeSeason.number}
            ornamentSettingsByTier={tierOrnamentSettings}
            onUpdateTierOrnamentSettings={handleUpdateTierOrnamentSettings}
            onResetAllSeasons={handleResetAllSeasons}
          />
        )}
      </main>

      {/* OCR Screenshot Parser Modal */}
      <OcrParserModal
        isOpen={isOcrModalOpen && canAccessCreatorPanel}
        onClose={() => setIsOcrModalOpen(false)}
        users={users}
        onApplyMatchStats={handleApplyOcrMatchStats}
      />

      {/* Profile Modal */}
      {profileModalTarget && (
        <ProfileModal
          key={profileModalTarget.id}
          isOpen={true}
          onClose={() => setProfileModalTarget(null)}
          user={users.find((user) => user.id === profileModalTarget.id) || profileModalTarget}
          votes={recentVotes}
          activeSeasonNumber={activeSeason.number}
          canRateInSeason={Boolean(canCurrentUserVoteInSeason && (currentUser?.id !== profileModalTarget.id || currentUser?.role === 'criador'))}
          voteDisabledReason={voteDisabledReason}
          hasRatedInSeason={Boolean(currentUser && recentVotes.some((vote) => (vote.fromUserId === currentUser.id || Boolean(currentUser.authId && vote.fromAuthUserId === currentUser.authId)) && vote.targetUserId === profileModalTarget.id && vote.season === activeSeason.number))}
          ornamentSettingsByTier={tierOrnamentSettings}
          allCards={cardsWithAverage.map((card) => {
            const cardUser = users.find((user) => user.id === card.userId);
            return cardUser ? {
              ...card,
              userName: cardUser.name,
              userHandle: cardUser.handle,
              userAvatar: cardUser.avatar,
              stats: card.season === activeSeason.number ? cardUser.stats : card.stats,
              lane: cardUser.primaryLane,
            } : card;
          })}
          seasonArchives={seasonArchives}
          archivedCommentsBySeason={Object.fromEntries(Object.entries(seasonCommentArchive).map(([season, commentsByUser]) => [Number(season), commentsByUser[profileModalTarget.id] || []]))}
          currentUser={currentUser}
          matchRecords={matchRecords}
          canManageMatchStats={Boolean(canAccessCreatorPanel && currentUser?.role === 'criador' && !isImpersonating)}
          onAddManualMatchStats={handleAddManualMatchStats}
          canImpersonateUser={canAccessCreatorPanel}
          canResetRatings={canAccessCreatorPanel}
          onImpersonateUser={handleImpersonateUser}
          onResetRating={(userId) => handleResetSeasonRatings(userId)}
          onUpdateProfile={handleSaveProfile}
          onOpenReportModal={(target) => {
            setProfileModalTarget(null);
            setReportModalTarget(target);
          }}
          isOwnProfile={currentUser?.id === profileModalTarget.id}
          canDeleteComments={currentUser?.role === 'criador' && !isImpersonating}
          onCastVote={handleCastVote}
          onAddComment={handleAddProfileComment}
          onDeleteComment={handleDeleteProfileComment}
        />
      )}

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        users={users}
        onLoginSuccess={(u) => {
          try {
            window.localStorage.removeItem('personas_logged_out_v1');
          } catch {
            // Signing in remains available when session storage is unavailable.
          }
          setCurrentUser(u);
          setIsCreatorSession(u.role === 'criador');
          setIsImpersonating(false);
        }}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={!!reportModalTarget}
        onClose={() => setReportModalTarget(null)}
        currentUser={currentUser}
        users={users}
        preselectedUser={reportModalTarget}
        onSubmitReport={handleSubmitReport}
      />

      {seasonEvent && <SeasonCelebration key={seasonEvent.id} kind={seasonEvent.kind} season={seasonEvent.season} automatic={seasonEvent.automatic} />}

      {/* Clean Footer */}
      <footer className="app-footer mt-16 border-t border-red-950/40 bg-black/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>👑 Personas © {new Date().getFullYear()}</span>
            <span>·</span>
            <span>Regulamento Oficial Personas</span>
            <span>·</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>Criador: {displayLogin(creatorUser.handle)}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
