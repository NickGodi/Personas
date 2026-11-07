import type { User as AuthUser } from '@supabase/supabase-js';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { parseOcrMatchStats } from '../src/utils/matchStats.ts';
import { generateOcrWithFallback, getGeminiOcrError } from './geminiOcr.ts';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
let adminClient: any | null = null;
let adminClientLoaded = false;

async function getAdminClient() {
  if (adminClientLoaded) return adminClient;
  adminClientLoaded = true;
  if (!supabaseUrl || !serviceRoleKey) return null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return adminClient;
  } catch (error) {
    console.error('Falha ao inicializar o cliente administrativo do Supabase:', error);
    return null;
  }
}

const LEGACY_IDS: Record<string, string> = {
  '@derick': 'user_derick', '@nick': 'user_nicolas', '@maycao': 'user_maycao',
  '@vexy': 'user_vexy', '@raven': 'user_raven', '@celesta': 'user_celesta',
  '@kairos': 'user_kairos', '@reis': 'user_reis', '@raiq': 'user_raiq',
  '@yago': 'user_yago', '@brutus': 'user_brutus', '@teco': 'user_teco',
  '@nickpresidiario': 'user_nick',
};
const PRESENCE_TTL_MS = 45_000;
function normalizePresenceHandle(value: unknown) {
  const handle = String(value || '').trim().toLowerCase();
  return handle.startsWith('@') ? handle : `@${handle}`;
}
const validModes = ['random', 'predefined', 'balanced', 'captain-draft'];
const validFormats = ['MD1', 'MD3', 'MD5'];
const validStages = ['setup', 'in_progress', 'complete'];

type Profile = { id: string; handle: string; role: string };
type TournamentState = Record<string, any> & {
  updatedAt: number; tournamentStarted: boolean; attendeeIds: string[];
  captainIds: string[]; playerPoolIds: string[]; teams: Array<Record<string, any>>;
};

function responseError(res: ExpressResponse, status: number, message: string) {
  return res.status(status).json({ error: message });
}

function getBearerToken(req: ExpressRequest) {
  const headers = req.headers as unknown as Headers & Record<string, string | string[] | undefined>;
  const authorization = typeof headers.get === 'function' ? headers.get('authorization') : headers.authorization;
  return typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;
}

function getRoutePath(req: ExpressRequest) {
  const queryPath = req.query?.path;
  if (Array.isArray(queryPath)) return queryPath.join('/');
  if (typeof queryPath === 'string' && queryPath) return queryPath;
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  return pathname.replace(/^\/api\/?/, '');
}

async function getActor(req: ExpressRequest): Promise<{ authUser: AuthUser; profile: Profile; appId: string } | null> {
  const token = getBearerToken(req);
  const admin = await getAdminClient();
  if (!admin || !token) return null;
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return null;
  const { data: profile, error } = await admin.from('profiles')
    .select('id,handle,role').eq('id', authData.user.id).single();
  if (error || !profile) return null;
  const normalizedHandle = String(profile.handle).startsWith('@') ? String(profile.handle).toLowerCase() : `@${profile.handle}`.toLowerCase();
  return { authUser: authData.user, profile: { ...profile, handle: normalizedHandle }, appId: LEGACY_IDS[normalizedHandle] || authData.user.id };
}

