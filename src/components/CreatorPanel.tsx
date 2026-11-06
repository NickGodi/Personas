import React, { useMemo, useState } from 'react';
import { User, CardItem, CardOrnamentSettings, MatchDeckCard, ReportItem, ChatMessage, UserRole, EloTier, Lane, VoteRecord } from '../types';
import { BackgroundImageField } from './BackgroundImageField';
import { CardOrnamentEditor } from './CardOrnamentEditor';
import { DEFAULT_CARD_ORNAMENT_SETTINGS, TierCardOrnamentSettings } from '../utils/cardOrnament';
import { 
  Users, 
  Sliders, 
  Layers, 
  AlertOctagon, 
  LogIn, 
  Edit3, 
  CheckCircle, 
  Sparkles, 
  Crown,
  Search,
  Eye,
  MessageSquare,
  ShieldCheck,
  Calendar,
  Scaling,
} from 'lucide-react';

const ROUTE_CATEGORIES: { lane: Lane; label: string; color: string }[] = [
  { lane: 'TOP', label: 'Top', color: '#f43f5e' },
  { lane: 'JUNGLE', label: 'Jungler', color: '#10b981' },
  { lane: 'MID', label: 'Mid', color: '#f59e0b' },
  { lane: 'ADC', label: 'ADC', color: '#38bdf8' },
  { lane: 'SUPORTE', label: 'Suporte', color: '#a78bfa' },
  { lane: 'PREENCHER', label: 'Preencher', color: '#94a3b8' },
];

interface CreatorPanelProps {
  users: User[];
  votes: VoteRecord[];
  captainIds: [string, string];
  attendeeIds: string[];
  tournamentStarted: boolean;
  onSetTeamCaptain: (userId: string, slot: 0 | 1 | null) => void;
  cards: CardItem[];
  deck: MatchDeckCard[];
  reports: ReportItem[];
  messages: ChatMessage[];
  currentCreatorUser: User;
  onImpersonateUser: (user: User) => void;
  onOpenProfile: (user: User) => void;
  onUpdateUser: (updatedUser: User) => string | null;
  onUpdateDeck: (updatedDeck: MatchDeckCard[]) => void;
  onUpdateCards: (updatedCards: CardItem[]) => void;
  onResolveReport: (reportId: string, status: 'resolvido' | 'descartado') => void;
  onOpenOcrModal: () => void;
  onTestRole: (role: UserRole) => void;
  currentSeason: number;
  ornamentSettingsByTier: TierCardOrnamentSettings;
  onUpdateTierOrnamentSettings: (tier: EloTier, settings: CardOrnamentSettings) => void | Promise<void>;
}

