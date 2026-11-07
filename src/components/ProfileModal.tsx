import React, { useMemo, useRef, useState } from 'react';
import { User, CardItem, Lane, SeasonArchive, EloTier, VoteRecord, MatchRecord, MatchResult, UserStats, PlayerComment } from '../types';
import { getTierFromScore } from '../data/initialData';
import { RankedCard } from './RankedCard';
import { TierCardOrnamentSettings } from '../utils/cardOrnament';
import { displayLogin, normalizeHandle } from '../utils/userIdentity';
import { formatGold, formatKda } from '../utils/stats';
import {
  Calculator,
  Filter,
  LogIn,
  MessageSquare,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Upload,
  X,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  votes: VoteRecord[];
  activeSeasonNumber: number;
  canRateInSeason: boolean;
  voteDisabledReason: string;
  hasRatedInSeason: boolean;
  allCards: CardItem[];
  ornamentSettingsByTier?: TierCardOrnamentSettings;
  seasonArchives: SeasonArchive[];
  archivedCommentsBySeason: Record<number, PlayerComment[]>;
  currentUser: User | null;
  matchRecords: MatchRecord[];
  canManageMatchStats: boolean;
  onAddManualMatchStats: (input: { userId: string; stats: UserStats; result: Exclude<MatchResult, 'unrecorded'> }) => Promise<string | null>;
  isOwnProfile: boolean;
  canImpersonateUser: boolean;
  canResetRatings: boolean;
  onImpersonateUser: (user: User) => void;
  onResetRating: (userId: string) => void;
  canDeleteComments: boolean;
  onUpdateProfile: (updated: Partial<User>) => string | null | Promise<string | null>;
  onCastVote: (vote: { targetUserId: string; score: number; comment?: string }) => Promise<string | null>;
  onAddComment: (targetUserId: string, text: string) => void;
  onDeleteComment: (targetUserId: string, commentId: string) => void;
  onOpenReportModal?: (targetUser: User) => void;
}

type ProfileTab = 'profile' | 'stats' | 'history' | 'votes';