function validTournamentState(state: any): state is TournamentState {
  const reroll = state?.captainRerollRequest;
  const validReroll = reroll == null || Boolean(typeof reroll === 'object'
    && typeof reroll.id === 'string' && reroll.id.length > 0
    && typeof reroll.requesterId === 'string' && typeof reroll.requesterName === 'string'
    && typeof reroll.opponentId === 'string'
    && (reroll.status === 'waiting_opponent' || reroll.status === 'waiting_creator')
    && Number.isFinite(reroll.createdAt)
    && (reroll.acceptedBy === undefined || typeof reroll.acceptedBy === 'string')
    && (reroll.acceptedByName === undefined || typeof reroll.acceptedByName === 'string'));
  const interClassDraw = state?.interClassDraw;
  const classes = ['Magos', 'Lutadores', 'Assassinos', 'Suportes', 'Atiradores', 'Tanks'];
  const validClassDraw = interClassDraw == null || Boolean(typeof interClassDraw === 'object'
    && typeof interClassDraw.cardId === 'string'
    && classes.includes(interClassDraw.blueClass) && classes.includes(interClassDraw.redClass)
    && interClassDraw.blueClass !== interClassDraw.redClass
    && Number.isFinite(interClassDraw.drawnAt));
  return Boolean(state && typeof state === 'object'
    && Number.isFinite(state.updatedAt)
    && Array.isArray(state.teams) && Array.isArray(state.attendeeIds)
    && Array.isArray(state.captainIds) && state.captainIds.length === 2
    && Array.isArray(state.playerPoolIds)
    && state.attendeeIds.every((id: unknown) => typeof id === 'string')
    && state.captainIds.every((id: unknown) => typeof id === 'string')
    && (state.confirmedDeckCardId === undefined || state.confirmedDeckCardId === null || typeof state.confirmedDeckCardId === 'string')
    && validReroll && validClassDraw
    && state.playerPoolIds.every((id: unknown) => typeof id === 'string')
    && state.teams.every((team: any) => typeof team?.id === 'string'
      && Array.isArray(team.members) && team.members.length <= 5
      && team.members.every((id: unknown) => typeof id === 'string'))
    && validModes.includes(state.draftMode)
    && validFormats.includes(state.seriesFormat)
    && validStages.includes(state.draftStage)
    && typeof state.tournamentStarted === 'boolean');
}

function sameTournamentExceptReroll(current: TournamentState, next: TournamentState) {
  const stableValue = (value: any): any => {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  };
  const comparable = (state: TournamentState) => {
    const { updatedAt: _updatedAt, captainRerollRequest: _reroll, ...copy } = state;
    copy.confirmedDeckCardId ??= null;
    copy.interClassDraw ??= null;
    return copy;
  };
  return JSON.stringify(stableValue(comparable(current))) === JSON.stringify(stableValue(comparable(next)));
}

function mayChangeCaptainReroll(current: TournamentState | null, state: TournamentState, actorId: string) {
  if (!current || !sameTournamentExceptReroll(current, state)) return false;
  const [firstCaptain, secondCaptain] = current.captainIds || [];
  if (!firstCaptain || !secondCaptain || firstCaptain === secondCaptain
    || !current.attendeeIds.includes(firstCaptain) || !current.attendeeIds.includes(secondCaptain)
    || !current.confirmedDeckCardId || ![firstCaptain, secondCaptain].includes(actorId)) return false;

  const existing = current.captainRerollRequest || null;
  const next = state.captainRerollRequest || null;
  if (!existing && next) {
    const opponentId = actorId === firstCaptain ? secondCaptain : firstCaptain;
    return next.status === 'waiting_opponent'
      && next.requesterId === actorId
      && next.opponentId === opponentId
      && typeof next.requesterName === 'string' && next.requesterName.trim().length > 0
      && !next.acceptedBy && !next.acceptedByName;
  }
  if (existing?.status === 'waiting_opponent' && existing.opponentId === actorId) {
    if (!next) return true;
    return next.status === 'waiting_creator'
      && next.id === existing.id
      && next.requesterId === existing.requesterId
      && next.requesterName === existing.requesterName
      && next.opponentId === existing.opponentId
      && next.createdAt === existing.createdAt
      && next.acceptedBy === actorId
      && typeof next.acceptedByName === 'string' && next.acceptedByName.trim().length > 0;
  }
  return false;
}

async function readTournamentState() {
  const admin = await getAdminClient();
  if (!admin) throw new Error('Supabase server-side não está configurado.');
  const { data, error } = await admin.from('shared_app_state').select('state').eq('state_key', 'tournament').maybeSingle();
  if (error) throw error;
  return (data?.state as TournamentState | null) || null;
}

function mayEditAttendance(current: TournamentState | null, state: TournamentState, actorId: string) {
  if (state.tournamentStarted) return false;
  if (!current) {
    return state.draftStage === 'setup' && state.captainDraftTurn === null
      && state.playerPoolIds.length === 0 && state.attendeeIds.length === 1
      && state.attendeeIds[0] === actorId
      && state.teams.every((team) => (team.members || []).length === 0);
  }
  if (current.tournamentStarted) return false;
  const previous = new Set(current.attendeeIds || []);
  const next = new Set(state.attendeeIds || []);
  const changed = [...new Set([...previous, ...next])].filter((id) => previous.has(id) !== next.has(id));
  const currentComparable = { ...current, attendeeIds: [], updatedAt: 0 };
  const nextComparable = { ...state, attendeeIds: [], updatedAt: 0 };
  return changed.length === 1 && changed[0] === actorId
    && JSON.stringify(currentComparable) === JSON.stringify(nextComparable);
}