export const CreatorPanel: React.FC<CreatorPanelProps> = ({
  users,
  votes,
  captainIds,
  attendeeIds,
  tournamentStarted,
  onSetTeamCaptain,
  cards,
  deck,
  reports,
  messages,
  currentCreatorUser,
  onImpersonateUser,
  onOpenProfile,
  onUpdateUser,
  onUpdateDeck,
  onUpdateCards,
  onResolveReport,
  onOpenOcrModal,
  onTestRole,
  currentSeason,
  ornamentSettingsByTier,
  onUpdateTierOrnamentSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'players' | 'stats' | 'deck' | 'reports' | 'chat' | 'ornament'>('players');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingUserError, setEditingUserError] = useState<string | null>(null);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const playerVoteAverages = useMemo(() => {
    const totals = new Map<string, { sum: number; count: number }>();
    votes.filter((vote) => vote.season === currentSeason).forEach((vote) => {
      const total = totals.get(vote.targetUserId) || { sum: 0, count: 0 };
      total.sum += vote.score;
      total.count += 1;
      totals.set(vote.targetUserId, total);
    });
    return new Map([...totals].map(([userId, total]) => [userId, Math.round(total.sum / total.count)] as const));
  }, [votes, currentSeason]);

  const handleSaveUser = () => {
    if (!editingUser) return;
    const error = onUpdateUser(editingUser);
    if (error) {
      setEditingUserError(error);
      return;
    }
    setEditingUser(null);
    setEditingUserError(null);
  };

  const updateDeckCardBackground = (cardId: string, backgroundImage?: string) => {
    onUpdateDeck(deck.map((card) => card.id === cardId ? { ...card, backgroundImage } : card));
  };

  // Generate 3 Legends based on top 3 scores
  const handleGenerateSeasonLegends = () => {
    if (currentSeason < 4) return;

    const sorted = [...users].sort((a, b) => b.currentScore - a.currentScore);
    const top3 = sorted.slice(0, 3);

    const newLegendCards: CardItem[] = top3.map((u) => ({
      id: `card_legend_s${currentSeason}_${u.id}`,
      userId: u.id,
      userName: u.name,
      userHandle: u.handle,
      userAvatar: u.avatar,
      season: currentSeason,
      score: u.currentScore,
      tier: 'lenda',
      lane: u.primaryLane,
      favoriteChampion: u.favoriteChampion,
      isMvp: cards.some((card) => card.userId === u.id && card.season === currentSeason && card.isMvp),
      isAce: false,
      isCriminoso: false,
      isLegend: true,
      stats: {
        ...u.stats,
      },
      date: new Date().toLocaleDateString('pt-BR'),
    }));

    const previousSeasons = cards.filter((card) => !(card.isLegend && card.season === currentSeason));
    onUpdateCards([...newLegendCards, ...previousSeasons]);
    alert(`Até 3 cartas Lenda foram atualizadas para a temporada ${currentSeason}: ${top3.map((u) => u.name).join(', ')}.`);
  };

  return (
    <div className="rounded-2xl bg-slate-950/95 border border-red-700/60 shadow-2xl p-4 md:p-6 backdrop-blur-md">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-red-900/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-red-600/20 border border-red-500/50 text-red-400">
              <Crown className="w-6 h-6 text-amber-400" />
            </span>
            <div>
              <h2 className="text-xl md:text-2xl font-display font-black text-white tracking-wide">
                Painel do Criador Supremo (@{currentCreatorUser.handle.replace('@', '')})
              </h2>
              <p className="text-xs text-slate-400">
                Acesso irrestrito a todos os jogadores, datas de entrada, impersonação e simulador de cargos
              </p>
            </div>
          </div>
        </div>

        {/* Global OCR quick launcher */}
        <button
          onClick={onOpenOcrModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-950 transition-all"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          Importar Print com OCR
        </button>
      </div>

      {/* ROLE TESTING SIMULATOR (Sistema para testar como é os cargos) */}
      <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <div>
            <span className="text-xs font-bold text-white block">
              Simulador de Permissões & Visão de Cargos:
            </span>
            <span className="text-[11px] text-slate-400">
              Clique para experimentar o site exatamente como cada cargo visualiza:
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['criador', 'moderador', 'capitao', 'jogador', 'visitante'] as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => onTestRole(r)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400 text-xs font-mono font-bold text-slate-200 capitalize transition-all"
            >
              Testar: {r}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'players', label: 'Gerenciar Jogadores', icon: Users, count: users.length },
          { id: 'stats', label: 'Ajuste de Estatísticas & Cartas', icon: Sliders, count: cards.length },
          { id: 'deck', label: 'Baralho de Regras Personas', icon: Layers, count: deck.length },
          { id: 'reports', label: 'Denúncias', icon: AlertOctagon, count: reports.filter((r) => r.status === 'pendente').length },
          { id: 'chat', label: 'Mensagens do Chat', icon: MessageSquare, count: messages.length },
          { id: 'ornament', label: 'Editor de Cartas', icon: Scaling },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-red-600 text-white shadow-md shadow-red-900/40'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActive ? 'bg-red-800 text-white' : 'bg-slate-800 text-slate-300'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: GERENCIAR JOGADORES (com Data de Entrada) */}
      {activeTab === 'players' && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por jogador, @handle ou cargo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>
            <span className="text-xs font-mono text-slate-400">
              Total: {filteredUsers.length} jogadores cadastrados
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Jogador</th>
                  <th className="py-3 px-3">Data de Entrada</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Capitão nos Times</th>
                  <th className="py-3 px-3">Rota</th>
                  <th className="py-3 px-3">Campeão Favorito</th>
                  <th className="py-3 px-3">Média</th>
                  <th className="py-3 px-3 text-right">Ações Supremas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {filteredUsers.map((u) => {
                  const captainSlot = captainIds.findIndex((id) => id === u.id);
                  const hasAttendance = attendeeIds.includes(u.id);
                  return (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-8 h-8 rounded-full object-cover border border-white/10"
                        />
                        <div>
                          <div className="font-bold text-white flex items-center gap-1">
                            {u.name}
                            {u.isLegend && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">{u.handle}</div>
                        </div>
                      </div>
                    </td>

                    {/* Data de Entrada */}
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-300">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>{u.entryDate || '10/01/2024'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {u.isOnline ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" /> Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <span className="w-2 h-2 rounded-full bg-slate-600" /> Offline
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <select
                        aria-label={`Capitão de equipe para ${u.name}`}
                        value={captainSlot >= 0 ? String(captainSlot) : ''}
                        disabled={!hasAttendance || tournamentStarted}
                        onChange={(event) => onSetTeamCaptain(
                          u.id,
                          event.target.value === '' ? null : Number(event.target.value) as 0 | 1,
                        )}
                        className={`min-w-32 rounded-lg border px-2 py-1.5 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-60 ${captainSlot === 0 ? 'border-sky-700/60 bg-sky-950/50 text-sky-200' : captainSlot === 1 ? 'border-red-700/60 bg-red-950/50 text-red-200' : 'border-slate-700 bg-slate-900 text-slate-400'}`}
                      >
                        <option value="">{hasAttendance ? 'Sem capitão' : 'Sem presença'}</option>
                        <option value="0">Capitão · Azul</option>
                        <option value="1">Capitão · Vermelho</option>
                      </select>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px]">
                      <span className="text-amber-400 font-bold">{ROUTE_CATEGORIES.find((route) => route.lane === u.primaryLane)?.label || 'Preencher'}</span>
                    </td>

                    <td className="py-3 px-3 font-semibold text-slate-300">
                      {u.favoriteChampion}
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <span className={`font-bold text-sm ${playerVoteAverages.has(u.id) ? 'text-amber-300' : 'text-slate-500'}`}>
                        {playerVoteAverages.get(u.id) ?? '—'}
                      </span>
                      {!playerVoteAverages.has(u.id) && <span className="ml-1 text-[9px] text-slate-500">sem votos</span>}
                      {u.isCriminoso && (
                        <span className="ml-1 text-[9px] px-1 rounded bg-red-900 text-red-200">
                          PRESO
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenProfile(u)}
                          className="inline-flex items-center gap-1 rounded bg-sky-950/70 px-2 py-1 text-[11px] font-bold text-sky-200 transition-colors hover:bg-sky-900"
                          title={`Abrir perfil público de ${u.name}`}
                        >
                          <Eye className="w-3.5 h-3.5" /> Perfil
                        </button>
                        <button
                          onClick={() => onImpersonateUser(u)}
                          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold text-[11px] transition-colors flex items-center gap-1 shadow-sm"
                          title="Entrar na conta desta pessoa e mexer em tudo"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          Assumir Conta
                        </button>

                        <button
                          onClick={() => { setEditingUser(u); setEditingUserError(null); }}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                          title="Editar dados"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MANUAL STATS & CARDS */}
      {activeTab === 'stats' && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-display font-bold text-base text-white">
                Ajuste Manual de Estatísticas, KDA e Honrarias
              </h3>
              <p className="text-xs text-slate-400">
                Altere as notas e honrarias. As Cartas Lenda são liberadas após três temporadas concluídas.
              </p>
            </div>

            <button
              onClick={handleGenerateSeasonLegends}
              disabled={currentSeason < 4}
              title={currentSeason < 4 ? 'As Cartas Lenda ficam disponíveis após três temporadas concluídas.' : undefined}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-extrabold text-xs shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:from-amber-500 disabled:hover:to-yellow-600"
            >
              <Sparkles className="w-4 h-4" />
              {currentSeason < 4 ? 'Lendas após 3 temporadas' : 'Criar 3 Cartas Lenda da Temporada'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={u.avatar}
                        alt={u.name}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-bold text-white text-xs">{u.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{u.handle}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">Média Geral</div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={u.currentScore}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          onUpdateUser({ ...u, currentScore: val });
                        }}
                        className="w-16 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold font-mono text-sm text-center"
                      />
                    </div>
                  </div>

                  {/* Match statistics */}
                  <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg border border-slate-800 bg-slate-950/60 py-2 text-center font-mono text-[10px]">
                    {([
                      ['Abates', 'kills'],
                      ['Mortes', 'deaths'],
                      ['Assist.', 'assists'],
                      ['Minions', 'minions'],
                      ['Gold', 'gold'],
                    ] as const).map(([label, stat]) => (
                      <label key={stat} className="min-w-0 px-1">
                        <span className="block truncate text-slate-400">{label}</span>
                        <input
                          type="number"
                          min="0"
                          value={u.stats[stat]}
                          onChange={(event) => onUpdateUser({ ...u, stats: { ...u.stats, [stat]: Number(event.target.value) } })}
                          className="mt-0.5 w-full border-b border-slate-700 bg-transparent text-center font-bold text-white"
                        />
                      </label>
                    ))}
                  </div>

                  {/* Badges toggles */}
                  <div className="flex flex-wrap gap-1.5">
                    <span title="A temporada escolhe um único Criminoso ao ser encerrada, com base nas médias e estatísticas." className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                      {u.isCriminoso ? '🔒 Criminoso da temporada anterior' : 'Criminoso definido ao encerrar a temporada'}
                    </span>

                    <button
                      onClick={() => onUpdateUser({ ...u, isLegend: !u.isLegend })}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        u.isLegend
                          ? 'bg-amber-500 text-black'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {u.isLegend ? '★ Lenda Ativa' : 'Promover a Lenda'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DECK EDITOR */}
      {activeTab === 'deck' && (
        <div className="mt-6 space-y-4">
          <div className="pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-display font-bold text-base text-white">
                Fotos das Cartas de Sorteio
              </h3>
              <p className="text-xs text-slate-400">
                Adicione, troque ou remova a foto de fundo. Os textos e as regras das cartas ficam preservados.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {deck.map((card) => (
              <article key={card.id} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="relative min-h-36 overflow-hidden bg-slate-950 p-4">
                {card.backgroundImage && (
                    <img src={card.backgroundImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-45" />
                )}
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-slate-950/65 to-slate-950/90" />
                  <div className="relative z-10">
                    <span className="text-sm font-bold text-white">{card.title}</span>
                    <p className="mt-2 text-xs font-semibold text-amber-200">{card.rule}</p>
                    <p className="mt-1 text-[11px] italic text-slate-300">{card.description}</p>
                  </div>
                </div>
                <div className="p-3">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-amber-200 transition hover:border-amber-500/60">
                      <span>{card.backgroundImage ? 'Editar foto' : 'Adicionar foto'}</span>
                      <span aria-hidden="true" className="text-slate-500 transition group-open:rotate-180">⌄</span>
                    </summary>
                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                      <BackgroundImageField
                        label="Foto de fundo da carta"
                        value={card.backgroundImage}
                        onChange={(backgroundImage) => updateDeckCardBackground(card.id, backgroundImage)}
                      />
                    </div>
                  </details>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: REPORTS */}
      {activeTab === 'reports' && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-display font-bold text-base text-white">
                Central de Denúncias e Auditoria
              </h3>
              <p className="text-xs text-slate-400">
                Notificações de infrações de conduta, manipulação de votos ou toxicidade
              </p>
            </div>
            <span className="text-xs font-mono text-amber-400">
              {reports.filter((r) => r.status === 'pendente').length} pendentes
            </span>
          </div>

          {reports.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
              Nenhuma denúncia registrada no sistema.
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    rep.status === 'pendente'
                      ? 'bg-red-950/40 border-red-800/80'
                      : 'bg-slate-900/40 border-slate-800 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-red-900 text-white font-bold">
                        {rep.reason}
                      </span>
                      <span className="text-xs text-slate-400">
                        Denunciante: <strong className="text-white">{rep.reporterHandle}</strong>
                      </span>
                      <span className="text-slate-500">→</span>
                      <span className="text-xs text-slate-400">
                        Acusado: <strong className="text-red-400">{rep.targetUserName} ({rep.targetUserHandle})</strong>
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 mt-1">"{rep.details}"</p>
                    <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                      Enviada em {new Date(rep.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {rep.status === 'pendente' ? (
                      <>
                        <button
                          onClick={() => onResolveReport(rep.id, 'resolvido')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Resolver / Punir
                        </button>
                        <button
                          onClick={() => onResolveReport(rep.id, 'descartado')}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                        >
                          Descartar
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-mono text-emerald-400 font-bold uppercase">
                        ✓ {rep.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CHAT LOG */}
      {activeTab === 'chat' && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-display font-bold text-base text-white">
                Histórico de Mensagens do Chat Flutuante
              </h3>
              <p className="text-xs text-slate-400">
                Todas as mensagens enviadas pelos jogadores no widget flutuante chegam aqui para o Criador
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {messages.length} mensagens
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {messages.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 text-xs"
              >
                <img
                  src={m.senderAvatar}
                  alt={m.senderName}
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white">{m.senderName}</span>
                      <span className="text-[10px] font-mono text-slate-400">{m.senderHandle}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">{m.timestamp}</span>
                  </div>
                  <p className="text-slate-200">{m.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: EDITOR DE ORNAMENTOS DAS CARTAS */}
      {activeTab === 'ornament' && (
        <CardOrnamentEditor
          cards={cards}
          users={users}
          defaultSettings={DEFAULT_CARD_ORNAMENT_SETTINGS}
          ornamentSettingsByTier={ornamentSettingsByTier}
          onSave={onUpdateTierOrnamentSettings}
        />
      )}

      {/* Modal: Edit User */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-lg w-full p-6 shadow-2xl">
            <h3 className="font-display font-bold text-lg text-white mb-4">
              Editar Jogador: {editingUser.name}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Nome de Exibição:</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">@Handle Único:</label>
                <input
                  type="text"
                  value={editingUser.handle}
                  onChange={(e) => { setEditingUser({ ...editingUser, handle: e.target.value }); setEditingUserError(null); }}
                  className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">E-mail de login (privado):</label>
                  <input
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => { setEditingUser({ ...editingUser, email: e.target.value }); setEditingUserError(null); }}
                    placeholder="jogador@exemplo.com"
                    className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Riot ID único:</label>
                  <input
                    type="text"
                    value={editingUser.riotId}
                    onChange={(e) => { setEditingUser({ ...editingUser, riotId: e.target.value }); setEditingUserError(null); }}
                    placeholder="Nick#BR1"
                    className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Foto do perfil (URL):</label>
                <input
                  type="url"
                  value={editingUser.avatar.startsWith('data:') ? '' : editingUser.avatar}
                  onChange={(e) => setEditingUser({ ...editingUser, avatar: e.target.value })}
                  placeholder="Cole um link público para substituir a foto"
                  className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white"
                />
                <p className="mt-1 text-[10px] text-slate-500">A foto atualiza o perfil e todas as cartas deste jogador.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Permissão da conta:</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                    className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="criador">Criador</option>
                    <option value="moderador">Moderador</option>
                    <option value="capitao">Capitão</option>
                    <option value="jogador">Jogador</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Rota:</label>
                  <select
                    value={editingUser.primaryLane}
                    onChange={(e) => setEditingUser({ ...editingUser, primaryLane: e.target.value as any })}
                    className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="TOP">TOP</option>
                    <option value="JUNGLE">Jungler</option>
                    <option value="MID">MID</option>
                    <option value="ADC">ADC</option>
                    <option value="SUPORTE">Suporte</option>
                    <option value="PREENCHER">Preencher</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Campeão Favorito:</label>
                <input
                  type="text"
                  value={editingUser.favoriteChampion}
                  onChange={(e) => setEditingUser({ ...editingUser, favoriteChampion: e.target.value })}
                  className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Data de Entrada no Site:</label>
                <input
                  type="text"
                  value={editingUser.entryDate || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, entryDate: e.target.value })}
                  placeholder="DD/MM/AAAA"
                  className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>
            </div>

            {editingUserError && <p role="alert" className="mt-3 rounded-lg border border-red-700/40 bg-red-950/40 p-2.5 text-xs text-red-200">{editingUserError}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => { setEditingUser(null); setEditingUserError(null); }}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveUser}
                className="px-4 py-1.5 rounded bg-red-600 text-white font-bold text-xs"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
