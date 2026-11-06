import type { User as AuthUser } from '@supabase/supabase-js';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { parseOcrMatchStats } from '../src/utils/matchStats';

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
  return Boolean(state && typeof state === 'object'
    && Number.isFinite(state.updatedAt)
    && Array.isArray(state.teams) && Array.isArray(state.attendeeIds)
    && Array.isArray(state.captainIds) && state.captainIds.length === 2
    && Array.isArray(state.playerPoolIds)
    && state.attendeeIds.every((id: unknown) => typeof id === 'string')
    && state.captainIds.every((id: unknown) => typeof id === 'string')
    && state.playerPoolIds.every((id: unknown) => typeof id === 'string')
    && state.teams.every((team: any) => typeof team?.id === 'string'
      && Array.isArray(team.members) && team.members.length <= 5
      && team.members.every((id: unknown) => typeof id === 'string'))
    && validModes.includes(state.draftMode)
    && validFormats.includes(state.seriesFormat)
    && validStages.includes(state.draftStage)
    && typeof state.tournamentStarted === 'boolean');
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
  const state = req.body?.state;
  if (!validTournamentState(state)) return responseError(res, 400, 'Estado do torneio inválido.');

  try {
    const current = await readTournamentState();
    const isCreator = actor.profile.role === 'criador';
    const mayUpdate = isCreator
      || mayEditAttendance(current, state, actor.appId)
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

async function handlePresence(req: ExpressRequest, res: ExpressResponse) {
  const admin = await getAdminClient();
  if (!admin) return responseError(res, 503, 'Presença compartilhada não configurada.');
  if (req.method === 'GET') {
    const cutoff = new Date(Date.now() - PRESENCE_TTL_MS).toISOString();
    const { data, error } = await admin.from('presence_sessions').select('profile_handle')
      .gt('last_seen_at', cutoff);
    if (error) return responseError(res, 503, 'Não foi possível consultar presenças.');
    const userIds = [...new Set((data || []).map((row: { profile_handle: string }) => LEGACY_IDS[row.profile_handle] || row.profile_handle))];
    return res.status(200).json({ userIds });
  }
  const actor = await getActor(req);
  if (!actor) return responseError(res, 401, 'Entre na sua conta para atualizar a presença.');
  if (req.method === 'PUT') {
    const { sessionId } = req.body || {};
    if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 160) {
      return responseError(res, 400, 'Sessão de presença inválida.');
    }
    const { error } = await admin.from('presence_sessions').upsert({
      session_id: sessionId, user_id: actor.authUser.id,
      profile_handle: actor.profile.handle, last_seen_at: new Date().toISOString(),
    }, { onConflict: 'session_id' });
    if (error) return responseError(res, 503, 'Não foi possível atualizar sua presença.');
    const cutoff = new Date(Date.now() - PRESENCE_TTL_MS).toISOString();
    const { data } = await admin.from('presence_sessions').select('profile_handle').gt('last_seen_at', cutoff);
    return res.status(200).json({ userIds: [...new Set((data || []).map((row: { profile_handle: string }) => LEGACY_IDS[row.profile_handle] || row.profile_handle))] });
  }
  if (req.method === 'DELETE') {
    const sessionId = typeof req.query?.sessionId === 'string' ? req.query.sessionId : req.body?.sessionId;
    if (typeof sessionId === 'string') {
      await admin.from('presence_sessions').delete().eq('session_id', sessionId).eq('user_id', actor.authUser.id);
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
    const response = await ai.models.generateContent({ model: 'gemini-3.8-flash', contents: [{ role: 'user', parts: [
      { text: prompt }, { inlineData: { data: cleanBase64, mimeType } },
    ] }] });
    const data = parseOcrMatchStats(response.text || '');
    return res.status(200).json({ success: true, source: 'gemini_vision', data });
  } catch (error) {
    console.error('Falha no OCR:', error);
    const message = error instanceof Error ? error.message : 'Não foi possível processar a imagem.';
    return responseError(res, 502, message);
  }
}

async function dispatch(req: ExpressRequest, res: ExpressResponse) {
  try {
    const route = getRoutePath(req);
    if (route === 'auth/login' && req.method === 'POST') {
      const headers = req.headers as unknown as Headers & Record<string, string | string[] | undefined>;
      const forwardedFor = typeof headers.get === 'function' ? headers.get('x-forwarded-for') : headers['x-forwarded-for'];
      const forwardedIps = String(forwardedFor || '').split(',');
      const clientIp = forwardedIps[forwardedIps.length - 1]?.trim() || 'unknown';
      const { signInWithLogin } = await import('../server/authLogin');
      const result = await signInWithLogin(req.body?.login, req.body?.password, clientIp);
      return res.status(result.status).json(result.body);
    }
    if (route === 'tournament-state') return handleTournament(req, res);
    if (route === 'presence') return handlePresence(req, res);
    if (route === 'ocr' && req.method === 'POST') return handleOcr(req, res);
    if (route === 'health' && req.method === 'GET') return res.status(200).json({ status: 'ok', app: 'Personas', time: new Date().toISOString() });
    return responseError(res, 404, 'Rota não encontrada.');
  } catch (error) {
    console.error('Falha na função de API Personas:', error);
    return responseError(res, 500, 'Não foi possível processar esta solicitação.');
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const route = url.pathname.replace(/^\/api\/?/, '');
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
