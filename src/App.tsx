import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  User, 
  CardItem, 
  MatchDeckCard, 
  Team, 
  DraftPreset, 
  ReportItem, 
  NotificationItem, 
  ChatMessage, 
  VoteRecord,
  EloTier,
  UserRole,
  ActiveSeason,
  SeasonArchive,
  CardOrnamentSettings,
  SharedTournamentState,
  Lane,
} from './types';
import { 
  INITIAL_USERS, 
  INITIAL_MATCH_DECK, 
  INITIAL_PRESETS,
  getTierFromScore 
} from './data/initialData';
import { Navbar } from './components/Navbar';
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
import { FloatingChat } from './components/FloatingChat';
import { StatisticsSection } from './components/StatisticsSection';
import { SeasonControlBanner } from './components/SeasonControlBanner';
import { SeasonCelebration } from './components/SeasonCelebration';
import mascotAvatar from './assets/images/personas_duck_mascot_1793729518059.jpg';
import { readStorage, writeStorage } from './utils/storage';
import { CARD_ORNAMENT_SETTINGS_VERSION, CARD_ORNAMENT_SETTINGS_VERSION_KEY, CARD_ORNAMENT_STORAGE_KEY, loadCardOrnamentSettings, loadTierCardOrnamentSettings, migrateCardOrnamentSettings, TIER_CARD_ORNAMENT_STORAGE_KEY } from './utils/cardOrnament';
import { normalizeStats } from './utils/stats';
import { normalizeEmail, normalizeHandle, normalizeRiotId, validateUniqueUserIdentity } from './utils/userIdentity';
import { supabase, getSupabaseAuthorizationHeaders, loadAuthenticatedProfile, loadRegisteredProfiles, mergeRegisteredProfiles, saveAuthenticatedProfile } from './lib/supabase';
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
    if (a.user.stats.damageDealt !== b.user.stats.damageDealt) return a.user.stats.damageDealt - b.user.stats.damageDealt;
    if (a.user.stats.wards !== b.user.stats.wards) return a.user.stats.wards - b.user.stats.wards;
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
      <span className="mt-1 font-mono text-xs text-slate-400">{user.handle}</span>
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

