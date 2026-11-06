import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const attemptWindowMs = 15 * 60 * 1000;
const maxAttemptsPerWindow = 12;
const attemptsByIp = new Map<string, { count: number; resetAt: number }>();
const loginAliases: Record<string, string> = { nicolaslike: "@nick" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function allowAttempt(ip: string): boolean {
  const now = Date.now();
  const current = attemptsByIp.get(ip);
  if (!current || current.resetAt <= now) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + attemptWindowMs });
    if (attemptsByIp.size > 5000) {
      for (const [key, value] of attemptsByIp) {
        if (value.resetAt <= now) attemptsByIp.delete(key);
      }
    }
    return true;
  }
  if (current.count >= maxAttemptsPerWindow) return false;
  current.count += 1;
  return true;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  if (!allowAttempt(ip)) {
    return jsonResponse({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, 429);
  }

  let body: { login?: unknown; password?: unknown };
  try {
    if (Number(request.headers.get("content-length") || 0) > 4096) {
      return jsonResponse({ error: "Login ou senha inválidos." }, 401);
    }
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Login ou senha inválidos." }, 401);
  }

  const login = typeof body.login === "string"
    ? body.login.trim().replace(/^@+/, "").toLocaleLowerCase("pt-BR")
    : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[a-z0-9._-]{2,24}$/.test(login) || !password || password.length > 256) {
    return jsonResponse({ error: "Login ou senha inválidos." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !serviceRoleKey || !publicKey) {
    return jsonResponse({ error: "Login compartilhado indisponível no momento." }, 503);
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id")
      .eq("handle", loginAliases[login] || `@${login}`)
      .maybeSingle();
    if (profileError || !profile) return jsonResponse({ error: "Login ou senha inválidos." }, 401);

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
    const email = userData.user?.email;
    if (userError || !email) return jsonResponse({ error: "Login ou senha inválidos." }, 401);

    const authResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: publicKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!authResponse.ok) return jsonResponse({ error: "Login ou senha inválidos." }, 401);

    const authResult = await authResponse.json();
    if (!authResult.access_token || !authResult.refresh_token) {
      return jsonResponse({ error: "Login ou senha inválidos." }, 401);
    }
    return jsonResponse({
      session: {
        access_token: authResult.access_token,
        refresh_token: authResult.refresh_token,
      },
    });
  } catch (error) {
    console.error("Falha ao autenticar pelo login:", error);
    return jsonResponse({ error: "Não foi possível entrar agora. Tente novamente." }, 503);
  }
});
