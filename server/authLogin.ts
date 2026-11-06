import { createClient } from '@supabase/supabase-js';

let serverConfig: {
  supabaseUrl: string;
  anonKey: string;
  admin: any | null;
} | null = null;

function getServerConfig(): NonNullable<typeof serverConfig> {
  if (serverConfig) return serverConfig;
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const admin = supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  const config = { supabaseUrl, anonKey, admin };
  serverConfig = config;
  return config;
}

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 12;
const attemptsByIp = new Map<string, { count: number; resetAt: number }>();
const LOGIN_HANDLE_ALIASES: Record<string, string> = { nicolaslike: '@nick' };

type LoginResult = { status: number; body: { error: string } | { session: { access_token: string; refresh_token: string } } };

function allowAttempt(ip: string): boolean {
  const now = Date.now();
  const previous = attemptsByIp.get(ip);
  if (!previous || previous.resetAt <= now) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    if (attemptsByIp.size > 5_000) {
      for (const [key, attempts] of attemptsByIp) {
        if (attempts.resetAt <= now) attemptsByIp.delete(key);
      }
    }
    return true;
  }
  if (previous.count >= MAX_ATTEMPTS_PER_WINDOW) return false;
  previous.count += 1;
  return true;
}

export async function signInWithLogin(loginValue: unknown, passwordValue: unknown, ip = 'unknown'): Promise<LoginResult> {
  const { supabaseUrl, anonKey, admin } = getServerConfig();
  if (!admin || !supabaseUrl || !anonKey) {
    return { status: 503, body: { error: 'Login compartilhado indisponível no momento.' } };
  }
  if (!allowAttempt(ip)) {
    return { status: 429, body: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' } };
  }

  const login = typeof loginValue === 'string'
    ? loginValue.trim().replace(/^@+/, '').toLocaleLowerCase('pt-BR')
    : '';
  const password = typeof passwordValue === 'string' ? passwordValue : '';
  if (!/^[a-z0-9._-]{2,24}$/.test(login) || !password || password.length > 256) {
    return { status: 401, body: { error: 'Login ou senha inválidos.' } };
  }

  try {
    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('id').eq('handle', LOGIN_HANDLE_ALIASES[login] || `@${login}`).maybeSingle();
    if (profileError) {
      console.error('Falha ao localizar o login:', profileError);
      return { status: 503, body: { error: 'Não foi possível verificar o login agora.' } };
    }
    if (!profile) return { status: 401, body: { error: 'Login ou senha inválidos.' } };

    const { data: authData, error: userError } = await admin.auth.admin.getUserById(profile.id);
    const email = authData.user?.email;
    if (userError || !email) return { status: 401, body: { error: 'Login ou senha inválidos.' } };

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!authResponse.ok) return { status: 401, body: { error: 'Login ou senha inválidos.' } };

    const authResult = await authResponse.json() as { access_token?: string; refresh_token?: string };
    if (!authResult.access_token || !authResult.refresh_token) {
      return { status: 401, body: { error: 'Login ou senha inválidos.' } };
    }
    return {
      status: 200,
      body: { session: { access_token: authResult.access_token, refresh_token: authResult.refresh_token } },
    };
  } catch (error) {
    console.error('Falha ao autenticar pelo login:', error);
    return { status: 503, body: { error: 'Não foi possível entrar agora. Tente novamente.' } };
  }
}
