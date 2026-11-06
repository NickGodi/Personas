import React, { useMemo, useRef, useState } from 'react';
import { User, CardItem, Lane, SeasonArchive, EloTier, VoteRecord } from '../types';
import { getTierFromScore } from '../data/initialData';
import { RankedCard } from './RankedCard';
import { TierCardOrnamentSettings } from '../utils/cardOrnament';
import {
  Award,
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
  allCards: CardItem[];
  ornamentSettingsByTier?: TierCardOrnamentSettings;
  seasonArchives: SeasonArchive[];
  currentUser: User | null;
  isOwnProfile: boolean;
  canImpersonateUser: boolean;
  canResetRatings: boolean;
  onImpersonateUser: (user: User) => void;
  onResetRating: (userId: string) => void;
  canDeleteComments: boolean;
  onUpdateProfile: (updated: Partial<User>) => string | null | Promise<string | null>;
  onCastVote: (vote: { targetUserId: string; score: number; comment?: string }) => void;
  onAddComment: (targetUserId: string, text: string) => void;
  onDeleteComment: (targetUserId: string, commentId: string) => void;
  onOpenReportModal?: (targetUser: User) => void;
}

type ProfileTab = 'profile' | 'stats' | 'history' | 'comments';

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
  allCards,
  ornamentSettingsByTier,
  seasonArchives,
  currentUser,
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
  const [handle, setHandle] = useState(user.handle);
  const [email, setEmail] = useState(user.email || '');
  const [avatar, setAvatar] = useState(user.avatar.startsWith('data:') ? '' : user.avatar);
  const [bio, setBio] = useState(user.bio);
  const [favoriteChampion, setFavoriteChampion] = useState(user.favoriteChampion);
  const [primaryLane, setPrimaryLane] = useState<Lane>(user.primaryLane);
  const [riotId, setRiotId] = useState(user.riotId);
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<ProfileTab>(isOwnProfile ? 'profile' : 'stats');
  const [scoreInput, setScoreInput] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarFileInput = useRef<HTMLInputElement>(null);

  const userCards = useMemo(() => allCards.filter((card) => card.userId === user.id), [allCards, user.id]);
  const availableSeasons = useMemo(
    () => Array.from(new Set([
      ...userCards.map((card) => card.season),
      ...seasonArchives.filter((season) => season.playerSnapshots.some((player) => player.userId === user.id)).map((season) => season.number),
    ])).sort((a, b) => b - a),
    [userCards, seasonArchives, user.id]
  );
  const filteredCards = userCards.filter((card) => seasonFilter === 'all' || card.season === Number(seasonFilter));
  const seasonRecords = seasonArchives
    .filter((season) => seasonFilter === 'all' || season.number === Number(seasonFilter))
    .map((season) => ({
      season,
      player: season.playerSnapshots.find((snapshot) => snapshot.userId === user.id),
    }))
    .filter((record) => record.player);
  const comments = user.comments || [];
  const currentSeasonVotes = useMemo(
    () => votes.filter((vote) => vote.targetUserId === user.id && vote.season === activeSeasonNumber),
    [votes, user.id, activeSeasonNumber],
  );
  const currentAverage = currentSeasonVotes.length
    ? Math.round(currentSeasonVotes.reduce((sum, vote) => sum + vote.score, 0) / currentSeasonVotes.length)
    : null;
  const tier = currentAverage === null ? null : getTierFromScore(currentAverage, Boolean(user.isCriminoso));
  const kda = ((user.stats.kills + user.stats.assists) / Math.max(1, user.stats.deaths)).toFixed(2);
  const avatarPreview = avatar.trim() || user.avatar;

  if (!isOpen) return null;

  const handleSave = async () => {
    const normalizedHandle = `@${handle.trim().replace(/^@+/, '')}`;
    if (normalizedHandle.length < 2) {
      setProfileSaveError('Informe um @ válido para seu perfil.');
      return;
    }
    setProfileSaveError(null);
    setProfileSaving(true);
    try {
      const saveError = await onUpdateProfile({ name, handle: normalizedHandle, email: email.trim().toLowerCase(), avatar: avatar.trim() || user.avatar, bio, favoriteChampion, primaryLane, riotId });
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

  const handleSubmitComment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || currentUser.id === user.id) return;

    const comment = commentInput.trim();
    const score = scoreInput === '' ? undefined : Number(scoreInput);
    if (score === undefined && !comment) {
      setFeedback('Digite um comentário ou uma nota para publicar.');
      return;
    }
    if (score !== undefined && (!Number.isInteger(score) || score < 0 || score > 100)) {
      setFeedback('A nota precisa ser um número inteiro entre 0 e 100.');
      return;
    }

    if (score !== undefined) {
      onCastVote({ targetUserId: user.id, score, comment: comment || undefined });
    } else {
      onAddComment(user.id, comment);
    }
    setScoreInput('');
    setCommentInput('');
    setFeedback('Publicado no perfil do jogador.');
  };

  const tabs: { id: ProfileTab; label: string }[] = [
    ...(isOwnProfile ? [{ id: 'profile' as const, label: 'Meu perfil' }] : []),
    { id: 'stats', label: 'Estatísticas' },
    { id: 'history', label: 'Histórico' },
    { id: 'comments', label: `Conversa (${comments.length})` },
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
                <span className="rounded-full border border-red-800 bg-red-950 px-2 py-0.5 font-mono text-[10px] text-red-300">{user.handle}</span>
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
              <button type="button" onClick={() => { onImpersonateUser(user); setActiveTab('profile'); }} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600/50 bg-amber-950/50 px-2.5 py-1.5 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-900/60">
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
                <label className="text-slate-300">Seu @ no site
                  <input value={handle} onChange={(event) => { setHandle(event.target.value); setProfileSaveError(null); }} placeholder="@nick" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 font-mono text-white" />
                </label>
                <label className="text-slate-300">E-mail de login (privado)
                  <input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setProfileSaveError(null); }} placeholder="voce@exemplo.com" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white" />
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
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatTile label="Média atual" value={currentAverage ?? '—'} icon={<Sparkles className="h-4 w-4" />} accent={currentAverage === null ? 'text-slate-500' : 'text-amber-300'} />
                <StatTile label="Votos recebidos" value={currentSeasonVotes.length} icon={<Star className="h-4 w-4" />} accent="text-sky-300" />
                <StatTile label="Temporadas" value={user.seasonsPlayed} icon={<Trophy className="h-4 w-4" />} accent="text-rose-300" />
                <StatTile label="KDA" value={kda} icon={<Award className="h-4 w-4" />} accent="text-emerald-300" />
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
                  <StatTile label="Abates" value={user.stats.kills} compact />
                  <StatTile label="Mortes" value={user.stats.deaths} compact />
                  <StatTile label="Assistências" value={user.stats.assists} compact />
                  <StatTile label="Wards" value={user.stats.wards} compact />
                  <StatTile label="Dano causado" value={user.stats.damageDealt.toLocaleString('pt-BR')} compact />
                  <StatTile label="Dano recebido" value={user.stats.damageReceived.toLocaleString('pt-BR')} compact />
                </div>
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

              {filteredCards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-xs text-slate-500">Nenhuma carta salva nesta temporada.</div>
              ) : (
                <div className="flex flex-wrap justify-center gap-6 py-2">
                  {filteredCards.map((card) => <RankedCard key={card.id} card={card} size="sm" ornamentSettings={ornamentSettingsByTier?.[card.tier]} />)}
                </div>
              )}
            </section>
          )}

          {activeTab === 'comments' && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="flex items-center gap-2 font-display text-sm font-bold text-white"><MessageSquare className="h-4 w-4 text-red-400" /> Conversa do jogador</h3>
                  <p className="mt-1 text-xs text-slate-400">Comentários publicados ficam neste perfil; eles não são enviados como mensagem privada.</p>
                </div>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 font-mono text-[10px] text-slate-300">{comments.length}</span>
              </div>

              {!isOwnProfile && (
                currentUser ? (
                  <form onSubmit={handleSubmitComment} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
                      <label className="text-xs font-semibold text-slate-300">Nota opcional (0 a 100)
                        <span className="relative mt-1 block">
                          <Calculator className="absolute left-3 top-3 h-4 w-4 text-amber-400" />
                          <input type="number" min="0" max="100" step="1" value={scoreInput} onChange={(event) => setScoreInput(event.target.value)} placeholder="—" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 font-mono text-white" />
                        </span>
                      </label>
                      <label className="text-xs font-semibold text-slate-300">Comentário
                        <textarea value={commentInput} onChange={(event) => setCommentInput(event.target.value)} maxLength={500} rows={2} placeholder="Escreva um comentário para este perfil..." className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder:text-slate-500" />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p aria-live="polite" className={`text-xs ${feedback?.startsWith('Publicado') ? 'text-emerald-400' : 'text-amber-300'}`}>{feedback}</p>
                      <button type="submit" className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:from-red-500 hover:to-rose-500">Publicar no perfil</button>
                    </div>
                  </form>
                ) : (
                  <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-400">Entre na sua conta para comentar ou avaliar.</p>
                )
              )}

              {comments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">Ainda não há comentários neste perfil.</div>
              ) : (
                <div className="space-y-2.5">
                  {comments.map((comment) => (
                    <article key={comment.id} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
                      <img src={comment.authorAvatar} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5"><strong className="text-white">{comment.authorName}</strong><span className="font-mono text-[10px] text-slate-400">{comment.authorHandle}</span></div>
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