const tierLabels: Record<EloTier, string> = {
  lenda: 'Lenda',
  challenger: 'Challenger',
  grao_mestre: 'Grão-Mestre',
  mestre: 'Mestre',
  diamante: 'Diamante',
  esmeralda: 'Esmeralda',
  platina: 'Platina',
  ouro: 'Ouro',
  prata: 'Prata',
  bronze: 'Bronze',
  ferro: 'Ferro',
  madeira: 'Madeira',
  criminoso: 'Criminoso',
  mencao_honrosa: 'Menção Honrosa',
};

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  votes,
  activeSeasonNumber,
  canRateInSeason,
  voteDisabledReason,
  hasRatedInSeason,
  allCards,
  ornamentSettingsByTier,
  seasonArchives,
  archivedCommentsBySeason,
  currentUser,
  matchRecords,
  canManageMatchStats,
  onAddManualMatchStats,
  isOwnProfile,
  canImpersonateUser,
  canResetRatings,
  onImpersonateUser,
  onResetRating,
  canDeleteComments,
  onUpdateProfile,
  onCastVote,
  onAddComment,
  onDeleteComment,
  onOpenReportModal,
}) => {
  const [name, setName] = useState(user.name);
  const [handle, setHandle] = useState(displayLogin(user.handle));
  const [avatar, setAvatar] = useState(user.avatar.startsWith('data:') ? '' : user.avatar);
  const [bio, setBio] = useState(user.bio);
  const [favoriteChampion, setFavoriteChampion] = useState(user.favoriteChampion);
  const [primaryLane, setPrimaryLane] = useState<Lane>(user.primaryLane);
  const [riotId, setRiotId] = useState(user.riotId);
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<ProfileTab>(isOwnProfile ? 'profile' : 'votes');
  const [scoreInput, setScoreInput] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [matchStatsSubmitting, setMatchStatsSubmitting] = useState(false);
  const [matchStatsMessage, setMatchStatsMessage] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<Exclude<MatchResult, 'unrecorded'>>('victory');
  const [manualStats, setManualStats] = useState<UserStats>({ kills: 0, deaths: 0, assists: 0, minions: 0, gold: 0 });
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarFileInput = useRef<HTMLInputElement>(null);

  const userCards = useMemo(() => allCards.filter((card) => card.userId === user.id), [allCards, user.id]);
  const availableSeasons = useMemo(
    () => Array.from(new Set([
      ...userCards.map((card) => card.season),
      ...seasonArchives.filter((season) => season.playerSnapshots.some((player) => player.userId === user.id)).map((season) => season.number),
      ...Object.keys(archivedCommentsBySeason).map(Number),
    ])).sort((a, b) => b - a),
    [userCards, seasonArchives, archivedCommentsBySeason, user.id]
  );
  const filteredCards = userCards.filter((card) => seasonFilter === 'all' || card.season === Number(seasonFilter));
  const seasonRecords = seasonArchives
    .filter((season) => seasonFilter === 'all' || season.number === Number(seasonFilter))
    .map((season) => ({
      season,
      player: season.playerSnapshots.find((snapshot) => snapshot.userId === user.id),
    }))
    .filter((record) => record.player);
  const comments = (user.comments || []).filter((comment) => comment.season === activeSeasonNumber);
  const archivedCommentGroups = Object.entries(archivedCommentsBySeason)
    .map(([season, seasonComments]) => ({ season: Number(season), comments: seasonComments }))
    .filter((record) => record.comments.length > 0 && seasonFilter !== 'all' && record.season === Number(seasonFilter))
    .sort((a, b) => b.season - a.season);
  const receivedVotes = useMemo(
    () => votes.filter((vote) => vote.targetUserId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [votes, user.id],
  );
  const currentSeasonVotes = useMemo(
    () => votes.filter((vote) => vote.targetUserId === user.id && vote.season === activeSeasonNumber),
    [votes, user.id, activeSeasonNumber],
  );
  const currentAverage = currentSeasonVotes.length
    ? Math.round(currentSeasonVotes.reduce((sum, vote) => sum + vote.score, 0) / currentSeasonVotes.length)
    : null;
  const tier = currentAverage === null ? null : getTierFromScore(currentAverage, Boolean(user.isCriminoso));
  const seasonMatchRecords = matchRecords.filter((record) => record.playerId === user.id && record.season === activeSeasonNumber);
  const recordedSeasonStats: UserStats = seasonMatchRecords.length ? {
    kills: Math.round(seasonMatchRecords.reduce((sum, record) => sum + record.stats.kills, 0) / seasonMatchRecords.length),
    deaths: Math.round(seasonMatchRecords.reduce((sum, record) => sum + record.stats.deaths, 0) / seasonMatchRecords.length),
    assists: Math.round(seasonMatchRecords.reduce((sum, record) => sum + record.stats.assists, 0) / seasonMatchRecords.length),
    minions: Math.round(seasonMatchRecords.reduce((sum, record) => sum + record.stats.minions, 0) / seasonMatchRecords.length),
    gold: Math.round(seasonMatchRecords.reduce((sum, record) => sum + record.stats.gold, 0) / seasonMatchRecords.length),
  } : { kills: 0, deaths: 0, assists: 0, minions: 0, gold: 0 };
  const hasSeasonMatchStats = seasonMatchRecords.length > 0;
  const kda = hasSeasonMatchStats ? formatKda(recordedSeasonStats) : '—';
  const avatarPreview = avatar.trim() || user.avatar;

  if (!isOpen) return null;

  const handleSave = async () => {
    const normalizedHandle = normalizeHandle(handle);
    if (normalizedHandle.length < 3) {
      setProfileSaveError('Informe um login válido para seu perfil.');
      return;
    }
    setProfileSaveError(null);
    setProfileSaving(true);
    try {
      const saveError = await onUpdateProfile({ name, handle: normalizedHandle, avatar: avatar.trim() || user.avatar, bio, favoriteChampion, primaryLane, riotId });
      if (saveError) {
        setProfileSaveError(saveError);
        return;
      }
      onClose();
    } catch (error) {
      setProfileSaveError(error instanceof Error ? error.message : 'Não foi possível salvar o perfil.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProfileSaveError(null);
    if (!file.type.startsWith('image/')) {
      setProfileSaveError('Escolha um arquivo de imagem (JPG, PNG ou WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setProfileSaveError('A imagem precisa ter no máximo 8 MB.');
      return;
    }

    setAvatarLoading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 512 / bitmap.width, 512 / bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível processar esta imagem.');
      context.fillStyle = '#0b1020';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const compressedAvatar = canvas.toDataURL('image/jpeg', 0.82);
      if (compressedAvatar.length > 600_000) throw new Error('A imagem ficou muito grande. Escolha uma imagem menor.');
      setAvatar(compressedAvatar);
    } catch (caught) {
      setProfileSaveError(caught instanceof Error ? caught.message : 'Não foi possível carregar esta imagem.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSubmitVote = async () => {
    if (!currentUser || (currentUser.id === user.id && currentUser.role !== 'criador') || commentSubmitting || !canRateInSeason || hasRatedInSeason) return;
    const score = scoreInput === '' ? NaN : Number(scoreInput);
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      setFeedback('A nota precisa ser um número inteiro entre 0 e 100.');
      return;
    }
    setCommentSubmitting(true);
    const error = await onCastVote({ targetUserId: user.id, score });
    setCommentSubmitting(false);
    if (error) {
      setFeedback(error);
      return;
    }
    setScoreInput('');
    setFeedback('Nota confirmada nesta temporada.');
  };

  const handleSubmitComment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || currentUser.id === user.id || commentSubmitting) return;

    const comment = commentInput.trim();
    if (!comment) {
      setFeedback('Escreva um comentário antes de publicar.');
      return;
    }
    setCommentInput('');
    onAddComment(user.id, comment);
    setFeedback('Publicado no perfil do jogador.');
  };

  const handleAddManualStats = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageMatchStats || matchStatsSubmitting) return;
    setMatchStatsSubmitting(true);
    setMatchStatsMessage(null);
    try {
      const error = await onAddManualMatchStats({ userId: user.id, stats: manualStats, result: matchResult });
      if (error) {
        setMatchStatsMessage(error);
        return;
      }
      setManualStats({ kills: 0, deaths: 0, assists: 0, minions: 0, gold: 0 });
      setMatchStatsMessage('Partida registrada nas estatísticas da temporada.');
    } catch (error) {
      setMatchStatsMessage(error instanceof Error ? error.message : 'Não foi possível salvar as estatísticas da partida.');
    } finally {
      setMatchStatsSubmitting(false);
    }
  };

  const tabs: { id: ProfileTab; label: string }[] = [
    ...(isOwnProfile ? [{ id: 'profile' as const, label: 'Meu perfil' }] : []),
    { id: 'votes', label: `Votos (${receivedVotes.length})` },
    { id: 'stats', label: 'Estatísticas' },
    { id: 'history', label: 'Histórico' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-profile-title"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-red-700/60 bg-slate-950 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-red-900/40 bg-gradient-to-r from-red-950/80 via-slate-900 to-slate-950 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src={avatarPreview} alt="" className="h-12 w-12 shrink-0 rounded-xl border-2 border-amber-400 object-cover" />
            <div className="min-w-0">
              <h2 id="player-profile-title" className="flex flex-wrap items-center gap-2 font-display text-base font-black text-white sm:text-lg">
                <span className="truncate">{user.name}</span>
                <span className="rounded-full border border-red-800 bg-red-950 px-2 py-0.5 font-mono text-[10px] text-red-300">{displayLogin(user.handle)}</span>
              </h2>
              <p className="text-xs text-slate-400">Média atual <strong className={currentAverage === null ? 'text-slate-500' : 'text-amber-300'}>{currentAverage ?? '—'}</strong>{tier ? ` · ${tierLabels[tier]}` : ' · Sem média registrada'}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canResetRatings && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Zerar a média de ${user.name} na temporada ${activeSeasonNumber}? Os votos e a nota desta temporada serão removidos; temporadas encerradas serão preservadas.`)) onResetRating(user.id);
                }}
                title={`Zerar a média de ${user.name} na temporada atual`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-700/50 bg-red-950/40 px-2 py-1.5 text-[10px] font-bold text-red-200 transition-colors hover:border-red-500 hover:bg-red-900/50 sm:px-2.5 sm:text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Zerar média</span>
              </button>
            )}
            {canImpersonateUser && !isOwnProfile && (
              <button type="button" onClick={() => onImpersonateUser(user)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600/50 bg-amber-950/50 px-2.5 py-1.5 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-900/60">
                <LogIn className="h-3.5 w-3.5" /> Assumir conta
              </button>
            )}
            {!canImpersonateUser && !isOwnProfile && onOpenReportModal && (
              <button type="button" onClick={() => onOpenReportModal(user)} className="hidden rounded-lg px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-950/50 hover:text-red-300 sm:block">
                Denunciar
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Fechar perfil" className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <nav aria-label="Seções do perfil" className="flex gap-1 overflow-x-auto border-b border-slate-800 px-4 pt-2 text-xs font-bold sm:px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`shrink-0 border-b-2 px-3 py-2 transition-colors ${activeTab === tab.id ? 'border-red-500 text-red-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {activeTab === 'profile' && isOwnProfile && (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-amber-100">
                Seus dados de perfil ficam visíveis apenas para você. Os outros jogadores veem suas estatísticas, cartas, histórico e comentários.
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-slate-300">Nome no site
                  <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white" />
                </label>
                <label className="text-slate-300">Login
                  <input value={handle} onChange={(event) => { setHandle(event.target.value); setProfileSaveError(null); }} placeholder="nick" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 font-mono text-white" />
                </label>
                <div className="md:col-span-2">
                  <span className="text-slate-300">Foto do perfil</span>
                  <div className="mt-1 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                    <img src={avatarPreview} alt="Prévia da foto do perfil" className="h-14 w-14 rounded-xl border border-slate-700 object-cover" />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => avatarFileInput.current?.click()}
                        disabled={avatarLoading}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-600/50 bg-amber-950/40 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-900/60 disabled:cursor-wait disabled:opacity-60"
                      >
                        <Upload className="h-4 w-4" />
                        {avatarLoading ? 'Carregando foto…' : 'Escolher foto do computador'}
                      </button>
                      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">JPG, PNG ou WebP, até 8 MB. A imagem é otimizada e aparece no perfil e nas cartas após salvar.</p>
                    </div>
                  </div>
                  <input ref={avatarFileInput} type="file" accept="image/*" onChange={handleAvatarFileChange} className="sr-only" tabIndex={-1} aria-label="Selecionar foto de perfil do computador" />
                  <label className="mt-3 block text-[11px] text-slate-400">Ou usar uma URL de imagem
                    <input value={avatar.startsWith('data:') ? '' : avatar} onChange={(event) => setAvatar(event.target.value)} placeholder="https://exemplo.com/foto.jpg" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white" />
                  </label>
                </div>
                <label className="text-slate-300">Riot ID / nick no jogo
                  <input value={riotId} onChange={(event) => { setRiotId(event.target.value); setProfileSaveError(null); }} placeholder="Ex.: jogador#BR1" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 font-mono text-white" />
                </label>
                <label className="text-slate-300">Campeão favorito
                  <input value={favoriteChampion} onChange={(event) => setFavoriteChampion(event.target.value)} placeholder="Ex.: Kayle, Aatrox, Zed" className="mt-1 w-full rounded-xl border border-amber-500/40 bg-slate-900 p-2.5 font-semibold text-amber-300" />
                </label>
                <label className="text-slate-300">Rota
                  <select value={primaryLane} onChange={(event) => setPrimaryLane(event.target.value as Lane)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white">
                    <option value="TOP">TOP</option>
                    <option value="JUNGLE">Jungler</option>
                    <option value="MID">MID</option>
                    <option value="ADC">ADC</option>
                    <option value="SUPORTE">Suporte</option>
                    <option value="PREENCHER">Preencher</option>
                  </select>
                </label>
              </div>
              <label className="block text-slate-300">Biografia privada
                <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={4} maxLength={500} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white" />
              </label>
              {profileSaveError && <p role="alert" className="text-xs text-amber-300">{profileSaveError}</p>}
              <div className="flex justify-end">
                <button type="button" onClick={() => void handleSave()} disabled={profileSaving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition hover:from-red-500 hover:to-rose-500 disabled:cursor-wait disabled:opacity-60">
                  <Save className="h-4 w-4" /> {profileSaving ? 'Salvando perfil…' : 'Salvar perfil'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <StatTile label="Média atual" value={currentAverage ?? '—'} icon={<Sparkles className="h-4 w-4" />} accent={currentAverage === null ? 'text-slate-500' : 'text-amber-300'} />
                <StatTile label="Votos recebidos" value={currentSeasonVotes.length} icon={<Star className="h-4 w-4" />} accent="text-sky-300" />
                <StatTile label="Temporadas" value={user.seasonsPlayed} icon={<Trophy className="h-4 w-4" />} accent="text-rose-300" />
              </div>
              <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">Desempenho no Rift</h3>
                    <p className="mt-1 text-xs text-slate-400">As médias são atualizadas assim que uma nota é registrada.</p>
                  </div>
                  <span className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-bold ${tier ? 'border-amber-500/30 bg-amber-950/40 text-amber-300' : 'border-slate-700 bg-slate-950 text-slate-500'}`}>{tier ? tierLabels[tier] : 'Sem média'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatTile label="KDA (A/M/A)" value={kda} compact />
                  <StatTile label="Minions" value={hasSeasonMatchStats ? recordedSeasonStats.minions.toLocaleString('pt-BR') : '—'} compact />
                  <StatTile label="Gold" value={hasSeasonMatchStats ? formatGold(recordedSeasonStats.gold) : '—'} compact />
                </div>
                {canManageMatchStats && (
                  <form onSubmit={(event) => void handleAddManualStats(event)} className="mt-4 space-y-3 rounded-xl border border-amber-700/40 bg-amber-950/10 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-amber-200">Inserir dados da partida</h4>
                      <p className="mt-1 text-[10px] text-slate-400">Os valores exibidos são a média das partidas da temporada {activeSeasonNumber}.</p>
                      </div>
                      <label className="text-[10px] font-semibold text-slate-300">Resultado
                        <select value={matchResult} onChange={(event) => setMatchResult(event.target.value as Exclude<MatchResult, 'unrecorded'>)} className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white">
                          <option value="victory">Vitória</option>
                          <option value="defeat">Derrota</option>
                        </select>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {([
                        ['kills', 'Abates'],
                        ['deaths', 'Mortes'],
                        ['assists', 'Assistências'],
                        ['minions', 'Minions'],
                        ['gold', 'Gold'],
                      ] as const).map(([field, label]) => (
                        <label key={field} className="text-[10px] font-semibold text-slate-400">{label}
                          <input type="number" min="0" step="1" value={manualStats[field]} onChange={(event) => setManualStats((previous) => ({ ...previous, [field]: Math.max(0, Number(event.target.value) || 0) }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 font-mono text-sm text-amber-200" />
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p aria-live="polite" className={`text-[11px] ${matchStatsMessage?.startsWith('Partida registrada') ? 'text-emerald-300' : 'text-rose-300'}`}>{matchStatsMessage}</p>
                      <button type="submit" disabled={matchStatsSubmitting} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60">
                        <Save className="h-3.5 w-3.5" /> {matchStatsSubmitting ? 'Salvando…' : 'Confirmar estatísticas'}
                      </button>
                    </div>
                  </form>
                )}
                <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-800 pt-4 sm:grid-cols-3">
                  <StatTile label="Títulos MVP" value={user.mvpCount} compact />
                  <StatTile label="Títulos ACE" value={user.aceCount} compact />
                  <StatTile label="Criminoso" value={user.isCriminoso ? 'Ativo' : 'Não'} icon={<ShieldAlert className="h-4 w-4" />} accent={user.isCriminoso ? 'text-red-300' : 'text-slate-400'} compact />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'history' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-display text-sm font-bold text-white">Histórico competitivo</h3>
                  <p className="mt-1 text-xs text-slate-400">Cartas e resultados salvos por temporada.</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <Filter className="h-4 w-4" />
                  <select value={seasonFilter} onChange={(event) => setSeasonFilter(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-white">
                    <option value="all">Todas</option>
                    {availableSeasons.map((season) => <option key={season} value={season}>Temporada {season}</option>)}
                  </select>
                </label>
              </div>

              {seasonRecords.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {seasonRecords.map(({ season, player }) => player && (
                    <article key={season.number} className="flex items-center justify-between rounded-xl border border-amber-700/30 bg-amber-950/20 p-3">
                      <div>
                        <p className="text-xs font-bold text-white">Temporada {season.number}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{player.totalVotes} votos · {new Date(season.endedAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xl font-black text-amber-300">{player.average ?? '—'}</p>
                        <p className="text-[10px] text-slate-400">{player.tier ? tierLabels[player.tier] : 'Sem votos'}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {archivedCommentGroups.length > 0 && (
                <section className="space-y-3">
                  <div className="border-b border-slate-800 pb-2">
                    <h3 className="font-display text-sm font-bold text-white">Comentários arquivados por temporada</h3>
                    <p className="mt-1 text-xs text-slate-400">Comentários antigos ficam guardados na temporada em que foram publicados.</p>
                  </div>
                  {archivedCommentGroups.map(({ season, comments: seasonComments }) => (
                    <div key={season} className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                      <h4 className="text-xs font-bold text-amber-200">Temporada {season}</h4>
                      {seasonComments.map((comment) => (
                        <article key={comment.id} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs">
                          <img src={comment.authorAvatar} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5"><strong className="text-white">{comment.authorName}</strong><span className="font-mono text-[10px] text-slate-400">{displayLogin(comment.authorHandle)}</span></div>
                              <div className="flex items-center gap-2">
                                {comment.scoreGiven !== undefined && <span className="rounded border border-amber-500/30 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">Nota {comment.scoreGiven}</span>}
                                {canDeleteComments && <button type="button" onClick={() => onDeleteComment(user.id, comment.id)} aria-label={`Excluir comentário de ${comment.authorName}`} className="rounded p-1 text-slate-500 transition hover:bg-red-950 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>}
                              </div>
                            </div>
                            <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-slate-200">{comment.text}</p>
                            <time className="mt-1.5 block text-[10px] text-slate-500">{comment.createdAt}</time>
                          </div>
                        </article>
                      ))}
                    </div>
                  ))}
                </section>
              )}

              {filteredCards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-xs text-slate-500">Nenhuma carta salva nesta temporada.</div>
              ) : (
                <div className="flex flex-wrap justify-center gap-6 py-2">
                  {filteredCards.map((card) => <RankedCard key={card.id} card={card} size="sm" ornamentSettings={ornamentSettingsByTier?.[card.tier]} />)}
                </div>
              )}
            </section>
          )}

          {activeTab === 'votes' && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="flex items-center gap-2 font-display text-sm font-bold text-white"><Star className="h-4 w-4 text-amber-300" /> Votos do jogador</h3>
                  <p className="mt-1 text-xs text-slate-400">Registros de notas desta temporada e de temporadas anteriores.</p>
                </div>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 font-mono text-[10px] text-slate-300">{receivedVotes.length}</span>
              </div>

              {(!isOwnProfile || currentUser?.role === 'criador') && (
                currentUser ? (
                  <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="text-xs font-semibold text-slate-300">Nota opcional (0 a 100)
                        <span className="relative mt-1 block">
                          <Calculator className="absolute left-3 top-3 h-4 w-4 text-amber-400" />
                          <input type="number" min="0" max="100" step="1" value={scoreInput} onChange={(event) => setScoreInput(event.target.value)} disabled={!canRateInSeason || hasRatedInSeason} placeholder="—" title={hasRatedInSeason ? 'Você já avaliou este jogador nesta temporada' : canRateInSeason ? 'Nota de 0 a 100' : voteDisabledReason} className="w-36 rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 font-mono text-white disabled:cursor-not-allowed disabled:opacity-50" />
                        </span>
                      </label>
                      <button type="button" onClick={() => void handleSubmitVote()} disabled={!canRateInSeason || hasRatedInSeason || commentSubmitting || !scoreInput} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-amber-600/50 bg-amber-950/40 px-4 py-2 text-xs font-bold text-amber-200 transition hover:border-amber-400 hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-50">
                        <Star className="h-3.5 w-3.5" /> {commentSubmitting ? 'Confirmando…' : 'Confirmar nota'}
                      </button>
                    </div>
                    {(hasRatedInSeason || !canRateInSeason) && (
                      <p className="text-[11px] text-slate-500">{hasRatedInSeason ? 'Você já enviou sua nota para este jogador nesta temporada. Pode continuar comentando.' : `${voteDisabledReason} Comentários continuam disponíveis.`}</p>
                    )}
                    <form onSubmit={handleSubmitComment} className="space-y-2 border-t border-slate-800 pt-3">
                      <label className="block text-xs font-semibold text-slate-300">Comentário
                        <textarea value={commentInput} onChange={(event) => setCommentInput(event.target.value)} maxLength={500} rows={2} placeholder="Escreva um comentário para este perfil..." className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder:text-slate-500" />
                      </label>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p aria-live="polite" className={`text-xs ${feedback?.includes('confirmada') || feedback?.startsWith('Publicado') ? 'text-emerald-400' : 'text-amber-300'}`}>{feedback}</p>
                        <button type="submit" disabled={commentSubmitting || !commentInput.trim()} className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:from-red-500 hover:to-rose-500 disabled:cursor-wait disabled:opacity-60">Publicar comentário</button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-400">Entre na sua conta para votar ou comentar.</p>
                )
              )}

              {canResetRatings && receivedVotes.length > 0 && (
                <div className="space-y-2">
                  {receivedVotes.map((vote) => (
                    <article key={vote.id} className="flex items-start justify-between gap-3 rounded-xl border border-amber-700/25 bg-slate-900/60 p-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-white">{vote.fromUserName} avaliou na temporada {vote.season}</p>
                        {vote.comment && <p className="mt-1.5 whitespace-pre-wrap text-slate-300">{vote.comment}</p>}
                        <time className="mt-1.5 block text-[10px] text-slate-500">{new Date(vote.createdAt).toLocaleDateString('pt-BR')}</time>
                      </div>
                      <span className="shrink-0 rounded border border-amber-500/30 bg-black/40 px-2 py-1 font-mono text-sm font-bold text-amber-300">{vote.score}</span>
                    </article>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 pt-2 text-xs font-bold text-white"><MessageSquare className="h-4 w-4 text-red-400" /> Comentários da temporada {activeSeasonNumber}</div>

              {comments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">Ainda não há comentários nesta temporada.</div>
              ) : (
                <div className="space-y-2.5">
                  {comments.map((comment) => (
                    <article key={comment.id} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
                      <img src={comment.authorAvatar} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5"><strong className="text-white">{comment.authorName}</strong><span className="font-mono text-[10px] text-slate-400">{displayLogin(comment.authorHandle)}</span></div>
                          <div className="flex items-center gap-2">
                            {comment.scoreGiven !== undefined && <span className="rounded border border-amber-500/30 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">Nota {comment.scoreGiven}</span>}
                            {canDeleteComments && <button type="button" onClick={() => onDeleteComment(user.id, comment.id)} aria-label={`Excluir comentário de ${comment.authorName}`} className="rounded p-1 text-slate-500 transition hover:bg-red-950 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>}
                          </div>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-slate-200">{comment.text}</p>
                        <time className="mt-1.5 block text-[10px] text-slate-500">{comment.createdAt}</time>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </section>
    </div>
  );
};

const StatTile: React.FC<{
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: string;
  compact?: boolean;
}> = ({ label, value, icon, accent = 'text-white', compact = false }) => (
  <div className={`rounded-xl border border-slate-800 bg-slate-950/80 ${compact ? 'p-3' : 'p-3.5'}`}>
    <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      <span>{label}</span>{icon && <span className={accent}>{icon}</span>}
    </div>
    <p className={`mt-1 font-mono font-black ${compact ? 'text-base' : 'text-xl'} ${accent}`}>{value}</p>
  </div>
);