function mayMakeCaptainPick(current: TournamentState, state: TournamentState, actorId: string) {
  const turn = current.captainDraftTurn;
  if (current.draftStage !== 'in_progress' || !Number.isInteger(turn) || current.captainIds?.[turn] !== actorId) return false;
  const oldMembers = new Set<string>((current.teams || []).flatMap((team) => team.members || []));
  const newMembers = new Set<string>((state.teams || []).flatMap((team) => team.members || []));
  const addedMembers = [...newMembers].filter((id) => !oldMembers.has(id));
  const removedMembers = [...oldMembers].filter((id) => !newMembers.has(id));
  const selectedPlayerId = addedMembers[0];
  const activeTeam = current.teams[turn];
  const selectedTeam = state.teams.find((team) => team.captainId === actorId);
  const sameTeamDefinitions = state.teams.length === current.teams.length
    && state.teams.every((team, index) => {
      const { members: _oldMembers, ...oldDefinition } = current.teams[index];
      const { members: _newMembers, ...newDefinition } = team;
      return JSON.stringify(oldDefinition) === JSON.stringify(newDefinition);
    });
  const expectedPool = (current.playerPoolIds || []).filter((id) => id !== selectedPlayerId);
  const otherTeam = current.teams[1 - turn];
  const pickedTeam = state.teams.find((team) => team.captainId === actorId);
  const preferredTurn = 1 - turn;
  const preferredMembers = state.teams.find((team) => team.captainId === current.captainIds[preferredTurn])?.members || [];
  const nextTurn = preferredMembers.length < 5 ? preferredTurn : (pickedTeam?.members || []).length < 5 ? turn : null;
  const expectedTurn = expectedPool.length ? nextTurn : null;
  const expectedStage = expectedTurn === null ? 'complete' : 'in_progress';
  const sameSetup = state.tournamentStarted === current.tournamentStarted
    && state.attendeeIds.join('|') === (current.attendeeIds || []).join('|')
    && state.captainIds.join('|') === current.captainIds.join('|')
    && state.draftMode === current.draftMode
    && state.seriesFormat === current.seriesFormat
    && JSON.stringify(state.predefinedTeams) === JSON.stringify(current.predefinedTeams)
    && current.draftMode === 'captain-draft' && sameTeamDefinitions
    && state.teams.every((team) => (team.members || []).length <= 5);
  return sameSetup && addedMembers.length === 1 && removedMembers.length === 0
    && activeTeam?.captainId === actorId
    && current.playerPoolIds.includes(selectedPlayerId)
    && current.attendeeIds.includes(selectedPlayerId)
    && selectedTeam?.members?.includes(selectedPlayerId)
    && Boolean(otherTeam)
    && JSON.stringify(state.playerPoolIds) === JSON.stringify(expectedPool)
    && state.captainDraftTurn === expectedTurn && state.draftStage === expectedStage;
}

