import { createClient, type User as AuthUser } from '@supabase/supabase-js';
import type { ActiveSeason, CardOrnamentSettings, EloTier, Lane, MatchRecord, MatchResult, NotificationItem, User, UserRole, UserStats, VoteRecord } from '../types';
import { INITIAL_USERS } from '../data/initialData';
import mascotAvatar from '../assets/images/personas_duck_mascot_1793729518059.jpg';
import { normalizeHandle, normalizeRiotId } from '../utils/userIdentity';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const isSharedAccountsEnabled = Boolean(supabase);

let cardOrnamentSettingsWriteQueue: Promise<unknown> = Promise.resolve();

const VOTE_FIELDS = 'id,season,voter_auth_user_id,from_user_id,from_user_name,from_user_handle,target_user_id,target_user_name,score,comment,created_at';

function notificationRowToItem(row: Record<string, unknown>, appUserId: string): NotificationItem {
  const createdAt = new Date(String(row.created_at));
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60_000));
  const displayTime = !Number.isFinite(createdAt.getTime()) || elapsedMinutes < 1
    ? 'Agora'
    : elapsedMinutes < 60
      ? `Há ${elapsedMinutes} min`
      : elapsedMinutes < 24 * 60
        ? `Há ${Math.floor(elapsedMinutes / 60)} h`
        : createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return {
    id: String(row.event_key),
    userId: appUserId,
    title: String(row.title),
    message: String(row.message),
    type: row.type as NotificationItem['type'],
    read: Boolean(row.read),
    createdAt: displayTime,
  };
}

export async function loadSharedNotifications(appUserId: string): Promise<NotificationItem[] | null> {
  if (!supabase) return null;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return [];
  const { data, error } = await supabase.from('user_notifications')
    .select('event_key,title,message,type,read,created_at')
    .eq('recipient_auth_user_id', authData.user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []).map((row) => notificationRowToItem(row as unknown as Record<string, unknown>, appUserId));
}

export async function saveSharedNotification(notification: NotificationItem, recipientAuthUserId: string): Promise<void> {
  if (!supabase || notification.type === 'vote') return;
  const { error } = await supabase.from('user_notifications').upsert({
    event_key: notification.id,
    recipient_auth_user_id: recipientAuthUserId,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    read: notification.read,
  }, { onConflict: 'event_key', ignoreDuplicates: true });
  if (error) throw error;
}

export async function setSharedNotificationRead(eventKey: string, read: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('user_notifications').update({ read }).eq('event_key', eventKey);
  if (error) throw error;
}

export async function deleteSharedNotification(eventKey: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('user_notifications').delete().eq('event_key', eventKey);
  if (error) throw error;
}

export async function deleteAllSharedNotifications(): Promise<void> {
  if (!supabase) return;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError || new Error('Entre na sua conta para excluir as notificações.');
  const { error } = await supabase.from('user_notifications')
    .delete()
    .eq('recipient_auth_user_id', authData.user.id);
  if (error) throw error;
}

function voteRowToRecord(row: Record<string, unknown>): VoteRecord {
  return {
    id: String(row.id),
    season: Number(row.season),
    fromAuthUserId: String(row.voter_auth_user_id),
    fromUserId: String(row.from_user_id),
    fromUserName: String(row.from_user_name),
    fromUserHandle: String(row.from_user_handle),
    targetUserId: String(row.target_user_id),
    targetUserName: String(row.target_user_name),
    score: Number(row.score),
    ...(typeof row.comment === 'string' && row.comment ? { comment: row.comment } : {}),
    createdAt: String(row.created_at),
  };
}

export async function loadSharedSeasonControl(): Promise<ActiveSeason | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('shared_season_control')
    .select('season,status,started_at,ends_at')
    .eq('singleton', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    number: Number(data.season),
    status: data.status as ActiveSeason['status'],
    startedAt: data.started_at ? String(data.started_at) : null,
    endsAt: data.ends_at ? String(data.ends_at) : null,
  };
}

export async function saveSharedSeasonControl(season: ActiveSeason): Promise<void> {
  if (!supabase) return;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError || new Error('Entre como criador para alterar a temporada.');
  const { error } = await supabase.from('shared_season_control').upsert({
    singleton: true,
    season: season.number,
    status: season.status,
    started_at: season.startedAt,
    ends_at: season.endsAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'singleton' });
  if (error) throw error;
}

