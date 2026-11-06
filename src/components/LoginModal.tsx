import React, { useState } from 'react';
import type { User } from '../types';
import { sound } from '../utils/audio';
import { normalizeEmail, normalizeHandle, normalizeRiotId, validateUniqueUserIdentity } from '../utils/userIdentity';
import { supabase, loadAuthenticatedProfile, isSharedAccountsEnabled } from '../lib/supabase';
import { LogIn, X, Crown, AlertCircle, UserPlus, LoaderCircle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onLoginSuccess: (user: User) => void;
}

type Mode = 'login' | 'register';

const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none';

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, users, onLoginSuccess }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [login, setLogin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [riotId, setRiotId] = useState('');
  const [primaryLane, setPrimaryLane] = useState<User['primaryLane']>('PREENCHER');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    setNotice(null);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!supabase) {
      setError('O login não está disponível neste endereço local porque ele não está conectado ao sistema de contas.');
      return;
    }

    setLoading(true);
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('auth-login', {
        body: { login: login.trim(), password },
      });
      if (invokeError) throw new Error('Não foi possível entrar agora. Confira seu login e tente novamente.');
      if (!result?.session) throw new Error(result?.error || 'Login ou senha inválidos.');
      const { data, error: sessionError } = await supabase.auth.setSession(result.session);
      if (sessionError || !data.user) throw sessionError || new Error('Não foi possível entrar.');
      const user = await loadAuthenticatedProfile(data.user);
      sound.playVictory();
      onLoginSuccess(user);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!isSharedAccountsEnabled || !supabase) {
      setError('O cadastro não está disponível neste endereço local porque ele não está conectado ao sistema de contas.');
      return;
    }

    const normalizedHandle = normalizeHandle(login);
    const normalizedLogin = normalizedHandle.slice(1);
    const normalizedEmail = normalizeEmail(email);
    const normalizedRiotId = normalizeRiotId(riotId);
    if (name.trim().length < 2) return setError('Informe seu nome no site.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setError('Informe um e-mail válido.');
    if (!/^[a-z0-9._-]{2,24}$/.test(normalizedLogin)) {
      return setError('O login deve ter de 2 a 24 caracteres: letras, números, ponto, hífen ou sublinhado.');
    }
    if (!normalizedRiotId || !normalizedRiotId.includes('#')) return setError('Informe seu Riot ID no formato Nome#TAG.');
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');

    const candidate: User = {
      id: '__novo_cadastro__', handle: normalizedHandle, name: name.trim(), email: normalizedEmail,
      role: 'jogador', isOnline: false, avatar: '', bio: '', favoriteChampion: '', primaryLane,
      riotId: normalizedRiotId, currentScore: 0, totalVotes: 0, seasonsPlayed: 0, mvpCount: 0,
      aceCount: 0, stats: { kills: 0, deaths: 0, assists: 0, wards: 0, damageDealt: 0, damageReceived: 0 },
      entryDate: new Date().toLocaleDateString('pt-BR'), createdAt: new Date().toISOString(), comments: [],
    };
    const creatorId = users.find((user) => user.role === 'criador')?.id || '';
    const identityError = validateUniqueUserIdentity(users, candidate, creatorId);
    // The database trigger restricts this reserved profile to the configured creator e-mail.
    if (identityError && normalizedHandle !== '@nick') {
      return setError(identityError
        .replace(/O @([^ ]+) já pertence/, 'O login "$1" já pertence')
        .replace('Escolha outro @.', 'Escolha outro login.')
        .replace('Esse login é reservado à conta do criador.', 'Esse login é reservado à conta do criador.'));
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            name: name.trim(),
            handle: normalizedHandle,
            login: normalizedLogin,
            riot_id: normalizedRiotId,
            primary_lane: primaryLane,
          },
        },
      });
      if (authError) {
        if (authError.code === '23505' || /duplicate|already|reserved|pertence/i.test(authError.message)) {
          throw new Error('Esse login ou Riot ID já está em uso ou pertence a um perfil oficial.');
        }
        throw authError;
      }

      if (data.session && data.user) {
        const user = await loadAuthenticatedProfile(data.user);
        sound.playVictory();
        onLoginSuccess(user);
        onClose();
      } else {
        setNotice('Cadastro criado. Confira seu e-mail para confirmar a conta e depois entre no Personas.');
        setMode('login');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-red-700/60 bg-slate-950 p-6 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-700/60 bg-red-950 text-amber-400 shadow-lg">
            <Crown className="h-6 w-6" />
          </div>
          <h2 id="auth-title" className="font-display text-xl font-black text-white">{mode === 'login' ? 'Login Personas' : 'Criar conta'}</h2>
          <p className="mt-1 text-xs text-slate-400">{mode === 'login' ? 'Entre com seu login e senha.' : 'Seu perfil ficará disponível para toda a comunidade.'}</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-1">
          <button type="button" onClick={() => changeMode('login')} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'login' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}>Entrar</button>
          <button type="button" onClick={() => changeMode('register')} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'register' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}>Cadastrar</button>
        </div>

        {!isSharedAccountsEnabled && (
          <div className="mb-4 rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-xs leading-relaxed text-amber-200">
            Este endereço local ainda não está conectado ao sistema de contas. Login e cadastro só funcionam em um ambiente configurado.
          </div>
        )}
        {error && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-600/60 bg-red-950/60 p-3 text-xs text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /><span>{error}</span></div>}
        {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-700/60 bg-emerald-950/40 p-3 text-xs leading-relaxed text-emerald-200">{notice}</div>}

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-3.5">
          {mode === 'register' && <>
            <label className="block text-xs font-semibold text-slate-300">Nome<input className={`${inputClass} mt-1`} value={name} onChange={(event) => setName(event.target.value)} maxLength={48} autoComplete="name" required /></label>
            <label className="block text-xs font-semibold text-slate-300">Login<input className={`${inputClass} mt-1`} value={login} onChange={(event) => setLogin(event.target.value)} placeholder="Escolha seu login" maxLength={24} autoComplete="username" required /></label>
          </>}
          {mode === 'login'
            ? <label className="block text-xs font-semibold text-slate-300">Login<input className={`${inputClass} mt-1`} value={login} onChange={(event) => setLogin(event.target.value)} placeholder="Seu login" autoComplete="username" required /></label>
            : <label className="block text-xs font-semibold text-slate-300">E-mail<input type="email" className={`${inputClass} mt-1`} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>}
          {mode === 'register' && <>
            <label className="block text-xs font-semibold text-slate-300">Riot ID<input className={`${inputClass} mt-1`} value={riotId} onChange={(event) => setRiotId(event.target.value)} placeholder="Nome#TAG" maxLength={32} required /></label>
            <label className="block text-xs font-semibold text-slate-300">Rota principal<select className={`${inputClass} mt-1`} value={primaryLane} onChange={(event) => setPrimaryLane(event.target.value as User['primaryLane'])}><option value="PREENCHER">Preencher</option><option value="TOP">Top</option><option value="JUNGLE">Jungle</option><option value="MID">Mid</option><option value="ADC">ADC</option><option value="SUPORTE">Suporte</option></select></label>
          </>}
          <label className="block text-xs font-semibold text-slate-300">Senha<input type="password" className={`${inputClass} mt-1 font-mono`} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : undefined} required /></label>
          <button type="submit" disabled={loading || (mode === 'register' && !isSharedAccountsEnabled)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3 text-sm font-bold text-white shadow-lg shadow-red-950 transition hover:from-red-500 hover:to-rose-500 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar na Plataforma' : 'Criar conta Personas'}
          </button>
        </form>
      </section>
    </div>
  );
};