async function handleTournament(req: ExpressRequest, res: ExpressResponse) {
  if (req.method === 'GET') {
    try { return res.status(200).json({ state: await readTournamentState() }); }
    catch { return responseError(res, 503, 'Estado compartilhado indisponível. Configure o Supabase.'); }
  }
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Método não permitido.' });
  const actor = await getActor(req);
  if (!actor) return responseError(res, 401, 'Entre na sua conta para atualizar o torneio.');

  if (req.body?.action === 'set-attendance') {
    if (typeof req.body.checkedIn !== 'boolean') return responseError(res, 400, 'Estado do check-in inválido.');
    try {
      const admin = await getAdminClient();
      if (!admin) return responseError(res, 503, 'Supabase server-side não está configurado.');
      const { data, error } = await admin.rpc('set_tournament_attendance', {
        p_actor_id: actor.appId,
        p_checked_in: req.body.checkedIn,
      });
      if (error) {
        if (error.code === '55000') return responseError(res, 409, error.message || 'O check-in desta temporada está encerrado.');
        throw error;
      }
      if (!data || typeof data !== 'object') throw new Error('A resposta do check-in está vazia.');
      return res.status(200).json({ state: data });
    } catch (error) {
      console.error('Falha ao salvar o check-in compartilhado:', error);
      return responseError(res, 503, 'Não foi possível salvar o check-in. Tente novamente.');
    }
  }

  const state = req.body?.state;
  if (!validTournamentState(state)) return responseError(res, 400, 'Estado do torneio inválido.');

  try {
    const current = await readTournamentState();
    const isCreator = actor.profile.role === 'criador';
    const mayUpdate = isCreator
      || mayEditAttendance(current, state, actor.appId)
      || mayChangeCaptainReroll(current, state, actor.appId)
      || Boolean(current && mayMakeCaptainPick(current, state, actor.appId));
    if (!mayUpdate) return responseError(res, 403, 'Você não pode alterar esta etapa do torneio.');
    if (current && Number(state.updatedAt) <= Number(current.updatedAt)) return res.status(200).json({ state: current });

    const savedState = {
      ...state,
      updatedAt: Math.max(Date.now(), Number(current?.updatedAt || 0) + 1, Number(state.updatedAt)),
    };
    const admin = await getAdminClient();
    if (!admin) return responseError(res, 503, 'Supabase server-side não está configurado.');
    const { error } = await admin.from('shared_app_state').upsert({
      state_key: 'tournament', state: savedState, updated_at: new Date().toISOString(),
    }, { onConflict: 'state_key' });
    if (error) throw error;
    return res.status(200).json({ state: savedState });
  } catch (error) {
    console.error('Falha ao salvar o estado do torneio:', error);
    return responseError(res, 503, 'Falha ao salvar o estado compartilhado do torneio.');
  }
}

export async function handleResetAllSeasons(req: ExpressRequest, res: ExpressResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const actor = await getActor(req);
  if (!actor) return responseError(res, 401, 'Entre na sua conta para resetar as temporadas.');
  if (actor.profile.role !== 'criador') return responseError(res, 403, 'Somente o Criador pode resetar as temporadas.');

  const admin = await getAdminClient();
  if (!admin) return responseError(res, 503, 'Supabase server-side não está configurado.');

  try {
    const voteDelete = await admin.from('season_player_votes').delete().gte('season', 1);
    if (voteDelete.error) throw voteDelete.error;

    const matchDelete = await admin.from('player_match_records').delete().gte('season', 1);
    if (matchDelete.error) throw matchDelete.error;

    const statsReset = await admin.from('player_match_stats')
      .update({ kills: 0, deaths: 0, assists: 0, minions: 0, gold: 0, updated_at: new Date().toISOString() })
      .gte('kills', 0);
    if (statsReset.error) throw statsReset.error;

    const now = new Date().toISOString();
    const seasonReset = await admin.from('shared_season_control').upsert({
      singleton: true,
      season: 1,
      status: 'ready',
      started_at: null,
      ends_at: null,
      updated_at: now,
    }, { onConflict: 'singleton' });
    if (seasonReset.error) throw seasonReset.error;

    const resetAt = Date.now();
    const currentTournament = await readTournamentState();
    const tournamentState: TournamentState = {
      updatedAt: Math.max(resetAt, Number(currentTournament?.updatedAt || 0) + 1),
      seasonResetAt: resetAt,
      attendanceSeason: 1,
      tournamentStarted: false,
      attendeeIds: [],
      captainIds: ['', ''],
      draftMode: 'random',
      seriesFormat: 'MD3',
      predefinedTeams: null,
      captainDraftTurn: null,
      playerPoolIds: [],
      draftStage: 'setup',
      teams: [],
    };
    const tournamentReset = await admin.from('shared_app_state').upsert({
      state_key: 'tournament',
      state: tournamentState,
      updated_at: now,
    }, { onConflict: 'state_key' });
    if (tournamentReset.error) throw tournamentReset.error;

    return res.status(200).json({ ok: true, activeSeason: { number: 1, status: 'ready', startedAt: null, endsAt: null }, tournamentState });
  } catch (error) {
    console.error('Falha ao resetar as temporadas:', error);
    return responseError(res, 503, 'Não foi possível concluir o reset compartilhado das temporadas.');
  }
}

