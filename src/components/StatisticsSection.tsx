import React, { useEffect, useMemo, useState } from 'react';
import { ActiveSeason, CardItem, EloTier, Lane, MatchRecord, SeasonArchive, User, VoteRecord } from '../types';
import { BarChart3, CalendarClock, CheckCircle2, ScanLine, Search, Trophy } from 'lucide-react';
import { getTierFromScore } from '../data/initialData';
import { RouteDistribution } from './RouteDistribution';

interface StatisticsSectionProps {
  users: User[];
  cards: CardItem[];
  votes: VoteRecord[];
  matchRecords: MatchRecord[];
  activeSeason: ActiveSeason;
  seasonArchives: SeasonArchive[];
  onOpenProfile: (user: User) => void;
  canImportOcr: boolean;
  onOpenOcr: () => void;
}

export const StatisticsSection: React.FC<StatisticsSectionProps> = ({
  users,
  cards,
  votes,
  matchRecords,
  activeSeason,
  seasonArchives,
  onOpenProfile,
  canImportOcr,
  onOpenOcr,
}) => {
  const [activeStatsTab, setActiveStatsTab] = useState<'routes' | 'averages' | 'archives'>('averages');
  const [rankingSearch, setRankingSearch] = useState('');
  const [laneFilter, setLaneFilter] = useState<'all' | Lane>('all');
  const [tierFilter, setTierFilter] = useState<'all' | EloTier>('all');
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState(activeSeason.number);
  const activeCards = cards.filter((card) => card.season === activeSeason.number);
  const activeSeasonVotes = votes.filter((vote) => vote.season === activeSeason.number);
  const average = activeSeasonVotes.length
    ? Math.round(activeSeasonVotes.reduce((sum, vote) => sum + vote.score, 0) / activeSeasonVotes.length)
    : null;
  const totalVotes = activeSeasonVotes.length;
  const availableSeasons = useMemo(() => [...new Set([
    activeSeason.number,
    ...seasonArchives.map((season) => season.number),
    ...votes.map((vote) => vote.season),
    ...matchRecords.map((record) => record.season),
  ])].sort((a, b) => b - a), [activeSeason.number, seasonArchives, votes, matchRecords]);
  useEffect(() => setSelectedSeasonNumber(activeSeason.number), [activeSeason.number]);
  const selectedSeason = availableSeasons.includes(selectedSeasonNumber)
    ? selectedSeasonNumber
    : availableSeasons[0] || activeSeason.number;
  const selectedSeasonVotes = useMemo(
    () => votes.filter((vote) => vote.season === selectedSeason),
    [votes, selectedSeason],
  );
  const selectedSeasonArchive = seasonArchives.find((season) => season.number === selectedSeason);
  const seasonalRanking = useMemo(() => {
    const voteTotals = new Map<string, { sum: number; count: number }>();
    for (const vote of selectedSeasonVotes) {
      const total = voteTotals.get(vote.targetUserId) || { sum: 0, count: 0 };
      total.sum += vote.score;
      total.count += 1;
      voteTotals.set(vote.targetUserId, total);
    }
    const snapshots = new Map((selectedSeasonArchive?.playerSnapshots || []).map((snapshot) => [snapshot.userId, snapshot] as const));

    return users.map((user) => {
      const total = voteTotals.get(user.id);
      const snapshot = snapshots.get(user.id);
      return {
        user,
        average: total ? Math.round(total.sum / total.count) : snapshot?.average ?? null,
        voteCount: total?.count ?? snapshot?.totalVotes ?? 0,
      };
    }).sort((a, b) => {
      if (a.average === null && b.average !== null) return 1;
      if (a.average !== null && b.average === null) return -1;
      if (a.average !== null && b.average !== null && a.average !== b.average) return b.average - a.average;
      return a.user.name.localeCompare(b.user.name, 'pt-BR');
    });
  }, [users, selectedSeasonVotes, selectedSeasonArchive]);
  const seasonalMatchRanking = useMemo(() => {
    const recordsByPlayer = new Map<string, MatchRecord[]>();
    for (const record of matchRecords) {
      if (record.season !== selectedSeason) continue;
      const playerRecords = recordsByPlayer.get(record.playerId) || [];
      playerRecords.push(record);
      recordsByPlayer.set(record.playerId, playerRecords);
    }
    return users.map((user) => {
      const records = recordsByPlayer.get(user.id) || [];
      const count = records.length;
      const totals = records.reduce((sum, record) => ({
        kills: sum.kills + record.stats.kills,
        deaths: sum.deaths + record.stats.deaths,
        assists: sum.assists + record.stats.assists,
        minions: sum.minions + record.stats.minions,
        gold: sum.gold + record.stats.gold,
      }), { kills: 0, deaths: 0, assists: 0, minions: 0, gold: 0 });
      const victories = records.filter((record) => record.result === 'victory').length;
      const defeats = records.filter((record) => record.result === 'defeat').length;
      return {
        user,
        count,
        victories,
        defeats,
        unknownResults: count - victories - defeats,
        averageKills: count ? totals.kills / count : null,
        averageDeaths: count ? totals.deaths / count : null,
        averageAssists: count ? totals.assists / count : null,
        averageMinions: count ? totals.minions / count : null,
        averageGold: count ? totals.gold / count : null,
        kda: count ? (totals.kills + totals.assists) / Math.max(1, totals.deaths) : null,
        winRate: victories + defeats ? victories / (victories + defeats) : null,
      };
    }).sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      if (a.kda !== null && b.kda !== null && a.kda !== b.kda) return b.kda - a.kda;
      if (a.kda !== null && b.kda === null) return -1;
      if (a.kda === null && b.kda !== null) return 1;
      return a.user.name.localeCompare(b.user.name, 'pt-BR');
    });
  }, [users, matchRecords, selectedSeason]);
  const filteredSeasonalRanking = useMemo(() => {
    const query = rankingSearch.trim().toLocaleLowerCase('pt-BR');
    const ratingByPlayer = new Map(seasonalRanking.map(({ user, average: rating }) => [user.id, rating] as const));
    return seasonalMatchRanking
      .filter(({ user }) => !query || `${user.name} ${user.handle} ${user.riotId}`.toLocaleLowerCase('pt-BR').includes(query))
      .filter(({ user }) => laneFilter === 'all' || user.primaryLane === laneFilter)
      .filter(({ user }) => {
        if (tierFilter === 'all') return true;
        const rating = ratingByPlayer.get(user.id);
        return rating !== null && rating !== undefined && getTierFromScore(rating, Boolean(user.isCriminoso)) === tierFilter;
      });
  }, [seasonalMatchRanking, seasonalRanking, rankingSearch, laneFilter, tierFilter]);
  const selectedSeasonRecords = matchRecords.filter((record) => record.season === selectedSeason);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-sky-900/50 bg-gradient-to-r from-slate-950 via-slate-950 to-sky-950/40 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">Painel competitivo</p>
          <h1 className="mt-1 font-display text-2xl font-black text-white">Estatísticas</h1>
          <p className="mt-1 text-sm text-slate-400">Acompanhe as médias, temporadas salvas e dados das partidas.</p>
        </div>
        {canImportOcr && (
          <button type="button" onClick={onOpenOcr} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:from-sky-500 hover:to-indigo-500">
            <ScanLine className="h-4 w-4" /> Importar partida com OCR
          </button>
        )}
      </header>

      <section className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-700/30 bg-gradient-to-r from-amber-950/20 via-slate-950 to-slate-950 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-700/30 bg-amber-950/40 text-amber-300"><CalendarClock className="h-5 w-5" /></span>
          <div><h2 className="font-display text-base font-bold text-white">Temporada {activeSeason.number}</h2><p className="text-sm text-slate-400">{activeSeason.status === 'active' ? 'Partidas em andamento; o cronômetro está no painel inicial.' : 'Aguardando o criador iniciar as partidas.'}</p></div>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${activeSeason.status === 'active' ? 'border-emerald-700/40 bg-emerald-950/40 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>
          <span className={`h-2 w-2 rounded-full ${activeSeason.status === 'active' ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'}`} />
          {activeSeason.status === 'active' ? 'ATIVA' : 'EM ESPERA'}
        </span>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Média do elenco" value={average ?? '—'} note={average === null ? 'aguardando os primeiros votos' : 'calculada pelos votos'} icon={<BarChart3 className="h-4 w-4" />} />
        <Metric label="Votos computados" value={totalVotes} note={`na temporada ${activeSeason.number}`} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Metric label="Jogadores" value={users.length} note="no elenco Personas" icon={<Trophy className="h-4 w-4" />} />
        <Metric label="Cartas da temporada" value={activeCards.length} note={`temporada ${activeSeason.number}`} icon={<CalendarClock className="h-4 w-4" />} />
      </div>

      <div role="group" aria-label="Seções de estatísticas" className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-2">
        {([
          { id: 'averages', label: 'Média do elenco por temporada' },
          { id: 'routes', label: 'Rotas' },
          { id: 'archives', label: 'Temporadas salvas' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={activeStatsTab === tab.id}
            onClick={() => setActiveStatsTab(tab.id)}
            className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition ${activeStatsTab === tab.id ? 'border-sky-500/60 bg-sky-950/60 text-sky-200 shadow-sm shadow-sky-950' : 'border-transparent bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeStatsTab === 'routes' && <RouteDistribution users={users} />}

      {activeStatsTab === 'averages' && <section className="rounded-2xl border border-indigo-900/50 bg-gradient-to-br from-slate-950 via-slate-950 to-indigo-950/30 p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-white">Desempenho do elenco por temporada</h2>
            <p className="mt-1 text-xs text-slate-400">As partidas importadas pelo OCR ficam acumuladas aqui, com médias por jogador.</p>
          </div>
          <label className="w-full sm:w-56">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Temporada consultada</span>
            <select value={selectedSeason} onChange={(event) => setSelectedSeasonNumber(Number(event.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white focus:border-indigo-400 focus:outline-none">
              {availableSeasons.map((season) => <option key={season} value={season}>Temporada {season}{season === activeSeason.number ? ' · atual' : ''}</option>)}
            </select>
          </label>
        </div>

        {selectedSeasonRecords.length === 0 && <p className="mb-4 rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">Ainda não há partidas registradas nesta temporada. Importe um print e escolha vitória ou derrota para começar o histórico.</p>}

        <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(180px,1fr)_150px_170px]">
          <label className="relative block">
            <span className="sr-only">Buscar jogador</span>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input value={rankingSearch} onChange={(event) => setRankingSearch(event.target.value)} placeholder="Buscar jogador ou Riot ID" className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none" />
          </label>
          <label>
            <span className="sr-only">Filtrar por rota</span>
            <select value={laneFilter} onChange={(event) => setLaneFilter(event.target.value as 'all' | Lane)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white">
              <option value="all">Todas as rotas</option>
              {(['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPORTE', 'PREENCHER'] as Lane[]).map((lane) => <option key={lane} value={lane}>{lane === 'JUNGLE' ? 'Jungler' : lane === 'PREENCHER' ? 'Preencher' : lane}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por elo</span>
            <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value as 'all' | EloTier)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white">
              <option value="all">Todos os elos</option>
              <option value="lenda">Lenda</option><option value="challenger">Challenger</option><option value="grao_mestre">Grão-Mestre</option><option value="mestre">Mestre</option><option value="diamante">Diamante</option><option value="esmeralda">Esmeralda</option><option value="platina">Platina</option><option value="ouro">Ouro</option><option value="prata">Prata</option><option value="bronze">Bronze</option><option value="ferro">Ferro</option><option value="madeira">Madeira</option><option value="criminoso">Criminoso</option>
            </select>
          </label>
        </div>

        <div className="space-y-1.5">
          {filteredSeasonalRanking.map(({ user, count, victories, defeats, unknownResults, averageKills, averageDeaths, averageAssists, averageMinions, averageGold, kda, winRate }, index) => (
            <button key={user.id} type="button" onClick={() => onOpenProfile(user)} className="grid w-full grid-cols-2 items-center gap-2 rounded-xl border border-transparent bg-slate-900/60 p-2 text-left transition hover:border-slate-700 hover:bg-slate-900 sm:grid-cols-[30px_36px_minmax(120px,1fr)_repeat(5,minmax(80px,1fr))]">
              <span className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-3">
                <span className="w-7 shrink-0 font-mono text-[10px] font-bold text-slate-500">{String(index + 1).padStart(2, '0')}</span>
                <img src={user.avatar} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                <span className="min-w-0"><span className="block truncate text-xs font-bold text-white">{user.name}</span><span className="block truncate font-mono text-[9px] text-slate-500">{count ? `${count} ${count === 1 ? 'partida' : 'partidas'} · ${user.riotId || user.handle}` : `${user.riotId || user.handle} · Sem partidas`}</span></span>
              </span>
              <MatchMetric label="KDA" value={kda === null ? '—' : kda.toFixed(2)} />
              <MatchMetric label="K / D / A" value={count ? `${averageKills!.toFixed(1)} / ${averageDeaths!.toFixed(1)} / ${averageAssists!.toFixed(1)}` : '—'} />
              <MatchMetric label="Minions médios" value={averageMinions === null ? '—' : Math.round(averageMinions).toLocaleString('pt-BR')} />
              <MatchMetric label="Ouro médio" value={averageGold === null ? '—' : Math.round(averageGold).toLocaleString('pt-BR')} />
              <MatchMetric label="Win rate" value={winRate === null ? '—' : `${Math.round(winRate * 100)}%`} detail={victories + defeats > 0 ? `${victories} V · ${defeats} D` : unknownResults > 0 ? `${unknownResults} sem resultado` : undefined} />
            </button>
          ))}
          {filteredSeasonalRanking.length === 0 && <p className="rounded-xl border border-dashed border-slate-800 p-5 text-center text-xs text-slate-500">Nenhum jogador encontrado com esses filtros nesta temporada.</p>}
        </div>
      </section>}

      {activeStatsTab === 'archives' && <section className="space-y-3">
        <div>
          <h2 className="font-display text-base font-bold text-white">Temporadas salvas</h2>
          <p className="mt-1 text-xs text-slate-500">Os resultados arquivados continuam disponíveis nos perfis.</p>
        </div>
        {seasonArchives.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">As temporadas finalizadas aparecerão aqui.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {seasonArchives.map((season) => {
              const topPlayers = season.playerSnapshots.filter((player) => player.average !== null).sort((a, b) => (b.average ?? 0) - (a.average ?? 0)).slice(0, 3);
              return (
                <article key={season.number} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-display text-sm font-bold text-white">Temporada {season.number}</h3><p className="mt-1 text-[10px] text-slate-500">{new Date(season.endedAt).toLocaleString('pt-BR')} · {season.cardCount} cartas</p></div>
                    <span className="rounded-full border border-emerald-700/40 bg-emerald-950/40 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-300">{season.automatic ? 'Automática' : 'Manual'}</span>
                  </div>
                  <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                    {topPlayers.length === 0
                      ? <p className="text-xs text-slate-500">Nenhum voto registrado nesta temporada.</p>
                      : topPlayers.map((player, index) => <div key={player.userId} className="flex items-center justify-between text-xs"><span className="truncate text-slate-300"><span className="mr-2 font-mono text-slate-500">{index + 1}º</span>{player.name}</span><strong className="font-mono text-amber-300">{player.average}</strong></div>)}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: number | string; note: string; icon: React.ReactNode }> = ({ label, value, note, icon }) => (
  <article className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 sm:p-4">
    <div className="flex items-center justify-between gap-2 text-slate-500"><span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span><span className="text-amber-400">{icon}</span></div>
    <strong className="mt-2 block font-mono text-2xl font-black text-white">{value}</strong>
    <span className="mt-0.5 block text-[10px] text-slate-500">{note}</span>
  </article>
);

const MatchMetric: React.FC<{ label: string; value: string; detail?: string }> = ({ label, value, detail }) => (
  <span className="min-w-0 rounded-lg border border-slate-800/80 bg-slate-950/60 px-2 py-1.5 text-right sm:border-0 sm:bg-transparent sm:px-1">
    <span className="block truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    <strong className="block truncate font-mono text-xs font-bold text-indigo-100">{value}</strong>
    {detail && <span className="block truncate text-[9px] text-slate-500">{detail}</span>}
  </span>
);
