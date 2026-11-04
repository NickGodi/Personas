import React from 'react';
import { Lane, User, VoteRecord } from '../types';
import { Award, Check, MessageSquare, Plus, RotateCcw, ShieldAlert, Sparkles, UserPlus, Users, X } from 'lucide-react';

interface VotingSectionProps {
  users: User[];
  currentUser: User | null;
  recentVotes: VoteRecord[];
  activeSeasonNumber: number;
  attendeeIds: string[];
  canManageAttendance: boolean;
  canManagePlayers: boolean;
  canResetRatings: boolean;
  onToggleAttendance: (userId: string) => void;
  onResetPlayerRating: (userId: string) => void;
  onResetSeasonRatings: () => void;
  onAddPlayer: (player: { name: string; handle: string; email?: string; riotId: string; primaryLane: Lane }) => string | null;
  onOpenProfile: (user: User) => void;
}

export const VotingSection: React.FC<VotingSectionProps> = ({ users, currentUser, recentVotes, activeSeasonNumber, attendeeIds, canManageAttendance, canManagePlayers, canResetRatings, onToggleAttendance, onResetPlayerRating, onResetSeasonRatings, onAddPlayer, onOpenProfile }) => {
  const [isAddPlayerOpen, setIsAddPlayerOpen] = React.useState(false);
  const [newPlayerName, setNewPlayerName] = React.useState('');
  const [newPlayerHandle, setNewPlayerHandle] = React.useState('');
  const [newPlayerEmail, setNewPlayerEmail] = React.useState('');
  const [newPlayerRiotId, setNewPlayerRiotId] = React.useState('');
  const [newPlayerLane, setNewPlayerLane] = React.useState<Lane>('PREENCHER');
  const [addPlayerError, setAddPlayerError] = React.useState('');
  const seasonVotes = recentVotes.filter((vote) => vote.season === activeSeasonNumber);
  const totals = new Map<string, { sum: number; count: number }>();
  seasonVotes.forEach((vote) => {
    const total = totals.get(vote.targetUserId) || { sum: 0, count: 0 };
    total.sum += vote.score;
    total.count += 1;
    totals.set(vote.targetUserId, total);
  });
  const ranking = users.map((user) => {
    const total = totals.get(user.id);
    return { user, average: total ? Math.round(total.sum / total.count) : null, voteCount: total?.count || 0 };
  }).sort((a, b) => {
    if (a.average === null && b.average !== null) return 1;
    if (a.average !== null && b.average === null) return -1;
    if (a.average !== null && b.average !== null && a.average !== b.average) return b.average - a.average;
    return a.user.name.localeCompare(b.user.name, 'pt-BR');
  });
  const ratedPlayers = ranking.filter((entry): entry is typeof entry & { average: number } => entry.average !== null);
  const middlePlayer = ratedPlayers.length >= 3 ? ratedPlayers[Math.floor(ratedPlayers.length / 2)] : null;
  const lowPlayer = ratedPlayers.length >= 2 ? ratedPlayers[ratedPlayers.length - 1] : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-red-900/40 bg-gradient-to-r from-red-950/50 via-slate-950 to-slate-950 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">Elenco da comunidade</p>
          <h1 className="mt-1 font-display text-2xl font-black text-white">Jogadores</h1>
          <p className="mt-1 text-sm text-slate-400">Abra um perfil para acompanhar estatísticas, cartas, temporadas e comentários.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
          <Users className="h-4 w-4 text-amber-400" /> {users.length} jogadores
        </div>
      </header>

      {ratedPlayers.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-5 text-center text-sm text-slate-400">
          Aguardando os primeiros votos da temporada para calcular as médias e destacar jogadores.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <HighlightCard label="Maior média" user={ratedPlayers[0].user} value={ratedPlayers[0].average} icon={<Sparkles className="h-5 w-5" />} color="amber" onOpenProfile={onOpenProfile} />
          {middlePlayer && <HighlightCard label="Em destaque" user={middlePlayer.user} value={middlePlayer.average} icon={<Award className="h-5 w-5" />} color="sky" onOpenProfile={onOpenProfile} />}
          {lowPlayer && <HighlightCard label="Menor média" user={lowPlayer.user} value={lowPlayer.average} icon={<ShieldAlert className="h-5 w-5" />} color="red" onOpenProfile={onOpenProfile} />}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="font-display text-sm font-bold text-white">{ratedPlayers.length ? 'Classificação atual' : 'Jogadores da comunidade'}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{ratedPlayers.length ? `Médias calculadas com os votos da temporada ${activeSeasonNumber}.` : 'Ainda não há votos; os jogadores aparecem em ordem alfabética.'}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {canResetRatings && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Zerar todas as notas e votos da temporada ${activeSeasonNumber}? As temporadas já encerradas serão mantidas.`)) onResetSeasonRatings();
                }}
                title={`Apagar votos e médias da temporada ${activeSeasonNumber}; temporadas encerradas serão mantidas`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-700/50 bg-red-950/40 px-2.5 py-1.5 text-[10px] font-bold text-red-200 transition hover:border-red-500 hover:bg-red-900/50 sm:text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Zerar médias
              </button>
            )}
            {canManagePlayers && (
              <button
                type="button"
                onClick={() => { setIsAddPlayerOpen((open) => !open); setAddPlayerError(''); }}
                aria-expanded={isAddPlayerOpen}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-600/40 bg-amber-950/40 px-2.5 py-1.5 text-[10px] font-bold text-amber-200 transition hover:border-amber-400 hover:bg-amber-900/50 sm:text-xs"
              >
                {isAddPlayerOpen ? <X className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                {isAddPlayerOpen ? 'Fechar' : 'Adicionar jogador'}
              </button>
            )}
            <span className="hidden font-mono text-[10px] text-slate-500 sm:inline">TEMPORADA ATIVA</span>
          </div>
        </div>
        {canManagePlayers && isAddPlayerOpen && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const name = newPlayerName.trim();
              const handle = `@${newPlayerHandle.trim().replace(/^@+/, '')}`;
              if (!name || handle.length < 2) {
                setAddPlayerError('Informe o nome e um @ válido.');
                return;
              }
              if (users.some((user) => user.handle.toLowerCase() === handle.toLowerCase())) {
                setAddPlayerError('Esse @ já está em uso por outro jogador.');
                return;
              }
              const error = onAddPlayer({
                name,
                handle,
                email: newPlayerEmail.trim(),
                riotId: newPlayerRiotId.trim(),
                primaryLane: newPlayerLane,
              });
              if (error) {
                setAddPlayerError(error);
                return;
              }
              setNewPlayerName('');
              setNewPlayerHandle('');
              setNewPlayerEmail('');
              setNewPlayerRiotId('');
              setNewPlayerLane('PREENCHER');
              setAddPlayerError('');
              setIsAddPlayerOpen(false);
            }}
            className="grid gap-2 border-b border-slate-800 bg-slate-900/40 p-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.2fr_1fr_0.8fr_auto]"
          >
            <label className="text-[10px] font-semibold text-slate-400">
              Nome do jogador *
              <input required value={newPlayerName} onChange={(event) => setNewPlayerName(event.target.value)} placeholder="Ex.: Alex" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600" />
            </label>
            <label className="text-[10px] font-semibold text-slate-400">
              @ do jogador *
              <input required value={newPlayerHandle} onChange={(event) => setNewPlayerHandle(event.target.value)} placeholder="@alex" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600" />
            </label>
            <label className="text-[10px] font-semibold text-slate-400">
              E-mail de login (opcional)
              <input type="email" value={newPlayerEmail} onChange={(event) => setNewPlayerEmail(event.target.value)} placeholder="alex@exemplo.com" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600" />
            </label>
            <label className="text-[10px] font-semibold text-slate-400">
              Riot ID
              <input value={newPlayerRiotId} onChange={(event) => setNewPlayerRiotId(event.target.value)} placeholder="Alex#BR1" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600" />
            </label>
            <label className="text-[10px] font-semibold text-slate-400">
              Rota principal
              <select value={newPlayerLane} onChange={(event) => setNewPlayerLane(event.target.value as Lane)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
                {(['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPORTE', 'PREENCHER'] as Lane[]).map((lane) => <option key={lane} value={lane}>{lane === 'JUNGLE' ? 'Jungler' : lane === 'PREENCHER' ? 'Preencher' : lane}</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <button type="submit" className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-400 sm:w-auto">
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
            {addPlayerError && <p role="alert" className="text-xs font-semibold text-rose-300 sm:col-span-2 lg:col-span-5">{addPlayerError}</p>}
            <p className="text-[10px] text-slate-500 sm:col-span-2 lg:col-span-5">O jogador entra sem média e sem check-in. Você pode marcar presença separadamente.</p>
          </form>
        )}
        <div className="divide-y divide-slate-800/80">
          {ranking.map(({ user, average, voteCount }, index) => (
            <div key={user.id} className="flex w-full items-center gap-2 px-3 py-2.5 transition-colors hover:bg-slate-900/50 sm:gap-3 sm:px-4 sm:py-3">
              <button type="button" onClick={() => onOpenProfile(user)} className="group flex min-w-0 flex-1 items-center gap-2 text-left sm:gap-4">
                <span className="relative h-9 w-9 shrink-0">
                  <img
                    src={user.avatar}
                    alt={`Foto de perfil de ${user.name}`}
                    className="h-full w-full rounded-lg border border-slate-700 object-cover"
                  />
                  {average !== null && (
                    <span className={`absolute -right-1.5 -top-1.5 rounded-md border border-slate-950 px-1 font-mono text-[8px] font-black ${index < 3 ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 text-slate-200'}`}>
                      {String(ratedPlayers.findIndex((entry) => entry.user.id === user.id) + 1).padStart(2, '0')}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white group-hover:text-amber-300">{user.name}</span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-500">{user.handle} · {voteCount} {voteCount === 1 ? 'voto' : 'votos'} · {user.comments?.length || 0} comentários</span>
                </span>
                <span className="hidden w-28 sm:block">
                  {average === null ? <span className="text-[10px] text-slate-500">Sem média</span> : <>
                    <span className="mb-1 block text-[9px] uppercase tracking-wider text-slate-500">Média</span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <span className="block h-full rounded-full bg-gradient-to-r from-red-600 to-amber-400" style={{ width: `${average}%` }} />
                    </span>
                  </>}
                </span>
                <span className={`w-10 shrink-0 text-right font-mono text-base font-black sm:w-12 sm:text-lg ${average === null ? 'text-slate-600' : 'text-amber-300'}`}>{average ?? '—'}</span>
                <span className="hidden shrink-0 text-xs text-red-300 sm:inline">Ver perfil →</span>
              </button>
              {canManageAttendance && (
                <button
                  type="button"
                  onClick={() => onToggleAttendance(user.id)}
                  aria-pressed={attendeeIds.includes(user.id)}
                  aria-label={attendeeIds.includes(user.id) ? `Cancelar check-in de ${user.name}` : `Confirmar presença de ${user.name}`}
                  title={attendeeIds.includes(user.id) ? `Cancelar check-in de ${user.name}` : `Confirmar presença de ${user.name} e disponibilizar em Times`}
                  className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-lg border px-2 text-[10px] font-bold transition-colors sm:px-2.5 ${attendeeIds.includes(user.id)
                    ? 'border-emerald-700/50 bg-emerald-950/50 text-emerald-200 hover:bg-red-950/50 hover:text-red-300'
                    : 'border-amber-600/40 bg-amber-950/40 text-amber-200 hover:border-amber-400 hover:bg-amber-900/50'}`}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{attendeeIds.includes(user.id) ? 'Presente' : 'Check-in'}</span>
                </button>
              )}
              {canResetRatings && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Zerar os votos e a média de ${user.name} na temporada ${activeSeasonNumber}? O histórico das temporadas encerradas será mantido.`)) onResetPlayerRating(user.id);
                  }}
                  aria-label={`Zerar média de ${user.name} na temporada ${activeSeasonNumber}`}
                  title={`Zerar média de ${user.name} nesta temporada`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/30 text-red-300 transition hover:border-red-500 hover:bg-red-900/50"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {recentVotes.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-rose-400" />
            <h2 className="font-display text-sm font-bold text-white">Atividade recente</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...recentVotes].slice(-6).reverse().map((vote) => {
              const target = users.find((user) => user.id === vote.targetUserId);
              return (
                <button key={vote.id} type="button" onClick={() => target && onOpenProfile(target)} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-left transition hover:border-rose-800">
                  <span className="flex items-center justify-between gap-2 text-xs"><strong className="truncate text-white">{vote.fromUserName} avaliou {vote.targetUserName}</strong><span className="shrink-0 font-mono font-bold text-amber-300">{vote.score}</span></span>
                  {vote.comment && <span className="mt-1.5 block line-clamp-2 text-xs text-slate-400">{vote.comment}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!currentUser && <p className="text-center text-xs text-slate-500">Entre para avaliar ou comentar nos perfis.</p>}
    </div>
  );
};

const HighlightCard: React.FC<{
  label: string;
  user: User;
  value: number;
  icon: React.ReactNode;
  color: 'amber' | 'sky' | 'red';
  onOpenProfile: (user: User) => void;
}> = ({ label, user, value, icon, color, onOpenProfile }) => {
  const styles = {
    amber: 'border-amber-700/40 bg-amber-950/20 text-amber-300',
    sky: 'border-sky-700/40 bg-sky-950/20 text-sky-300',
    red: 'border-red-700/40 bg-red-950/20 text-red-300',
  }[color];

  return (
    <button type="button" onClick={() => onOpenProfile(user)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:bg-slate-900 ${styles}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/30">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-mono uppercase tracking-wider opacity-80">{label}</span>
        <span className="mt-0.5 block truncate text-sm font-bold text-white">{user.name}</span>
      </span>
      <span className="font-mono text-xl font-black">{value}</span>
    </button>
  );
};
