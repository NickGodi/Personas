import express from 'express';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { parseOcrMatchStats } from './src/utils/matchStats';
import { generateOcrWithFallback, getGeminiOcrError } from './server/geminiOcr';
import { signInWithLogin } from './server/authLogin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: ['.env.local', '.env'] });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sharedTournamentStateFile = path.resolve(__dirname, 'data', 'personas-tournament-state.json');
let sharedTournamentState: Record<string, any> | null = null;
let sharedTournamentStateLoaded = false;
let tournamentWriteQueue = Promise.resolve();
const PRESENCE_TTL_MS = 45_000;
const presenceSessions = new Map<string, { userId: string; lastSeenAt: number; endedAt: number | null }>();

function getPresenceSnapshot() {
  const now = Date.now();
  const statuses: Record<string, { online: boolean; lastSeenAt: string | null; offlineSince: string | null }> = {};
  for (const presence of presenceSessions.values()) {
    const status = statuses[presence.userId] || { online: false, lastSeenAt: null, offlineSince: null };
    const online = presence.endedAt === null && now - presence.lastSeenAt <= PRESENCE_TTL_MS;
    status.online ||= online;
    const lastSeenAt = new Date(presence.lastSeenAt).toISOString();
    if (!status.lastSeenAt || Date.parse(lastSeenAt) > Date.parse(status.lastSeenAt)) status.lastSeenAt = lastSeenAt;
    const endedAt = presence.endedAt ?? presence.lastSeenAt + PRESENCE_TTL_MS;
    if (!online && (!status.offlineSince || endedAt > Date.parse(status.offlineSince))) {
      status.offlineSince = new Date(Math.min(endedAt, now)).toISOString();
    }
    statuses[presence.userId] = status;
  }
  Object.values(statuses).forEach((status) => {
    if (status.online) status.offlineSince = null;
  });
  return {
    userIds: Object.entries(statuses).filter(([, status]) => status.online).map(([userId]) => userId),
    statuses,
  };
}

function stableTournamentValue(value: any): any {
  if (Array.isArray(value)) return value.map(stableTournamentValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableTournamentValue(value[key])]));
}

