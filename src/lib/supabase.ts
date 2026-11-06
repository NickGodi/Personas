import { createClient, type User as AuthUser } from '@supabase/supabase-js';
import type { Lane, User, UserRole } from '../types';
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
const EMPTY_STATS = { kills: 0, deaths: 0, assists: 0, wards: 0, damageDealt: 0, damageReceived: 0 };

function profileToUser(profile: ProfileRow, email?: string): User {
  const legacy = INITIAL_USERS.find((user) => normalizeHandle(user.handle) === normalizeHandle(profile.handle));
  const createdAt = profile.created_at || new Date().toISOString();
  return {
    ...(legacy || {} as User),
    id: legacy?.id || profile.id,
    handle: normalizeHandle(profile.handle),
    name: profile.name,
    ...(email ? { email } : {}),
    role: profile.role,
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
  profiles.forEach((profile) => byId.set(profile.id, profile));
  return [...byId.values()];
}

