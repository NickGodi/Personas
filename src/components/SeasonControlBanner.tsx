import React, { useEffect, useState } from 'react';
import { ActiveSeason, User } from '../types';
import { Check, Clock3, Flag, Play, Save, Users } from 'lucide-react';

interface SeasonControlBannerProps {
  activeSeason: ActiveSeason;
  canManageSeason: boolean;
  checkInOpen: boolean;
  isCheckedIn: boolean;
  checkInCount: number;
  checkedInPlayers: Array<Pick<User, 'id' | 'name'>>;
  checkInDisabled: boolean;
  onCheckIn: () => void;
  onStart: () => void;
  onFinish: () => void;
}

export const SeasonControlBanner: React.FC<SeasonControlBannerProps> = ({
  activeSeason,
  canManageSeason,
  checkInOpen,
  isCheckedIn,
  checkInCount,
  checkedInPlayers,
  checkInDisabled,
  onCheckIn,
  onStart,
  onFinish,
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (activeSeason.status !== 'active') return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeSeason.status, activeSeason.endsAt]);

  const remaining = activeSeason.endsAt
    ? Math.max(0, new Date(activeSeason.endsAt).getTime() - now)
    : 0;
  const countdown = [
    Math.floor(remaining / 3_600_000),
    Math.floor((remaining % 3_600_000) / 60_000),
    Math.floor((remaining % 60_000) / 1000),
  ].map((part) => String(part).padStart(2, '0')).join(':');

  const isActive = activeSeason.status === 'active';

  return (
    <section className={`season-control relative z-10 overflow-hidden rounded-2xl border p-4 shadow-xl backdrop-blur-md sm:p-5 ${isActive ? 'season-control--active' : 'season-control--ready'}`} aria-live="polite">
      <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${isActive ? 'border-emerald-400/30 bg-emerald-950/60 text-emerald-300' : 'border-amber-400/30 bg-amber-950/60 text-amber-300'}`}>
            {isActive ? <Clock3 className="h-6 w-6" /> : <Flag className="h-6 w-6" />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-black uppercase tracking-[0.18em] text-amber-200">Temporada {String(activeSeason.number).padStart(2, '0')}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${isActive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-400/10 text-slate-300'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'animate-pulse bg-emerald-300' : 'bg-slate-400'}`} />
                {isActive ? 'AO VIVO' : 'EM ESPERA'}
              </span>
            </div>
            <h2 className="mt-1 font-display text-lg font-black text-white sm:text-xl">{isActive ? 'Partidas em andamento' : 'Pronta para começar'}</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-slate-300">
              {isActive
                ? `Iniciada em ${activeSeason.startedAt ? new Date(activeSeason.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'agora'} · encerra automaticamente após 7 horas.`
                : checkInOpen
                  ? canManageSeason
                    ? 'Check-in aberto durante o dia. Inicie as partidas quando o grupo estiver pronto; o cronômetro de sete horas começará na hora.'
                    : 'Check-in disponível durante o dia, até o criador iniciar as partidas.'
                  : 'Check-in encerrado. Acompanhe os participantes na aba Times.'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {checkInOpen && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950/60 p-1.5">
              <button
                type="button"
                onClick={onCheckIn}
                disabled={checkInDisabled}
                aria-pressed={isCheckedIn}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition disabled:cursor-wait disabled:opacity-60 ${isCheckedIn
                  ? 'bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                  : 'bg-amber-500 text-slate-950 hover:bg-amber-400'}`}
              >
                {isCheckedIn ? <Check className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
                {isCheckedIn ? 'Check-in confirmado · cancelar' : 'Fazer check-in'}
              </button>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-1 text-[11px] font-semibold text-slate-400" aria-live="polite">
                <Users className="h-3.5 w-3.5 text-sky-300" />
                {checkInCount} {checkInCount === 1 ? 'confirmado' : 'confirmados'}
              </span>
            </div>
          )}
          {isActive && (
            <div className="rounded-xl border border-emerald-400/25 bg-black/25 px-4 py-2 text-center">
              <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-200/70">Tempo restante</span>
              <strong className="block font-mono text-2xl font-black tabular-nums tracking-wider text-emerald-200">{countdown}</strong>
            </div>
          )}
          {canManageSeason && !isActive && (
            <button type="button" onClick={onStart} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/50 transition hover:-translate-y-0.5 hover:from-emerald-400 hover:to-teal-400">
              <Play className="h-4 w-4 fill-current" /> Iniciar temporada
            </button>
          )}
          {canManageSeason && isActive && (
            <button type="button" onClick={onFinish} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-400/35 bg-amber-950/40 px-4 py-2.5 text-sm font-bold text-amber-100 transition hover:border-amber-300/60 hover:bg-amber-900/50">
              <Save className="h-4 w-4" /> Finalizar e salvar
            </button>
          )}
        </div>
      </div>
      {checkedInPlayers.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-700/50 pt-3 sm:pl-[60px]">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Participantes confirmados:</span>
          {checkedInPlayers.map((player) => (
            <span key={player.id} className="rounded-full border border-emerald-800/50 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
              {player.name}
            </span>
          ))}
        </div>
      )}
      {!isActive && checkInOpen && checkInCount === 0 && (
        <p className="mt-3 border-t border-slate-700/50 pt-3 text-xs text-slate-400 sm:pl-[60px]">Ninguém confirmou presença ainda.</p>
      )}
    </section>
  );
};