function mayChangeCaptainReroll(current: Record<string, any> | null, nextState: Record<string, any>, actorId: string) {
  if (!current) return false;
  const comparable = (state: Record<string, any>) => {
    const { updatedAt: _updatedAt, captainRerollRequest: _reroll, ...copy } = state;
    copy.confirmedDeckCardId ??= null;
    copy.interClassDraw ??= null;
    return copy;
  };
  if (JSON.stringify(stableTournamentValue(comparable(current))) !== JSON.stringify(stableTournamentValue(comparable(nextState)))) return false;

  const [firstCaptain, secondCaptain] = current.captainIds || [];
  if (!firstCaptain || !secondCaptain || firstCaptain === secondCaptain
    || !current.attendeeIds.includes(firstCaptain) || !current.attendeeIds.includes(secondCaptain)
    || !current.confirmedDeckCardId || ![firstCaptain, secondCaptain].includes(actorId)) return false;

  const existing = current.captainRerollRequest || null;
  const next = nextState.captainRerollRequest || null;
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

async function loadSharedTournamentState() {
  if (sharedTournamentStateLoaded) return;
  try {
    const saved = await readFile(sharedTournamentStateFile, 'utf8');
    const parsed = JSON.parse(saved);
    sharedTournamentState = parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    sharedTournamentState = null;
  }
  sharedTournamentStateLoaded = true;
}

async function persistSharedTournamentState(state: Record<string, any>) {
  const save = async () => {
    await mkdir(path.dirname(sharedTournamentStateFile), { recursive: true });
    const tempPath = `${sharedTournamentStateFile}.${state.updatedAt}.tmp`;
    await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
    await rename(tempPath, sharedTournamentStateFile);
  };
  tournamentWriteQueue = tournamentWriteQueue.then(save, save);
  await tournamentWriteQueue;
}

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Base64 grows the image by about one third; this covers the 15 MB upload limit.
  app.use(express.json({ limit: '22mb' }));

  app.post('/api/auth/login', async (req, res) => {
    const result = await signInWithLogin(req.body?.login, req.body?.password, req.ip || 'local');
    return res.status(result.status).json(result.body);
  });

  app.post('/api/reset-seasons', async (req, res) => {
    const authorization = req.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Entre na sua conta para resetar as temporadas.' });
    }

    const configuredOcrUrl = process.env.PERSONAS_OCR_API_URL;
    if (!configuredOcrUrl) {
      return res.status(503).json({ error: 'O servidor local não está conectado ao backend compartilhado.' });
    }

    let upstreamUrl: URL;
    try {
      upstreamUrl = new URL(configuredOcrUrl);
    } catch {
      return res.status(503).json({ error: 'A URL do backend compartilhado está inválida.' });
    }
    if (upstreamUrl.protocol !== 'https:' || upstreamUrl.hostname !== 'personas-mu.vercel.app' || upstreamUrl.pathname !== '/api/ocr') {
      return res.status(503).json({ error: 'Configure PERSONAS_OCR_API_URL com o endpoint HTTPS do backend do Personas.' });
    }

    upstreamUrl.pathname = '/api/reset-seasons';
    upstreamUrl.search = '';
    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization,
        },
        body: JSON.stringify({}),
      });
      const responseBody = await upstreamResponse.text();
      const responseType = upstreamResponse.headers.get('content-type')?.split(';', 1)[0] || 'application/json';
      return res.status(upstreamResponse.status).type(responseType).send(responseBody);
    } catch {
      return res.status(502).json({ error: 'Não foi possível conectar ao backend do Personas. Tente novamente.' });
    }
  });

  // Presence is session based; old heartbeats expire if a tab closes unexpectedly.
  app.get('/api/presence', (_req, res) => {
    res.json(getPresenceSnapshot());
  });

  app.put('/api/presence', (req, res) => {
    const { sessionId, userId } = req.body ?? {};
    if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 160
      || typeof userId !== 'string' || !userId.trim() || userId.length > 160) {
      return res.status(400).json({ error: 'Sessão de presença inválida.' });
    }
    presenceSessions.set(sessionId, { userId, lastSeenAt: Date.now(), endedAt: null });
    return res.json(getPresenceSnapshot());
  });

  app.delete('/api/presence', (req, res) => {
    const sessionId = typeof req.query.sessionId === 'string'
      ? req.query.sessionId
      : req.body?.sessionId;
    if (typeof sessionId === 'string') {
      const existing = presenceSessions.get(sessionId);
      if (existing) presenceSessions.set(sessionId, { ...existing, endedAt: Date.now() });
    }
    return res.json(getPresenceSnapshot());
  });

  // One shared tournament/draft state for all accounts connected to this server.
  app.get('/api/tournament-state', async (_req, res) => {
    await loadSharedTournamentState();
    res.json({ state: sharedTournamentState });
  });

  app.put('/api/tournament-state', async (req, res) => {
    await loadSharedTournamentState();
    const { state, actorId, actorRole } = req.body ?? {};
    if (!state || typeof state !== 'object' || !Number.isFinite(state.updatedAt)
      || !Array.isArray(state.teams) || !Array.isArray(state.attendeeIds)
      || !Array.isArray(state.captainIds) || state.captainIds.length !== 2
      || !Array.isArray(state.playerPoolIds)
      || (state.confirmedDeckCardId !== undefined && state.confirmedDeckCardId !== null && typeof state.confirmedDeckCardId !== 'string')
      || (state.captainRerollRequest != null && !(typeof state.captainRerollRequest.id === 'string'
        && typeof state.captainRerollRequest.requesterId === 'string'
        && typeof state.captainRerollRequest.requesterName === 'string'
        && typeof state.captainRerollRequest.opponentId === 'string'
        && ['waiting_opponent', 'waiting_creator'].includes(state.captainRerollRequest.status)
        && Number.isFinite(state.captainRerollRequest.createdAt)))
      || (state.interClassDraw != null && !(typeof state.interClassDraw.cardId === 'string'
        && ['Magos', 'Lutadores', 'Assassinos', 'Suportes', 'Atiradores', 'Tanks'].includes(state.interClassDraw.blueClass)
        && ['Magos', 'Lutadores', 'Assassinos', 'Suportes', 'Atiradores', 'Tanks'].includes(state.interClassDraw.redClass)
        && state.interClassDraw.blueClass !== state.interClassDraw.redClass
        && Number.isFinite(state.interClassDraw.drawnAt)))
      || !state.attendeeIds.every((id: unknown) => typeof id === 'string')
      || !state.captainIds.every((id: unknown) => typeof id === 'string')
      || !state.playerPoolIds.every((id: unknown) => typeof id === 'string')
      || !state.teams.every((team: { id?: unknown; members?: unknown }) => typeof team?.id === 'string'
        && Array.isArray(team.members)
        && team.members.length <= 5
        && team.members.every((id: unknown) => typeof id === 'string'))
      || !['random', 'predefined', 'balanced', 'captain-draft'].includes(state.draftMode)
      || !['MD1', 'MD3', 'MD5'].includes(state.seriesFormat)
      || !['setup', 'in_progress', 'complete'].includes(state.draftStage)
      || typeof state.tournamentStarted !== 'boolean') {
      return res.status(400).json({ error: 'Estado do torneio inválido.' });
    }

    // The creator account has a stable site identity; a client role label alone is not enough.
    const isCreator = actorId === 'user_nicolas' && actorRole === 'criador';
    const current = sharedTournamentState;
    let mayUpdate = isCreator;

    // Let the first attendee establish the shared registration state before the creator
    // opens the tournament. This request cannot start a draft or add players to teams.
    if (!mayUpdate && !current && typeof actorId === 'string' && !state.tournamentStarted) {
      mayUpdate = state.draftStage === 'setup'
        && state.captainDraftTurn === null
        && state.playerPoolIds.length === 0
        && state.attendeeIds.length === 1
        && state.attendeeIds[0] === actorId
        && state.teams.every((team: { members?: string[] }) => (team.members || []).length <= 5);
    }

    // Players may only confirm or cancel their own attendance before the tournament begins.
    if (!mayUpdate && current && typeof actorId === 'string' && !current.tournamentStarted && !state.tournamentStarted) {
      const previousAttendees = new Set<string>(current.attendeeIds || []);
      const nextAttendees = new Set<string>(state.attendeeIds || []);
      const changedIds = [...new Set([...previousAttendees, ...nextAttendees])]
        .filter((id) => previousAttendees.has(id) !== nextAttendees.has(id));
      const currentWithoutAttendance = { ...current, attendeeIds: [], updatedAt: 0 };
      const nextWithoutAttendance = { ...state, attendeeIds: [], updatedAt: 0 };
      mayUpdate = changedIds.length === 1
        && changedIds[0] === actorId
        && JSON.stringify(currentWithoutAttendance) === JSON.stringify(nextWithoutAttendance);
    }

    if (!mayUpdate && typeof actorId === 'string') {
      mayUpdate = mayChangeCaptainReroll(current, state, actorId);
    }

    // During captain draft, only the captain whose turn is active can add one confirmed player.
    if (!mayUpdate && current && typeof actorId === 'string'
      && current.draftStage === 'in_progress'
      && Number.isInteger(current.captainDraftTurn)
      && current.captainIds?.[current.captainDraftTurn] === actorId) {
      const oldMembers = new Set<string>((current.teams || []).flatMap((team: { members?: string[] }) => team.members || []));
      const newMembers = new Set<string>((state.teams || []).flatMap((team: { members?: string[] }) => team.members || []));
      const addedMembers = [...newMembers].filter((id) => !oldMembers.has(id));
      const removedMembers = [...oldMembers].filter((id) => !newMembers.has(id));
      const selectedPlayerId = addedMembers[0];
      const activeTeam = current.teams[current.captainDraftTurn];
      const selectedActiveTeam = state.teams.find((team: { captainId?: string; members?: string[] }) => team.captainId === actorId);
      const sameTeamDefinitions = state.teams.length === current.teams.length
        && state.teams.every((team: { members?: string[] }, index: number) => {
          const { members: _currentMembers, ...currentDefinition } = current.teams[index];
          const { members: _nextMembers, ...nextDefinition } = team;
          return JSON.stringify(currentDefinition) === JSON.stringify(nextDefinition);
        });
      const expectedPool = (current.playerPoolIds || []).filter((id: string) => id !== selectedPlayerId);
      const otherTeam = current.teams[1 - current.captainDraftTurn];
      const pickedTeam = state.teams.find((team: { captainId?: string }) => team.captainId === actorId);
      const nextPreferredTurn = 1 - current.captainDraftTurn;
      const preferredTeamMembers = state.teams.find((team: { captainId?: string; members?: string[] }) => team.captainId === current.captainIds[nextPreferredTurn])?.members || [];
      const nextTurn = preferredTeamMembers.length < 5
        ? nextPreferredTurn
        : (pickedTeam?.members || []).length < 5 ? current.captainDraftTurn : null;
      const expectedTurn = expectedPool.length ? nextTurn : null;
      const expectedStage = expectedTurn === null ? 'complete' : 'in_progress';
      const sameDraftSetup = state.tournamentStarted === current.tournamentStarted
        && state.attendeeIds.join('|') === (current.attendeeIds || []).join('|')
        && state.captainIds.join('|') === current.captainIds.join('|')
        && state.draftMode === current.draftMode
        && state.seriesFormat === current.seriesFormat
        && JSON.stringify(state.predefinedTeams) === JSON.stringify(current.predefinedTeams)
        && current.draftMode === 'captain-draft'
        && sameTeamDefinitions
        && state.teams.every((team: { members?: string[] }) => (team.members || []).length <= 5);
      mayUpdate = sameDraftSetup
        && addedMembers.length === 1
        && removedMembers.length === 0
        && activeTeam?.captainId === actorId
        && (current.playerPoolIds || []).includes(selectedPlayerId)
        && (current.attendeeIds || []).includes(selectedPlayerId)
        && selectedActiveTeam?.members?.includes(selectedPlayerId)
        && otherTeam
        && JSON.stringify(state.playerPoolIds) === JSON.stringify(expectedPool)
        && state.captainDraftTurn === expectedTurn
        && state.draftStage === expectedStage;
    }

    if (!mayUpdate) return res.status(403).json({ error: 'Você não pode alterar esta etapa do torneio.' });

    if (current && Number(state.updatedAt) <= Number(current.updatedAt)) {
      return res.json({ state: current });
    }

    sharedTournamentState = {
      ...state,
      updatedAt: Math.max(Date.now(), Number(current?.updatedAt || 0) + 1, Number(state.updatedAt)),
    } as Record<string, any>;
    try {
      await persistSharedTournamentState(sharedTournamentState);
    } catch (error) {
      console.error('Não foi possível salvar o estado compartilhado do torneio:', error);
      return res.status(500).json({ error: 'Falha ao salvar o estado do torneio.' });
    }
    return res.json({ state: sharedTournamentState });
  });

  // AI OCR Endpoint for importing one player's latest match statistics.
  app.post('/api/ocr', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/png' } = req.body ?? {};

      if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
        return res.status(400).json({ error: 'Nenhuma imagem foi enviada.' });
      }

      const supportedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
      if (typeof mimeType !== 'string' || !supportedMimeTypes.has(mimeType)) {
        return res.status(415).json({ error: 'Formato não suportado. Use PNG, JPEG ou WebP.' });
      }

      // Clean base64 data
      const cleanBase64 = imageBase64.includes(',')
        ? imageBase64.slice(imageBase64.indexOf(',') + 1)
        : imageBase64;
      if (cleanBase64.length > 20 * 1024 * 1024) {
        return res.status(413).json({ error: 'A imagem precisa ter no máximo 15 MB.' });
      }
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleanBase64)) {
        return res.status(400).json({ error: 'A imagem enviada está em um formato inválido.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        const ocrApiUrl = process.env.PERSONAS_OCR_API_URL;
        if (ocrApiUrl) {
          let upstreamUrl: URL;
          try {
            upstreamUrl = new URL(ocrApiUrl);
          } catch {
            return res.status(503).json({ success: false, error: 'A URL de OCR remoto está inválida.' });
          }
          if (upstreamUrl.protocol !== 'https:' || upstreamUrl.hostname !== 'personas-mu.vercel.app' || upstreamUrl.pathname !== '/api/ocr') {
            return res.status(503).json({ success: false, error: 'A URL de OCR remoto precisa apontar para um endpoint HTTPS /api/ocr.' });
          }

          try {
            const authorization = req.get('authorization');
            const upstreamResponse = await fetch(upstreamUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authorization ? { Authorization: authorization } : {}),
              },
              body: JSON.stringify({ imageBase64, mimeType }),
            });
            const responseBody = await upstreamResponse.text();
            const responseType = upstreamResponse.headers.get('content-type')?.split(';', 1)[0] || 'application/json';
            return res.status(upstreamResponse.status).type(responseType).send(responseBody);
          } catch {
            return res.status(502).json({ success: false, error: 'Não foi possível conectar ao serviço de OCR. Tente novamente.' });
          }
        }
        return res.status(503).json({ success: false, error: 'O OCR não está configurado neste servidor. Configure GEMINI_API_KEY.' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Leia o print de uma partida de League of Legends. Extraia APENAS os dados do jogador identificado no cabeçalho/linha de estatísticas da imagem. Não extraia votos, médias, dados de outros jogadores, itens ou estatísticas que não foram pedidas.
Responda somente um objeto JSON válido, sem Markdown, no formato:
{"playerName":"nome exatamente como aparece","kills":0,"deaths":0,"assists":0,"minions":0,"gold":0,"notes":""}
Interprete o KDA como abates/mortes/assistências, nesta ordem. Minions é o total de tropas abatidas (CS). Gold é ouro total. Retorne todos os números como inteiros sem separadores de milhar (por exemplo, ouro 23.941 vira 23941). Se um dado não estiver legível ou visível, retorne null para esse campo. Não adivinhe e não invente valores. O nome deve ser o nome do jogador visível na linha escolhida; se não estiver legível, use null.`;

      const response = await generateOcrWithFallback((model) => ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: mimeType
                }
              }
            ]
          }
        ]
      }));

      const text = response.text || '';
      const data = parseOcrMatchStats(text);
      return res.json({ success: true, source: 'gemini_vision', data });
    } catch (err: unknown) {
      console.error('Erro no OCR:', err);
      const result = getGeminiOcrError(err);
      return res.status(result.status).json({ success: false, error: result.message });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'Personas', time: new Date().toISOString() });
  });

  // Vite integration
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Personas dev server rodando na porta ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