export async function loadSharedSeasonVotes(): Promise<VoteRecord[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('season_player_votes')
    .select(VOTE_FIELDS)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => voteRowToRecord(row as unknown as Record<string, unknown>));
}

export async function saveSharedSeasonVote(vote: Omit<VoteRecord, 'id' | 'createdAt' | 'fromAuthUserId'>): Promise<VoteRecord | null> {
  if (!supabase) return null;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError || new Error('Entre na sua conta para avaliar.');
  const { data, error } = await supabase.from('season_player_votes').insert({
    season: vote.season,
    voter_auth_user_id: authData.user.id,
    from_user_id: authData.user.id,
    from_user_name: vote.fromUserName,
    from_user_handle: vote.fromUserHandle,
    target_user_id: vote.targetUserId,
    target_user_name: vote.targetUserName,
    score: vote.score,
    comment: vote.comment || null,
  }).select(VOTE_FIELDS).single();
  if (error) throw error;
  return voteRowToRecord(data as unknown as Record<string, unknown>);
}

export async function deleteSharedSeasonVotes(season: number, targetUserId?: string): Promise<void> {
  if (!supabase) return;
  let query = supabase.from('season_player_votes').delete().eq('season', season);
  if (targetUserId) query = query.eq('target_user_id', targetUserId);
  const { error } = await query;
  if (error) throw error;
}

export async function loadSharedCardOrnamentSettings(): Promise<Partial<Record<EloTier, Partial<CardOrnamentSettings>>> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('card_ornament_settings').select('tier,settings');
  if (error) throw error;
  return Object.fromEntries((data || []).map((row) => [row.tier as EloTier, row.settings as Partial<CardOrnamentSettings>]));
}

export function saveSharedCardOrnamentSettings(tier: EloTier, settings: CardOrnamentSettings): Promise<void> {
  if (!supabase) return Promise.resolve();

  const save = async () => {
    const { data: authData, error: authError } = await supabase!.auth.getUser();
    if (authError || !authData.user) throw authError || new Error('Entre na conta para salvar este padrão de moldura.');
    const { data, error } = await supabase!.from('card_ornament_settings')
      .update({ settings, updated_at: new Date().toISOString() })
      .eq('tier', tier)
      .select('settings')
      .single();
    if (error) throw error;
    const savedSettings = data.settings as CardOrnamentSettings;
    if (Object.keys(settings).some((key) => savedSettings[key as keyof CardOrnamentSettings] !== settings[key as keyof CardOrnamentSettings])) {
      throw new Error('O padrão de moldura não foi sincronizado.');
    }
  };

  const queuedSave = cardOrnamentSettingsWriteQueue.then(save, save);
  cardOrnamentSettingsWriteQueue = queuedSave.then(() => undefined, () => undefined);
  return queuedSave;
}

export async function getSupabaseAuthorizationHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

type ProfileRow = {
  id: string;
  handle: string;
  name: string;
  role: UserRole;
  avatar: string | null;
  bio: string | null;
  favorite_champion: string | null;
  primary_lane: Lane;
  riot_id: string;
  created_at: string;
};

const PROFILE_FIELDS = 'id,handle,name,role,avatar,bio,favorite_champion,primary_lane,riot_id,created_at';
const EMPTY_STATS = { kills: 0, deaths: 0, assists: 0, minions: 0, gold: 0 };

export interface SharedPlayerMatchStats {
  playerId: string;
  stats: UserStats;
  updatedAt: string;
}

export async function loadSharedPlayerMatchStats(): Promise<SharedPlayerMatchStats[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('player_match_stats')
    .select('player_id,kills,deaths,assists,minions,gold,updated_at');
  if (error) throw error;
  return (data || []).map((row) => ({
    playerId: String(row.player_id),
    stats: {
      kills: Number(row.kills),
      deaths: Number(row.deaths),
      assists: Number(row.assists),
      minions: Number(row.minions),
      gold: Number(row.gold),
    },
    updatedAt: String(row.updated_at),
  }));
}

export async function saveSharedPlayerMatchStats(playerId: string, stats: UserStats): Promise<void> {
  if (!supabase) return;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError || new Error('Entre na conta de criador para publicar as estatísticas.');
  const { error } = await supabase.from('player_match_stats').upsert({
    player_id: playerId,
    ...stats,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'player_id' });
  if (error) throw error;
}

