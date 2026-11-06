export type UserRole = 'criador' | 'moderador' | 'capitao' | 'jogador' | 'visitante';

export type EloTier = 
  | 'lenda'
  | 'challenger' 
  | 'grao_mestre' 
  | 'mestre' 
  | 'diamante' 
  | 'esmeralda' 
  | 'platina' 
  | 'ouro' 
  | 'prata' 
  | 'bronze' 
  | 'ferro' 
  | 'madeira' 
  | 'criminoso'
  | 'mencao_honrosa';

export type Lane = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPORTE' | 'PREENCHER';

export interface CardOrnamentSettings {
  /** Whether cards of this tier render the ornamental frame. */
  showFrame: boolean;
  /** Global frame scale as a multiplier (1 = current base size). */
  scale: number;
  /** Extra vertical scale for extending the frame below the card. */
  heightScale: number;
  /** Independent height multiplier for only the upper ornament section. */
  topScale: number;
  /** Horizontal frame offset as a percentage of the frame bounds. */
  offsetX: number;
  /** Vertical frame offset as a percentage of the frame bounds. */
  offsetY: number;
  /** Whether the frame artwork sits above or behind the card face. */
  layer: 'front' | 'back';
}

export type MatchSeriesFormat = 'MD1' | 'MD3' | 'MD5';
export type TeamDraftMode = 'random' | 'predefined' | 'balanced' | 'captain-draft';
export type TeamDraftStage = 'setup' | 'in_progress' | 'complete';

export interface UserStats {
  kills: number;
  deaths: number;
  assists: number;
  wards: number;
  damageDealt: number;
  damageReceived: number;
}

export interface PlayerComment {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  text: string;
  scoreGiven?: number;
  createdAt: string;
}

export interface User {
  id: string;
  handle: string; // @handle unico
  name: string;
  email?: string; // identificador de login privado e único quando informado
  role: UserRole;
  isOnline: boolean;
  avatar: string;
  bio: string;
  favoriteChampion: string;
  primaryLane: Lane;
  /** Campo legado mantido para compatibilidade com perfis já salvos; não é mais exibido. */
  secondaryLane?: Lane;
  riotId: string;
  currentScore: number; // Média geral (0 - 100)
  totalVotes: number;
  seasonsPlayed: number;
  mvpCount: number;
  aceCount: number;
  isCriminoso?: boolean;
  isMencaoHonrosa?: boolean;
  isLegend?: boolean;
  stats: UserStats;
  entryDate: string; // Data de entrada que a pessoa se cadastrou
  createdAt: string;
  comments: PlayerComment[];
}

export interface CardItem {
  id: string;
  userId: string;
  userName: string;
  userHandle: string;
  userAvatar: string;
  season: number;
  score: number;
  tier: EloTier;
  lane: Lane;
  favoriteChampion: string;
  ornamentSettings?: CardOrnamentSettings;
  isMvp: boolean;
  isAce: boolean;
  isCriminoso: boolean;
  isLegend: boolean;
  isMencaoHonrosa?: boolean;
  stats: UserStats;
  date: string;
}

export interface ActiveSeason {
  number: number;
  status: 'ready' | 'active';
  startedAt: string | null;
  endsAt: string | null;
}

export interface SeasonPlayerSnapshot {
  userId: string;
  name: string;
  average: number | null;
  totalVotes: number;
  tier: EloTier | null;
}

export interface SeasonArchive {
  number: number;
  startedAt: string | null;
  endedAt: string;
  automatic: boolean;
  cardCount: number;
  criminalUserId?: string | null;
  playerSnapshots: SeasonPlayerSnapshot[];
}

export interface Team {
  id: string;
  name: string;
  tag: string;
  captainId: string;
  captainName: string;
  description: string;
  logo: string;
  members: string[]; // user IDs
  seriesFormat?: MatchSeriesFormat;
  side?: 'azul' | 'vermelho';
  stats: {
    matches: number;
    wins: number;
    losses: number;
  };
}

/** Shared tournament controls so every account sees the same attendance and live draft. */
export interface SharedTournamentState {
  updatedAt: number;
  tournamentStarted: boolean;
  attendeeIds: string[];
  captainIds: [string, string];
  draftMode: TeamDraftMode;
  seriesFormat: MatchSeriesFormat;
  predefinedTeams: Team[] | null;
  captainDraftTurn: number | null;
  playerPoolIds: string[];
  draftStage: TeamDraftStage;
  teams: Team[];
}

export interface MatchDeckCard {
  id: string;
  title: string;
  rule: string;
  description: string;
  iconName: string;
  tags: string[];
  backgroundImage?: string;
}

export interface VoteRecord {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserHandle: string;
  targetUserId: string;
  targetUserName: string;
  score: number;
  comment?: string;
  season: number;
  matchId?: string;
  createdAt: string;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  reporterHandle: string;
  targetUserId: string;
  targetUserHandle: string;
  targetUserName: string;
  reason: string;
  details: string;
  status: 'pendente' | 'resolvido' | 'descartado';
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'vote' | 'team' | 'captain_request' | 'report' | 'system' | 'card';
  read: boolean;
  createdAt: string;
  actionPayload?: {
    requestId?: string;
    fromCaptainName?: string;
    cardId?: string;
    teamId?: string;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderHandle: string;
  senderAvatar: string;
  senderRole: UserRole;
  text: string;
  timestamp: string;
  channel: 'global' | 'draft' | 'creator_direct';
}

export interface DraftPreset {
  id: string;
  name: string;
  captainIds: string[];
  poolPlayerIds: string[];
  teams?: Team[];
  createdAt: string;
}