async function handlePresence(req: ExpressRequest, res: ExpressResponse) {
  const admin = await getAdminClient();
  if (!admin) return responseError(res, 503, 'Presença compartilhada não configurada.');
  if (req.method === 'GET') {
    const now = Date.now();
    const { data, error } = await admin.from('presence_sessions')
      .select('user_id,profile_handle,last_seen_at,ended_at');
    if (error) return responseError(res, 503, 'Não foi possível consultar presenças.');
    const { data: profiles, error: profilesError } = await admin.from('profiles').select('id,handle');
    if (profilesError) return responseError(res, 503, 'Não foi possível relacionar presenças aos perfis.');
    const profileIdsByHandle = new Map((profiles || []).map((profile: { id: string; handle: string }) => {
      const handle = normalizePresenceHandle(profile.handle);
      return [handle, LEGACY_IDS[handle] || profile.id] as const;
    }));
    const statuses: Record<string, { online: boolean; lastSeenAt: string | null; offlineSince: string | null }> = {};
    for (const row of data || []) {
      const handle = normalizePresenceHandle(row.profile_handle);
      const userId = LEGACY_IDS[handle] || profileIdsByHandle.get(handle) || row.user_id;
      const status = statuses[userId] || { online: false, lastSeenAt: null, offlineSince: null };
      const lastSeenAt = new Date(row.last_seen_at).getTime();
      const endedAt = row.ended_at ? new Date(row.ended_at).getTime() : null;
      const isSessionOnline = endedAt === null && Number.isFinite(lastSeenAt) && now - lastSeenAt <= PRESENCE_TTL_MS;
      status.online ||= isSessionOnline;
      if (Number.isFinite(lastSeenAt) && (!status.lastSeenAt || lastSeenAt > Date.parse(status.lastSeenAt))) {
        status.lastSeenAt = new Date(lastSeenAt).toISOString();
      }
      const sessionEndedAt = endedAt ?? lastSeenAt + PRESENCE_TTL_MS;
      if (!isSessionOnline && Number.isFinite(sessionEndedAt)
        && (!status.offlineSince || sessionEndedAt > Date.parse(status.offlineSince))) {
        status.offlineSince = new Date(Math.min(sessionEndedAt, now)).toISOString();
      }
      statuses[userId] = status;
    }
    Object.values(statuses).forEach((status) => {
      if (status.online) status.offlineSince = null;
    });
    const userIds = Object.entries(statuses).filter(([, status]) => status.online).map(([userId]) => userId);
    return res.status(200).json({ userIds, statuses });
  }
  const actor = await getActor(req);
  if (!actor) return responseError(res, 401, 'Entre na sua conta para atualizar a presença.');
  if (req.method === 'PUT') {
    const { sessionId, userId } = req.body || {};
    if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 160) {
      return responseError(res, 400, 'Sessão de presença inválida.');
    }
    let targetProfile = actor.profile;
    if (typeof userId === 'string' && userId !== actor.appId) {
      if (actor.profile.role !== 'criador') return responseError(res, 403, 'Somente o criador pode acompanhar outro perfil.');
      const { data: profiles, error: profilesError } = await admin.from('profiles').select('id,handle,role');
      if (profilesError) return responseError(res, 503, 'Não foi possível localizar o perfil acompanhado.');
      const matchingProfile = (profiles || []).find((profile: { id: string; handle: string }) => {
        const handle = normalizePresenceHandle(profile.handle);
        return profile.id === userId || LEGACY_IDS[handle] === userId;
      });
      if (!matchingProfile) return responseError(res, 404, 'Este perfil ainda não possui uma conta registrada.');
      const normalizedHandle = normalizePresenceHandle(matchingProfile.handle);
      targetProfile = { ...matchingProfile, handle: normalizedHandle };
    }
    const { error } = await admin.from('presence_sessions').upsert({
      session_id: sessionId, user_id: actor.authUser.id,
      profile_handle: targetProfile.handle, last_seen_at: new Date().toISOString(), ended_at: null,
    }, { onConflict: 'session_id' });
    if (error) return responseError(res, 503, 'Não foi possível atualizar sua presença.');
    const { data: activeSessions, error: sessionsError } = await admin.from('presence_sessions')
      .select('user_id,profile_handle,last_seen_at,ended_at');
    if (sessionsError) return responseError(res, 503, 'Não foi possível atualizar a lista de presenças.');
    const { data: profiles, error: profilesError } = await admin.from('profiles').select('id,handle');
    if (profilesError) return responseError(res, 503, 'Não foi possível relacionar presenças aos perfis.');
    const profileIdsByHandle = new Map((profiles || []).map((profile: { id: string; handle: string }) => {
      const handle = normalizePresenceHandle(profile.handle);
      return [handle, LEGACY_IDS[handle] || profile.id] as const;
    }));
    const cutoff = Date.now() - PRESENCE_TTL_MS;
    const userIds = [...new Set((activeSessions || [])
      .filter((row: { last_seen_at: string; ended_at: string | null }) => !row.ended_at && Date.parse(row.last_seen_at) >= cutoff)
      .map((row: { profile_handle: string; user_id: string }) => {
        const handle = normalizePresenceHandle(row.profile_handle);
        return LEGACY_IDS[handle] || profileIdsByHandle.get(handle) || row.user_id;
      }))];
    return res.status(200).json({ userIds });
  }
  if (req.method === 'DELETE') {
    const sessionId = typeof req.query?.sessionId === 'string' ? req.query.sessionId : req.body?.sessionId;
    if (typeof sessionId === 'string') {
      await admin.from('presence_sessions').update({ ended_at: new Date().toISOString() })
        .eq('session_id', sessionId).eq('user_id', actor.authUser.id).is('ended_at', null);
    }
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Método não permitido.' });
}