export async function loadSharedPlayerMatchRecords(): Promise<MatchRecord[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('player_match_records')
    .select('id,player_id,season,result,kills,deaths,assists,minions,gold,image_fingerprint,created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.id),
    playerId: String(row.player_id),
    season: Number(row.season),
    result: row.result as MatchResult,
    stats: {
      kills: Number(row.kills),
      deaths: Number(row.deaths),
      assists: Number(row.assists),
      minions: Number(row.minions),
      gold: Number(row.gold),
    },
    imageFingerprint: String(row.image_fingerprint),
    createdAt: String(row.created_at),
  }));
}

export async function saveSharedPlayerMatchRecord(record: Omit<MatchRecord, 'id' | 'createdAt'>): Promise<void> {
  if (!supabase) return;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError || new Error('Entre na conta de criador para salvar a partida.');
  const { error } = await supabase.from('player_match_records').upsert({
    player_id: record.playerId,
    season: record.season,
    result: record.result,
    ...record.stats,
    image_fingerprint: record.imageFingerprint,
  }, { onConflict: 'player_id,season,image_fingerprint' });
  if (error) throw error;
}

function profileToUser(profile: ProfileRow, email?: string): User {
  const legacy = INITIAL_USERS.find((user) => normalizeHandle(user.handle) === normalizeHandle(profile.handle));
  const createdAt = profile.created_at || new Date().toISOString();
  return {
    ...(legacy || {} as User),
    id: legacy?.id || profile.id,
    authId: profile.id,
    handle: normalizeHandle(profile.handle),
    name: profile.name,
    ...(email ? { email } : {}),
    // Legacy moderator/captain profile roles are now ordinary player accounts.
    role: profile.role === 'criador' ? 'criador' : 'jogador',
    isOnline: false,
    avatar: profile.avatar || legacy?.avatar || mascotAvatar,
    bio: profile.bio || '',
    favoriteChampion: profile.favorite_champion || '',
    primaryLane: profile.primary_lane,
    riotId: profile.riot_id,
    currentScore: legacy?.currentScore ?? 0,
    totalVotes: legacy?.totalVotes ?? 0,
    seasonsPlayed: legacy?.seasonsPlayed ?? 0,
    mvpCount: legacy?.mvpCount ?? 0,
    aceCount: legacy?.aceCount ?? 0,
    stats: legacy?.stats || EMPTY_STATS,
    entryDate: legacy?.entryDate || new Date(createdAt).toLocaleDateString('pt-BR'),
    createdAt,
    comments: legacy?.comments || [],
  };
}

export async function loadRegisteredProfiles(): Promise<User[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).order('name');
  if (error) throw error;
  return (data || []).map((row) => profileToUser(row as ProfileRow));
}

export async function loadAuthenticatedProfile(authUser: AuthUser): Promise<User> {
  if (!supabase) throw new Error('O cadastro compartilhado ainda não está configurado.');
  const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', authUser.id).single();
  if (error) throw error;
  return profileToUser(data as ProfileRow, authUser.email || undefined);
}

export async function saveAuthenticatedProfile(user: User): Promise<void> {
  if (!supabase) return;
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) throw authError || new Error('Entre na conta para salvar o perfil.');
  const { data: savedProfile, error } = await supabase.from('profiles').update({
    name: user.name.trim(),
    handle: normalizeHandle(user.handle),
    avatar: user.avatar,
    bio: user.bio,
    favorite_champion: user.favoriteChampion,
    primary_lane: user.primaryLane,
    riot_id: normalizeRiotId(user.riotId),
  }).eq('id', data.user.id).select('id, avatar').single();
  if (error) throw error;
  if (savedProfile.avatar !== user.avatar) throw new Error('A foto do perfil não foi sincronizada.');
}

export function mergeRegisteredProfiles(users: User[], profiles: User[]): User[] {
  const byId = new Map(users.map((user) => [user.id, user]));
  profiles.forEach((profile) => {
    const existing = byId.get(profile.id);
    byId.set(profile.id, existing ? { ...profile, stats: existing.stats, comments: existing.comments } : profile);
  });
  return [...byId.values()];
}