const normalizeSharedTournament = (value?: Partial<SharedTournamentState> | null): SharedTournamentState => {
  const attendeeIds = [...new Set(Array.isArray(value?.attendeeIds) ? value.attendeeIds : [])];
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

  return {
    updatedAt: value?.updatedAt || 0,
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
  const usedEmails = new Set<string>();
  const usedRiotIds = new Set<string>();
  const reservedCreatorLogins = new Set(['nicolas', 'nicolaslike']);
  return users.map((user) => {
    const normalized = { ...user } as User & { password?: string };
    // Remove any plaintext passwords left by older local demo builds.
    delete normalized.password;
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

    let email = normalizeEmail(user.email);
    if (email && usedEmails.has(email)) email = '';
    if (email) usedEmails.add(email);

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
      primaryLane: knownLanes.includes(user.primaryLane) ? user.primaryLane : 'PREENCHER',
      // Criminal status belongs to a completed season card, never to a live player profile.
      isCriminoso: false,
      handle: uniqueHandle,
      email: email || undefined,
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

const mergeImportedDeckCards = (savedDeck: MatchDeckCard[]): MatchDeckCard[] => {
  const existingIds = new Set(savedDeck.map((card) => card.id));
  const importedCards = INITIAL_MATCH_DECK.filter((card) => card.id.startsWith('cblow_') && !existingIds.has(card.id));
  return [...savedDeck, ...importedCards];
};

const loadDeck = (): MatchDeckCard[] => {
  const savedDeck = readStorage<MatchDeckCard[]>('personas_deck_v2', INITIAL_MATCH_DECK);
  return readStorage<boolean>('personas_cblow_cards_v1', false) ? savedDeck : mergeImportedDeckCards(savedDeck);
};

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const savedTheme = readStorage<'dark' | 'light'>('personas_theme_v1', 'dark');
    return savedTheme === 'light' ? 'light' : 'dark';
  });
  const [cardOrnamentSettings, setCardOrnamentSettings] = useState<CardOrnamentSettings>(loadCardOrnamentSettings);
  const [tierOrnamentSettings, setTierOrnamentSettings] = useState(() =>
    loadTierCardOrnamentSettings(INITIAL_APP_CARDS, loadCardOrnamentSettings())
  );

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
  const [seasonEvent, setSeasonEvent] = useState<{ kind: 'start' | 'finish'; season: number; automatic?: boolean; id: number } | null>(null);
  const [seasonArchives, setSeasonArchives] = useState<SeasonArchive[]>(() =>
    readStorage('personas_season_archives_v1', [])
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

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_1',
      senderId: 'user_derick',
      senderName: 'Derick (Lenda Viva)',
      senderHandle: '@derick',
      senderAvatar: users.find((u) => u.id === 'user_derick')?.avatar || '',
      senderRole: 'capitao',
      text: 'Fala galera! Hoje tem draft com Agentes Livres e sorteio no Personas.',
      timestamp: '20:15',
      channel: 'global',
    },
    {
      id: 'msg_2',
      senderId: 'user_nick',
      senderName: 'Nick Presidiário',
      senderHandle: '@nick',
      senderAvatar: users.find((u) => u.id === 'user_nick')?.avatar || '',
      senderRole: 'jogador',
      text: 'O Elo Criminoso continua meu kkkk na cela da Season 1!',
      timestamp: '20:18',
      channel: 'global',
    }
  ]);

  const [recentVotes, setRecentVotes] = useState<VoteRecord[]>(() =>
    readStorage('personas_votes_v1', [])
  );
  const cardsWithAverage = useMemo(() => {
    const usersWithVotes = new Set(recentVotes.map((vote) => vote.targetUserId));
    return reconcileSeasonCriminalCards(cards, seasonArchives).filter((card) => usersWithVotes.has(card.userId));
  }, [cards, recentVotes, seasonArchives]);

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
  const startsAsLocalCreator = isLocalPreview && !hasLoggedOutOfLocalPreview;
  const [currentUser, setCurrentUser] = useState<User | null>(() => startsAsLocalCreator ? creatorUser : null);
  const [isCreatorSession, setIsCreatorSession] = useState(startsAsLocalCreator);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false);
  const canAccessCreatorPanel = currentUser?.id === creatorUser.id && !isImpersonating;
  // Role preview and account impersonation change the displayed user, not the signed-in session.
  const presenceActorId = isCreatorSession ? creatorUser.id : currentUser?.id || null;
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
  const creatorPanelUsers = useMemo(() => users.map((user) => ({
    ...user,
    isOnline: onlineUserIds.includes(user.id),
  })), [users, onlineUserIds]);

  useEffect(() => {
    if (!presenceActorId) {
      setOnlineUserIds([]);
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
        const result = await response.json() as { userIds?: unknown };
        if (!isCancelled) {
          setOnlineUserIds(Array.isArray(result.userIds)
            ? result.userIds.filter((id): id is string => typeof id === 'string')
            : [presenceActorId]);
        }
      } catch {
        // Keep the current browser session accurate if the API is temporarily unavailable.
        if (!isCancelled) setOnlineUserIds([presenceActorId]);
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
  const [cardSeasonFilter, setCardSeasonFilter] = useState<string>('all');
  const [cardLaneFilter, setCardLaneFilter] = useState<string>('all');
  const [cardAwardFilter, setCardAwardFilter] = useState<string>('all');
  const [cardSearchQuery, setCardSearchQuery] = useState<string>('');

  // Persist data
  useEffect(() => {
    writeStorage('personas_users_v2', users);
  }, [users]);

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
    writeStorage('personas_deck_v2', deck);
  }, [deck]);

  useEffect(() => {
    writeStorage('personas_notifications_v1', notifications);
  }, [notifications]);

  useEffect(() => {
    writeStorage('personas_cblow_cards_v1', true);
  }, []);

  useEffect(() => {
    writeStorage(SHARED_TOURNAMENT_STORAGE_KEY, sharedTournament);
    writeStorage('personas_teams_v2', sharedTournament.teams);
  }, [sharedTournament]);

  useEffect(() => {
    writeStorage('personas_presets_v2', presets);
  }, [presets]);

  useEffect(() => {
    writeStorage('personas_reports_v2', reports);
  }, [reports]);

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
    let isDisposed = false;
    void getSupabaseAuthorizationHeaders().then((authorization) => fetch('/api/tournament-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authorization },
      body: JSON.stringify({
        state: sharedTournament,
        actorId: currentUser.id,
        actorRole: canAccessCreatorPanel ? 'criador' : 'viewer',
      }),
    })).then(async (response) => {
      if (!response.ok || isDisposed) return;
      const payload = await response.json();
      if (payload.state) {
        const normalizedState = normalizeSharedTournament(payload.state as Partial<SharedTournamentState>);
        setSharedTournament((previous) => JSON.stringify(normalizedState) !== JSON.stringify(previous)
          ? normalizedState
          : previous);
      }
    }).catch(() => {
      // The next polling cycle will pick up shared changes when the connection returns.
    });
    return () => { isDisposed = true; };
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
          setRecentVotes(value);
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

  const handleToggleTournamentAttendance = (targetUserId?: string) => {
    if (!currentUser) {
      if (!targetUserId) setIsLoginModalOpen(true);
      return;
    }
    if ((targetUserId && !canAccessCreatorPanel) || activeSeason.status === 'active' || sharedTournament.tournamentStarted || !isSharedTournamentReady) return;
    const attendeeId = targetUserId || currentUser.id;
    updateSharedTournament((previous) => ({
      attendeeIds: previous.attendeeIds.includes(attendeeId)
        ? previous.attendeeIds.filter((id) => id !== attendeeId)
        : [...previous.attendeeIds, attendeeId],
      captainIds: previous.captainIds.map((id) => previous.attendeeIds.includes(attendeeId) && id === attendeeId ? '' : id) as [string, string],
    }));
  };

  const handleStartSeason = () => {
    if (activeSeason.status === 'active' || currentUser?.role !== 'criador' || isImpersonating) return;
    const startedAt = new Date();
    const seasonNumber = activeSeason.number;
    const seasonUsers = users.map((user) => ({ ...user, isCriminoso: false }));
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
        return { ...card, score, isCriminoso: false, tier: getSeasonCardTier(score, false, seasonNumber) };
      }),
    ]));
    setUsers(seasonUsers.map((user) => ({
      ...user,
      currentScore: voteTotals.has(user.id)
        ? Math.round(voteTotals.get(user.id)!.sum / voteTotals.get(user.id)!.count)
        : 0,
      totalVotes: recentVotes.filter((vote) => vote.targetUserId === user.id).length,
    })));
    setActiveSeason({
      number: activeSeason.number,
      status: 'active',
      startedAt: startedAt.toISOString(),
      endsAt: new Date(startedAt.getTime() + 7 * 60 * 60 * 1000).toISOString(),
    });
    setSeasonEvent({ kind: 'start', season: seasonNumber, id: Date.now() });
  };

  const handleFinalizeSeason = useCallback((automatic = false) => {
    if (activeSeason.status !== 'active' || (currentUser?.role !== 'criador' && !automatic) || (isImpersonating && !automatic)) return;
    const alreadyArchived = seasonArchives.some((archive) => archive.number === activeSeason.number);
    if (alreadyArchived) return;

    const criminalId = selectSeasonCriminalId(users, recentVotes, activeSeason.number, sharedTournament.attendeeIds);

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

    setSeasonArchives((previous) => [archive, ...previous.filter((item) => item.number !== archive.number)]);
    setUsers((previous) => previous.map((user) => ({
      ...user,
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
    setActiveSeason({
      number: activeSeason.number + 1,
      status: 'ready',
      startedAt: null,
      endsAt: null,
    });
  }, [activeSeason, cardsWithAverage, currentUser?.role, isImpersonating, recentVotes, seasonArchives, sharedTournament.attendeeIds, users]);

  const handleResetSeasonRatings = (targetUserId?: string) => {
    if (!canAccessCreatorPanel) return;

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
    setProfileModalTarget(null);
    setReportModalTarget(null);
    setActiveTab('cards');
  };

  // Role testing simulator (Testar como é os cargos)
  const handleTestRole = (role: UserRole) => {
    if (!isCreatorSession) return;
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
    setActiveTab('cards');
  };

  const handleStopImpersonating = () => {
    setCurrentUser(creatorUser);
    setIsCreatorSession(true);
    setIsImpersonating(false);
  };

  const handleUpdateUser = (updated: User): string | null => {
    const normalized = {
      ...updated,
      handle: normalizeHandle(updated.handle),
      email: normalizeEmail(updated.email) || undefined,
      riotId: updated.riotId.trim(),
      stats: normalizeStats(updated.stats),
    };
    const identityError = validateUniqueUserIdentity(users, normalized, creatorUser.id);
    if (identityError) return identityError;

    setUsers((previous) => previous.map((user) => user.id === normalized.id ? normalized : user));
    setCards((previous) => previous.map((card) => {
      if (card.userId !== normalized.id) return card;
      const isCurrentSeason = card.season === activeSeason.number;
      return {
        ...card,
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
    setTeams((previous) => previous.map((team) => team.captainId === normalized.id ? { ...team, captainName: normalized.name } : team));
    setCurrentUser((previous) => previous?.id === normalized.id ? normalized : previous);
    setProfileModalTarget((previous) => previous?.id === normalized.id ? normalized : previous);
    if (!isImpersonating && currentUser?.id === normalized.id) {
      void saveAuthenticatedProfile(normalized).catch((error) => console.error('Não foi possível sincronizar o perfil compartilhado.', error));
    }
    return null;
  };

  const handleAddCommunityPlayer = (player: { name: string; handle: string; email?: string; riotId: string; primaryLane: Lane }): string | null => {
    if (!canAccessCreatorPanel) return 'Somente o criador pode adicionar jogadores.';

    const handle = normalizeHandle(player.handle);
    if (!player.name.trim()) return 'Informe o nome do jogador.';

    const handleSlug = handle.slice(1).toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'jogador';
    const riotId = player.riotId.trim() || `${handle.slice(1)}#BR1`;
    const newUser: User = {
      id: `user_${handleSlug}_${Date.now()}`,
      handle,
      name: player.name.trim(),
      email: normalizeEmail(player.email) || undefined,
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
      stats: { kills: 0, deaths: 0, assists: 0, wards: 0, damageDealt: 0, damageReceived: 0 },
      entryDate: new Date().toLocaleDateString('pt-BR'),
      createdAt: new Date().toISOString(),
      comments: [],
    };

    const identityError = validateUniqueUserIdentity(users, newUser, creatorUser.id);
    if (identityError) return identityError;

    setUsers((previous) => previous.some((user) =>
      normalizeHandle(user.handle) === handle ||
      (newUser.email && normalizeEmail(user.email) === newUser.email) ||
      (newUser.riotId && normalizeRiotId(user.riotId) === normalizeRiotId(newUser.riotId))
    )
      ? previous
      : [...previous, newUser]);
    return null;
  };

  // OCR Statistics Distribution
  const handleApplyOcrScores = (data: {
    players: { userId: string; score: number; nick: string }[];
    seasonAverage: number;
    mvpUserId?: string;
    notes?: string;
  }) => {
    const updatedUsers = users.map((u) => {
      const importedScores = data.players
        .filter((player) => player.userId === u.id)
        .map((player) => Math.max(0, Math.min(100, Math.round(player.score))));
      if (importedScores.length) {
        const previousSeasonVotes = recentVotes.filter((vote) => vote.targetUserId === u.id && vote.season === activeSeason.number);
        const scoreTotal = previousSeasonVotes.reduce((sum, vote) => sum + vote.score, 0)
          + importedScores.reduce((sum, score) => sum + score, 0);
        return {
          ...u,
          currentScore: Math.round(scoreTotal / (previousSeasonVotes.length + importedScores.length)),
          totalVotes: recentVotes.filter((vote) => vote.targetUserId === u.id).length + importedScores.length,
        };
      }
      return u;
    });

    const previousMvpUserIds = new Set(cards
      .filter((card) => card.season === activeSeason.number && card.isMvp)
      .map((card) => card.userId));
    setUsers(updatedUsers);

    // Create cards
    const newCards: CardItem[] = data.players.map((player) => {
      const user = updatedUsers.find((candidate) => candidate.id === player.userId)!;
      return createPlayerCard(
        user,
        activeSeason.number,
        user.currentScore,
        user.id === data.mvpUserId || previousMvpUserIds.has(user.id),
      );
    });

    setCards((previous) => {
      const importedPlayerIds = new Set(data.players.map((player) => player.userId));
      const synchronized = previous
        .filter((card) => !(card.season === activeSeason.number && importedPlayerIds.has(card.userId)))
        .map((card) => {
          if (card.season !== activeSeason.number) return card;
          const updatedUser = updatedUsers.find((user) => user.id === card.userId);
          if (!updatedUser) return card;
          return {
            ...card,
            userName: updatedUser.name,
            userHandle: updatedUser.handle,
            userAvatar: updatedUser.avatar,
            score: updatedUser.currentScore,
            tier: getSeasonCardTier(updatedUser.currentScore, Boolean(updatedUser.isCriminoso), activeSeason.number),
            isCriminoso: Boolean(updatedUser.isCriminoso),
            isMvp: card.isMvp || updatedUser.id === data.mvpUserId,
          };
        });
      return [...newCards, ...synchronized];
    });

    const importedAt = new Date().toISOString();
    const importedVotes: VoteRecord[] = data.players.map((player, index) => {
      const target = updatedUsers.find((user) => user.id === player.userId)!;
      return {
        id: `vote_ocr_${Date.now()}_${index}_${player.userId}`,
        fromUserId: 'personas_ocr',
        fromUserName: 'Importação OCR',
        fromUserHandle: '@personas',
        targetUserId: target.id,
        targetUserName: target.name,
        score: Math.max(0, Math.min(100, Math.round(player.score))),
        season: activeSeason.number,
        createdAt: importedAt,
      };
    });
    setRecentVotes((previous) => [...previous, ...importedVotes]);

    setNotifications((prev) => [
      ...data.players.map((p) => ({
        id: `notif_${Date.now()}_${p.userId}`,
        userId: p.userId,
        title: 'Estatísticas Atualizadas via OCR',
        message: `Sua nota oficial foi computada: ${p.score}. Média recalculada!`,
        type: 'card' as const,
        read: false,
        createdAt: 'Agora',
      })),
      ...prev,
    ]);
  };

  // Notes update the player's average, active-season card, and profile comments.
  const handleCastVote = (voteData: {
    targetUserId: string;
    score: number;
    comment?: string;
  }) => {
    if (!currentUser || currentUser.id === voteData.targetUserId) return;

    const target = users.find((u) => u.id === voteData.targetUserId);
    if (!target) return;

    const score = Math.max(0, Math.min(100, Math.round(voteData.score)));
    const voteRecord: VoteRecord = {
      id: `vote_${Date.now()}`,
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
    const targetSeasonVotes = recentVotes.filter((vote) => vote.targetUserId === target.id && vote.season === activeSeason.number);
    const newAverage = Math.round((targetSeasonVotes.reduce((sum, vote) => sum + vote.score, 0) + score) / (targetSeasonVotes.length + 1));

    // Add player comment if provided
    const commentText = voteData.comment?.trim();
    const newComment = commentText
      ? {
          id: `comm_${Date.now()}`,
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

    setNotifications((prev) => [
      {
        id: `notif_${Date.now()}`,
        userId: target.id,
        title: 'Nova avaliação no seu perfil',
        message: `${currentUser.name} publicou a nota ${score}.`,
        type: 'vote',
        read: false,
        createdAt: 'Agora',
      },
      ...prev,
    ]);
  };

  const handleAddProfileComment = (targetUserId: string, text: string) => {
    if (!currentUser || currentUser.id === targetUserId || !text.trim()) return;
    const comment = {
      id: `comm_${Date.now()}`,
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

    setNotifications((prev) => [
      {
        id: `notif_rep_${Date.now()}`,
        userId: creatorUser.id,
        title: '⚠️ Nova Denúncia Recebida!',
        message: `${currentUser.name} denunciou ${target.name} por "${reportData.reason}".`,
        type: 'report',
        read: false,
        createdAt: 'Agora',
      },
      ...prev,
    ]);
  };

  const handleResolveReport = (reportId: string, status: 'resolvido' | 'descartado') => {
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
  };

  // Chat message
  const handleSendMessage = (text: string) => {
    if (!currentUser) return;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderHandle: currentUser.handle,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      channel: 'global',
    };

    setChatMessages((prev) => [...prev, newMsg]);

    if (currentUser.id !== creatorUser.id) {
      setNotifications((prev) => [
        {
          id: `notif_chat_${Date.now()}`,
          userId: creatorUser.id,
          title: `Nova mensagem de ${currentUser.name}`,
          message: text.length > 50 ? text.substring(0, 50) + '...' : text,
          type: 'system',
          read: false,
          createdAt: 'Agora',
        },
        ...prev,
      ]);
    }
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

      if (cardSeasonFilter !== 'all' && card.season !== Number(cardSeasonFilter)) return false;
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

  const usersWithRankedCards = new Set(cardsWithAverage.map((card) => card.userId));
  const checkedInUsersWithoutRankedCards = users
    .filter((user) => sharedTournament.attendeeIds.includes(user.id))
    .filter((user) => !usersWithRankedCards.has(user.id));
  const usersWithoutRankedCards = checkedInUsersWithoutRankedCards
    .filter(() => cardTierFilter === 'all' && cardAwardFilter === 'all')
    .filter(() => cardSeasonFilter === 'all' || Number(cardSeasonFilter) === activeSeason.number)
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
        notifications={notifications}
        onMarkNotificationRead={(id) =>
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n))
          )
        }
        onDeleteNotification={(id) => setNotifications((prev) => prev.filter((n) => n.id !== id))}
        onMarkAllNotificationsRead={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onTestRole={handleTestRole}
        canTestRoles={isCreatorSession}
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
              isCheckedIn={Boolean(currentUser && sharedTournament.attendeeIds.includes(currentUser.id))}
              checkInCount={sharedTournament.attendeeIds.length}
              checkInDisabled={!isSharedTournamentReady}
              onCheckIn={handleToggleTournamentAttendance}
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
                <select id="card-season-filter" value={cardSeasonFilter} onChange={(event) => setCardSeasonFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none">
                  <option value="all">Todas as temporadas</option>
                  {[...new Set(cardsWithAverage.map((card) => card.season))].sort((a, b) => b - a).map((season) => <option key={season} value={season}>Temporada {season}</option>)}
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
                      stats: targetUser.stats,
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
            isCaptain={Boolean(currentUser && (currentUser.role === 'capitao' || sharedTournament.captainIds.includes(currentUser.id)))}
            canEditCards={canAccessCreatorPanel}
            onUpdateDeck={setDeck}
            onConfirmCard={(card) => {
              setNotifications((prev) => [
                {
                  id: `notif_card_${Date.now()}`,
                  userId: creatorUser.id,
                  title: 'Carta Confirmada para a Partida',
                  message: `A regra "${card.title}" está valendo no Rift!`,
                  type: 'card',
                  read: false,
                  createdAt: 'Agora',
                },
                ...prev,
              ]);
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
            attendeeIds={sharedTournament.attendeeIds}
            canManageAttendance={Boolean(canAccessCreatorPanel && activeSeason.status !== 'active' && !sharedTournament.tournamentStarted && isSharedTournamentReady)}
            canManagePlayers={canAccessCreatorPanel}
            canResetRatings={canAccessCreatorPanel}
            onToggleAttendance={handleToggleTournamentAttendance}
            onResetPlayerRating={(userId) => handleResetSeasonRatings(userId)}
            onResetSeasonRatings={() => handleResetSeasonRatings()}
            onAddPlayer={handleAddCommunityPlayer}
            onOpenProfile={setProfileModalTarget}
          />
        )}

        {activeTab === 'statistics' && (
          <StatisticsSection
            users={users}
            cards={cardsWithAverage}
            votes={recentVotes}
            activeSeason={activeSeason}
            seasonArchives={seasonArchives}
            onOpenProfile={setProfileModalTarget}
            onOpenOcr={() => setIsOcrModalOpen(true)}
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
            attendeeIds={sharedTournament.attendeeIds}
            tournamentStarted={sharedTournament.tournamentStarted}
            onSetTeamCaptain={handleSetTeamCaptain}
            cards={cardsWithAverage}
            deck={deck}
            reports={reports}
            messages={chatMessages}
            currentCreatorUser={creatorUser}
            onImpersonateUser={handleImpersonateUser}
            onOpenProfile={setProfileModalTarget}
            onUpdateUser={handleUpdateUser}
            onUpdateDeck={setDeck}
            onUpdateCards={setCards}
            onResolveReport={handleResolveReport}
            onOpenOcrModal={() => setIsOcrModalOpen(true)}
            onTestRole={handleTestRole}
            currentSeason={activeSeason.number}
            ornamentSettingsByTier={tierOrnamentSettings}
            onUpdateTierOrnamentSettings={(tier, settings) => setTierOrnamentSettings((previous) => ({ ...previous, [tier]: settings }))}
          />
        )}
      </main>

      {/* Floating Live Chat with Crowned Duck Mascot (Bottom Right) */}
      <FloatingChat
        currentUser={currentUser}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        unreadCount={0}
      />

      {/* OCR Screenshot Parser Modal */}
      <OcrParserModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        users={users}
        onApplyScores={handleApplyOcrScores}
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
          ornamentSettingsByTier={tierOrnamentSettings}
          allCards={cardsWithAverage.map((card) => {
            const cardUser = users.find((user) => user.id === card.userId);
            return cardUser ? {
              ...card,
              userName: cardUser.name,
              userHandle: cardUser.handle,
              userAvatar: cardUser.avatar,
              stats: cardUser.stats,
              lane: cardUser.primaryLane,
            } : card;
          })}
          seasonArchives={seasonArchives}
          currentUser={currentUser}
          canImpersonateUser={canAccessCreatorPanel}
          canResetRatings={canAccessCreatorPanel}
          onImpersonateUser={handleImpersonateUser}
          onResetRating={(userId) => handleResetSeasonRatings(userId)}
          onUpdateProfile={(updatedPartial) => {
            const activeProfileUser = users.find((user) => user.id === profileModalTarget.id) || profileModalTarget;
            return handleUpdateUser({ ...activeProfileUser, ...updatedPartial });
          }}
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
            <span>Criador: @{creatorUser.handle.replace(/^@+/, '')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