async function handleOcr(req: ExpressRequest, res: ExpressResponse) {
  const actor = await getActor(req);
  if (!actor) return responseError(res, 401, 'Entre na sua conta para usar o OCR.');
  if (actor.profile.role !== 'criador') return responseError(res, 403, 'O OCR está disponível apenas para o criador.');
  try {
    const { imageBase64, mimeType = 'image/png' } = req.body ?? {};
    if (typeof imageBase64 !== 'string' || !imageBase64.length) return responseError(res, 400, 'Nenhuma imagem foi enviada.');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) return responseError(res, 415, 'Formato não suportado. Use PNG, JPEG ou WebP.');
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.slice(imageBase64.indexOf(',') + 1) : imageBase64;
    // Vercel functions limit request bodies; keep a clear bound instead of returning a platform error.
    if (cleanBase64.length > 4_000_000) return responseError(res, 413, 'Reduza a imagem para menos de 3 MB antes de importar.');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleanBase64)) return responseError(res, 400, 'A imagem enviada está em um formato inválido.');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return responseError(res, 503, 'O OCR ainda não está configurado. Configure GEMINI_API_KEY na Vercel.');
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Leia o print de uma partida de League of Legends. Extraia APENAS os dados do jogador identificado no cabeçalho/linha de estatísticas da imagem. Não extraia votos, médias, dados de outros jogadores, itens ou estatísticas que não foram pedidas.
Responda somente um objeto JSON válido, sem Markdown, no formato:
{"playerName":"nome exatamente como aparece","kills":0,"deaths":0,"assists":0,"minions":0,"gold":0,"notes":""}
Interprete o KDA como abates/mortes/assistências, nesta ordem. Minions é o total de tropas abatidas (CS). Gold é ouro total. Retorne todos os números como inteiros sem separadores de milhar (por exemplo, ouro 23.941 vira 23941). Se um dado não estiver legível ou visível, retorne null para esse campo. Não adivinhe e não invente valores. O nome deve ser o nome do jogador visível na linha escolhida; se não estiver legível, use null.`;
    const response = await generateOcrWithFallback((model) => ai.models.generateContent({ model, contents: [{ role: 'user', parts: [
      { text: prompt }, { inlineData: { data: cleanBase64, mimeType } },
    ] }] }));
    const data = parseOcrMatchStats(response.text || '');
    return res.status(200).json({ success: true, source: 'gemini_vision', data });
  } catch (error) {
    console.error('Falha no OCR:', error);
    const result = getGeminiOcrError(error);
    return responseError(res, result.status, result.message);
  }
}

async function handleDeleteAccount(req: ExpressRequest, res: ExpressResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const actor = await getActor(req);
  if (!actor) return responseError(res, 401, 'Entre na conta do criador para excluir uma conta.');
  if (actor.profile.role !== 'criador') return responseError(res, 403, 'Somente o criador pode excluir contas.');

  const targetAuthId = typeof req.body?.targetAuthId === 'string' ? req.body.targetAuthId.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetAuthId)) {
    return responseError(res, 400, 'A conta selecionada é inválida.');
  }
  if (targetAuthId === actor.authUser.id) return responseError(res, 400, 'Você não pode excluir a própria conta do criador.');

  const admin = await getAdminClient();
  if (!admin) return responseError(res, 503, 'A exclusão de contas não está configurada no servidor.');

  try {
    const { data: targetProfile, error: profileError } = await admin.from('profiles')
      .select('id,role').eq('id', targetAuthId).maybeSingle();
    if (profileError) throw profileError;
    if (!targetProfile) return responseError(res, 404, 'A conta selecionada não foi encontrada.');
    if (targetProfile.role === 'criador') return responseError(res, 403, 'Esta opção não pode excluir uma conta de criador.');

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetAuthId);
    if (deleteError) throw deleteError;
    // Remove the public identity explicitly as well. This releases unique
    // handle/Riot ID values even if the project's profile FK predates cascade.
    const { error: profileDeleteError } = await admin.from('profiles').delete().eq('id', targetAuthId);
    if (profileDeleteError) throw profileDeleteError;
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Falha ao excluir conta pelo painel do criador:', error);
    return responseError(res, 500, 'Não foi possível excluir esta conta. Tente novamente.');
  }
}

async function dispatch(req: ExpressRequest, res: ExpressResponse) {
  try {
    const route = getRoutePath(req);
    if (route === 'admin/delete-account') return handleDeleteAccount(req, res);
    if (route === 'auth/login' && req.method === 'POST') {
      const headers = req.headers as unknown as Headers & Record<string, string | string[] | undefined>;
      const forwardedFor = typeof headers.get === 'function' ? headers.get('x-forwarded-for') : headers['x-forwarded-for'];
      const forwardedIps = String(forwardedFor || '').split(',');
      const clientIp = forwardedIps[forwardedIps.length - 1]?.trim() || 'unknown';
      const { signInWithLogin } = await import('./authLogin.ts');
      const result = await signInWithLogin(req.body?.login, req.body?.password, clientIp);
      return res.status(result.status).json(result.body);
    }
    if (route === 'auth/register' && req.method === 'POST') {
      const headers = req.headers as unknown as Headers & Record<string, string | string[] | undefined>;
      const forwardedFor = typeof headers.get === 'function' ? headers.get('x-forwarded-for') : headers['x-forwarded-for'];
      const forwardedIps = String(forwardedFor || '').split(',');
      const clientIp = forwardedIps[forwardedIps.length - 1]?.trim() || 'unknown';
      const { registerWithLogin } = await import('./authRegister.ts');
      const result = await registerWithLogin(req.body || {}, clientIp);
      return res.status(result.status).json(result.body);
    }
    if (route === 'tournament-state') return handleTournament(req, res);
    if (route === 'reset-seasons') return handleResetAllSeasons(req, res);
    if (route === 'presence') return handlePresence(req, res);
    if (route === 'ocr' && req.method === 'POST') return handleOcr(req, res);
    if (route === 'health' && req.method === 'GET') return res.status(200).json({ status: 'ok', app: 'Personas', time: new Date().toISOString() });
    return responseError(res, 404, 'Rota não encontrada.');
  } catch (error) {
    console.error('Falha na função de API Personas:', error);
    return responseError(res, 500, 'Não foi possível processar esta solicitação.');
  }
}

export function createApiHandler(routeOverride?: string) {
  return {
    async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const route = routeOverride || url.pathname.replace(/^\/api\/?/, '');
      const query = Object.fromEntries(url.searchParams.entries());
      const body = request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.json();
      const req = {
        method: request.method,
        url: request.url,
        headers: request.headers,
        query: { ...query, path: route.split('/').filter(Boolean) },
        body,
      } as unknown as ExpressRequest;
      const responseState: { statusCode: number; payload: unknown } = { statusCode: 200, payload: null };
      const res = {
        status(code: number) { responseState.statusCode = code; return this; },
        json(payload: unknown) { responseState.payload = payload; return this; },
      } as unknown as ExpressResponse;
      await dispatch(req, res);
      return new Response(JSON.stringify(responseState.payload ?? {}), {
        status: responseState.statusCode,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    } catch (error) {
      console.error('Falha ao receber solicitação na API Personas:', error);
      return new Response(JSON.stringify({ error: 'Não foi possível processar esta solicitação.' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    },
  };
}
