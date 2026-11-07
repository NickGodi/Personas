import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { signInWithLogin } from './authLogin';

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 5;
const attemptsByIp = new Map<string, { count: number; resetAt: number }>();

type RegisterResult = {
  status: number;
  body: { error: string } | { session: { access_token: string; refresh_token: string } };
};

async function isRegisteredProfileActive(
  admin: SupabaseClient<any, 'public', 'public', any, any>,
  profileId: string,
): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserById(profileId);
  if (!error && data.user) return true;

  // Older delete flows removed the Auth account but left its public profile
  // behind. Clean that orphan before enforcing the unique login/Riot ID checks.
  const isMissingAuthUser = error && (
    error.status === 404
    || error.code === 'user_not_found'
    || /user.*not found|not found.*user/i.test(error.message)
  );
  if (!isMissingAuthUser) {
    if (error) throw error;
    return false;
  }

  const { error: cleanupError } = await admin.from('profiles').delete().eq('id', profileId);
  if (cleanupError) throw cleanupError;
  return false;
}

function allowAttempt(ip: string) {
  const now = Date.now();
  const previous = attemptsByIp.get(ip);
  if (!previous || previous.resetAt <= now) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    if (attemptsByIp.size > 5_000) {
      for (const [key, attempt] of attemptsByIp) if (attempt.resetAt <= now) attemptsByIp.delete(key);
    }
    return true;
  }
  if (previous.count >= MAX_ATTEMPTS_PER_WINDOW) return false;
  previous.count += 1;
  return true;
}

export async function registerWithLogin(input: Record<string, unknown>, ip = 'unknown'): Promise<RegisterResult> {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return { status: 503, body: { error: 'O cadastro compartilhado não está disponível neste momento.' } };
  }
  if (!allowAttempt(ip)) return { status: 429, body: { error: 'Muitas tentativas de cadastro. Aguarde alguns minutos.' } };

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const login = typeof input.login === 'string'
    ? input.login.trim().replace(/^@+/, '').toLocaleLowerCase('pt-BR')
    : '';
  const riotId = typeof input.riotId === 'string'
    ? input.riotId.trim().replace(/\s*#\s*/g, '#').toLocaleLowerCase('pt-BR')
    : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const lane = typeof input.primaryLane === 'string' ? input.primaryLane : 'PREENCHER';
  if (name.length < 2 || name.length > 48) return { status: 400, body: { error: 'Informe um nome entre 2 e 48 caracteres.' } };
  if (!/^[a-z0-9._-]{2,24}$/.test(login)) return { status: 400, body: { error: 'O login deve ter de 2 a 24 caracteres: letras, números, ponto, hífen ou sublinhado.' } };
  if (!riotId || riotId.length > 32 || !/^[^#]+#[^#]+$/.test(riotId)) return { status: 400, body: { error: 'Informe seu Riot ID no formato Nome#TAG.' } };
  if (password.length < 8 || password.length > 128) return { status: 400, body: { error: 'A senha precisa ter entre 8 e 128 caracteres.' } };
  if (!['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPORTE', 'PREENCHER'].includes(lane)) return { status: 400, body: { error: 'Selecione uma rota válida.' } };

  const internalHandle = `@${login}`;
  if (['@nicolas', '@nicolaslike'].includes(internalHandle)) {
    return { status: 409, body: { error: 'Esse login é reservado à conta do criador.' } };
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: existingHandle, error: handleError } = await admin.from('profiles')
      .select('id').eq('handle', internalHandle).maybeSingle();
    if (handleError) throw handleError;
    if (existingHandle && await isRegisteredProfileActive(admin, existingHandle.id)) {
      return { status: 409, body: { error: 'Esse login já está em uso. Escolha outro login.' } };
    }

    const { data: existingRiotId, error: riotError } = await admin.from('profiles')
      .select('id').eq('riot_id', riotId).maybeSingle();
    if (riotError) throw riotError;
    if (existingRiotId && await isRegisteredProfileActive(admin, existingRiotId.id)) {
      return { status: 409, body: { error: 'Esse Riot ID já está em uso.' } };
    }

    // Supabase Auth requires an e-mail internally. This private synthetic address is
    // never shown or used for login, verification, or user-facing communication.
    const privateAuthEmail = `login-${randomUUID()}@accounts.personas.invalid`;
    const { data, error } = await admin.auth.admin.createUser({
      email: privateAuthEmail,
      email_confirm: true,
      password,
      user_metadata: { name, handle: internalHandle, login, riot_id: riotId, primary_lane: lane },
    });
    if (error || !data.user) {
      if (error && /duplicate|already|unique|23505/i.test(`${error.code || ''} ${error.message}`)) {
        return { status: 409, body: { error: 'Esse login ou Riot ID já está em uso.' } };
      }
      console.error('Falha ao criar conta Personas:', error);
      return { status: 503, body: { error: 'Não foi possível criar a conta agora. Tente novamente.' } };
    }

    // Return an authenticated session so registration finishes directly in the app.
    const signIn = await signInWithLogin(login, password, ip);
    if (signIn.status !== 200 || !('session' in signIn.body)) {
      console.error('Conta criada, mas não foi possível iniciar a sessão após o cadastro.', signIn.body);
      return { status: 201, body: { error: 'Conta criada. Entre usando seu login e senha.' } };
    }
    return { status: 201, body: signIn.body };
  } catch (error) {
    console.error('Falha ao cadastrar com login:', error);
    return { status: 503, body: { error: 'O cadastro não está disponível agora. Tente novamente.' } };
  }
}
