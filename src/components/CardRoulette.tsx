import React, { useEffect, useState } from 'react';
import { CaptainRerollRequest, InterClassDraw, MatchDeckCard, User } from '../types';
import { rouletteSound } from '../utils/audio';
import { BackgroundImageField } from './BackgroundImageField';
import { 
  RotateCw, 
  Check, 
  Sparkles, 
  AlertTriangle, 
  Crown,
  Eye
} from 'lucide-react';

interface CardRouletteProps {
  deck: MatchDeckCard[];
  currentUser: User | null;
  isCaptain: boolean;
  currentUserRosterId: string | null;
  captainIds: [string, string];
  canEditCards: boolean;
  confirmedDeckCardId: string | null;
  captainRerollRequest: CaptainRerollRequest | null;
  interClassDraw: InterClassDraw | null;
  onUpdateDeck: (deck: MatchDeckCard[]) => void;
  onConfirmCard?: (card: MatchDeckCard) => void;
  onCaptainRerollRequest: (request: CaptainRerollRequest) => void;
  onRespondToCaptainReroll: (accepted: boolean) => void;
  onApproveCaptainReroll: (card: MatchDeckCard) => void;
  onDrawInterClass: (card: MatchDeckCard, blueClass: string, redClass: string) => void;
}

export const CardRoulette: React.FC<CardRouletteProps> = ({
  deck,
  currentUser,
  isCaptain,
  currentUserRosterId,
  captainIds,
  canEditCards,
  confirmedDeckCardId,
  captainRerollRequest,
  interClassDraw,
  onUpdateDeck,
  onConfirmCard,
  onCaptainRerollRequest,
  onRespondToCaptainReroll,
  onApproveCaptainReroll,
  onDrawInterClass,
}) => {
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [confirmedCard, setConfirmedCard] = useState<MatchDeckCard | null>(null);
  const [viewDeckModal, setViewDeckModal] = useState<boolean>(false);
  const [manualCardSelection, setManualCardSelection] = useState(false);
  const [editingCard, setEditingCard] = useState<MatchDeckCard | null>(null);

  const activeDeck = deck.filter((card) => card.isActive !== false);
  const activeCard = activeDeck[currentCardIndex];
  const captainRequestOpponent = captainRerollRequest?.opponentId === currentUserRosterId;
  const hasTwoCaptains = captainIds.filter(Boolean).length === 2;
  const isAssignedCaptain = Boolean(currentUserRosterId && captainIds.includes(currentUserRosterId));
  const canRequestReroll = Boolean(isCaptain && currentUser && currentUserRosterId
    && isAssignedCaptain && confirmedDeckCardId && hasTwoCaptains && !captainRerollRequest);
  const rerollDisabledReason = !confirmedDeckCardId
    ? 'Confirme a carta antes de solicitar um re-giro.'
    : !hasTwoCaptains
      ? 'O Criador precisa definir os dois capitães.'
      : !isAssignedCaptain
        ? 'Esta conta não está definida como capitão da partida.'
        : captainRerollRequest
          ? 'Já existe um pedido de re-giro em andamento.'
          : '';
  const interClassCard = activeCard?.title.trim().toLocaleLowerCase('pt-BR') === 'inter classe';
  const interClassDrawForCard = interClassDraw?.cardId === activeCard?.id ? interClassDraw : null;
  const interClassClasses = ['Magos', 'Lutadores', 'Assassinos', 'Suportes', 'Atiradores', 'Tanks'];

  const cardTheme = {
    border: 'border-amber-500/50',
    glow: 'shadow-amber-500/20',
    headerBg: 'from-slate-900 to-slate-950',
  };

  // Spin the card roulette with smooth harmonic chime
  const handleSpin = () => {
    if (!canEditCards || isSpinning || activeDeck.length === 0) return;
    setIsSpinning(true);
    setConfirmedCard(null);

    let spins = 0;
    const maxSpins = 14 + Math.floor(Math.random() * 6);
    const interval = setInterval(() => {
      setCurrentCardIndex((prev) => (prev + 1) % activeDeck.length);
      rouletteSound.playRouletteTick();
      spins++;
      if (spins >= maxSpins) {
        clearInterval(interval);
        setIsSpinning(false);
        rouletteSound.playRouletteFinish();
      }
    }, 100);
  };

  const handleCaptainRerollRequest = () => {
    if (!canRequestReroll || !currentUser || !currentUserRosterId) return;
    const opponentId = captainIds.find((id) => id && id !== currentUserRosterId);
    if (!opponentId) return;
    onCaptainRerollRequest({
      id: `captain-reroll:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      requesterId: currentUserRosterId,
      requesterName: currentUser.name,
      opponentId,
      status: 'waiting_opponent',
      createdAt: Date.now(),
    });
  };

  const handleConfirm = () => {
    if (!canEditCards || !activeCard) return;
    setConfirmedCard(activeCard);
    rouletteSound.playRouletteFinish();
    if (onConfirmCard) {
      onConfirmCard(activeCard);
    }
  };

  const handleApproveReroll = () => {
    if (!canEditCards || !activeDeck.length || isSpinning || captainRerollRequest?.status !== 'waiting_creator') return;
    const currentCardId = confirmedDeckCardId;
    const eligibleIndices = activeDeck.map((card, index) => ({ card, index }))
      .filter(({ card }) => activeDeck.length === 1 || card.id !== currentCardId);
    const chosen = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)] || { card: activeDeck[0], index: 0 };
    setIsSpinning(true);
    setConfirmedCard(null);
    let spins = 0;
    const maxSpins = 18;
    const interval = window.setInterval(() => {
      setCurrentCardIndex((previous) => (previous + 1) % activeDeck.length);
      rouletteSound.playRouletteTick();
      spins += 1;
      if (spins >= maxSpins) {
        window.clearInterval(interval);
        setCurrentCardIndex(chosen.index);
        setConfirmedCard(chosen.card);
        setIsSpinning(false);
        rouletteSound.playRouletteFinish();
        onApproveCaptainReroll(chosen.card);
      }
    }, 90);
  };

  const handleDrawInterClass = () => {
    if (!canEditCards || !activeCard || !interClassCard || confirmedDeckCardId !== activeCard.id) return;
    const firstIndex = Math.floor(Math.random() * interClassClasses.length);
    const remaining = interClassClasses.filter((_, index) => index !== firstIndex);
    const second = remaining[Math.floor(Math.random() * remaining.length)];
    onDrawInterClass(activeCard, interClassClasses[firstIndex], second);
  };

  const handleSaveEditedCard = () => {
    if (!canEditCards || !editingCard) return;
    onUpdateDeck(deck.map((card) => card.id === editingCard.id ? editingCard : card));
    setEditingCard(null);
  };

  const captainOnlyMode = isCaptain && !canEditCards;

  useEffect(() => {
    if (!canEditCards) setEditingCard(null);
    if (captainOnlyMode) setViewDeckModal(false);
  }, [canEditCards, captainOnlyMode]);

  useEffect(() => {
    if (currentCardIndex >= activeDeck.length) setCurrentCardIndex(0);
  }, [activeDeck.length, currentCardIndex]);

  useEffect(() => {
    if (!confirmedDeckCardId) {
      setConfirmedCard(null);
      return;
    }
    const confirmedIndex = activeDeck.findIndex((card) => card.id === confirmedDeckCardId);
    if (confirmedIndex < 0) return;
    setCurrentCardIndex(confirmedIndex);
    setConfirmedCard(activeDeck[confirmedIndex]);
  }, [confirmedDeckCardId, deck]);

  return (
    <div className="relative w-full max-w-4xl mx-auto p-4 md:p-6 bg-slate-950/80 rounded-2xl border border-red-900/40 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-red-900/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-950/80 border border-red-700/60 text-red-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-display font-extrabold text-white tracking-wide">
              Roleta de cartas
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {!captainOnlyMode && (
            <button
              onClick={() => { setManualCardSelection(false); setViewDeckModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
            >
              <Eye className="w-4 h-4 text-amber-400" />
              Ver Baralho ({activeDeck.length} ativas)
            </button>
          )}
          {canEditCards && (
            <button
              type="button"
              onClick={() => { setManualCardSelection(true); setViewDeckModal(true); }}
              disabled={activeDeck.length === 0 || isSpinning}
              className="flex items-center gap-1.5 rounded-lg border border-amber-600/60 bg-amber-950/40 px-3 py-1.5 text-xs font-bold text-amber-200 transition-colors hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Escolher carta manualmente
            </button>
          )}
        </div>
      </div>

      {/* Main Roulette Visual Showcase */}
      <div className="my-8 flex flex-col items-center justify-center">
        {/* The Card */}
        {activeCard ? (
        <div className="relative isolate w-full max-w-md">
          {confirmedCard?.id === activeCard.id && (
            <div key={confirmedCard.id} className="card-confirmation-confetti" aria-hidden="true">
              {Array.from({ length: 24 }, (_, index) => {
                const colors = ['#facc15', '#fb7185', '#38bdf8', '#34d399', '#c084fc'];
                const edge = index % 4;
                const position = Math.floor(index / 4) / 5;
                const left = edge === 0 ? `${8 + position * 84}%` : edge === 1 ? '-2%' : edge === 2 ? '102%' : `${8 + position * 84}%`;
                const top = edge === 0 ? '-10px' : edge === 1 || edge === 2 ? `${12 + position * 76}%` : 'calc(100% + 2px)';
                const x = edge === 1 ? '-26px' : edge === 2 ? '26px' : `${(position - 0.5) * 28}px`;
                const y = edge === 0 ? '-30px' : edge === 3 ? '30px' : `${(position - 0.5) * 20}px`;
                const style = {
                  left,
                  top,
                  backgroundColor: colors[index % colors.length],
                  animationDelay: `${(index % 8) * 35}ms`,
                  '--confetti-x': x,
                  '--confetti-y': y,
                  '--confetti-rotation': `${240 + index * 35}deg`,
                } as React.CSSProperties;

                return <span key={index} className="card-confirmation-confetti__piece" style={style} />;
              })}
            </div>
          )}
          <div
            className={`relative z-10 w-full min-h-[340px] overflow-hidden rounded-2xl border-2 ${cardTheme.border} bg-gradient-to-b ${cardTheme.headerBg} p-6 pt-0 shadow-2xl transition-all duration-500 transform ${
              isSpinning ? 'scale-95 rotate-y-180 animate-pulse' : 'scale-100 hover:scale-[1.02]'
            } ${cardTheme.glow}`}
          >
          {activeCard.backgroundImage && (
            <div className="relative -mx-6 mb-5 flex max-h-72 w-[calc(100%+3rem)] items-center justify-center overflow-hidden rounded-t-[14px] bg-black/70">
              <img src={activeCard.backgroundImage} alt={`Imagem da carta ${activeCard.title}`} className="block max-h-72 w-full object-contain" />
            </div>
          )}

          {/* Card Title */}
          <div className="relative z-10 my-4 text-center">
            <h3 className="text-2xl font-display font-black text-white tracking-wide">
              {activeCard.title}
            </h3>
          </div>

          {/* Rule Box */}
          <div className="relative z-10 mt-4 p-3.5 rounded-xl bg-black/60 border border-white/10 shadow-inner">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Regra Mandatória no Rift:
            </div>
            <p className="whitespace-pre-line text-sm font-semibold text-slate-100 leading-snug">
              {activeCard.rule}
            </p>
          </div>

          {/* Description */}
          <p className="relative z-10 mt-3 whitespace-pre-line text-center text-xs italic text-slate-300">
            "{activeCard.description}"
          </p>

          {interClassCard && (
            <section className="relative z-10 mt-4 rounded-xl border border-cyan-500/30 bg-slate-950/80 p-3.5" aria-label="Sorteio de classes Inter Classe">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-cyan-200">Sorteio Inter Classe</h4>
                  <p className="mt-1 text-[11px] text-slate-400">Uma classe para cada time, sorteadas sem repetição.</p>
                </div>
                {canEditCards && (
                  <button
                    type="button"
                    onClick={handleDrawInterClass}
                    disabled={isSpinning || confirmedDeckCardId !== activeCard.id}
                    className="rounded-lg border border-cyan-400/50 bg-cyan-950/70 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Sortear classes
                  </button>
                )}
              </div>
              {interClassDrawForCard ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-sky-500/40 bg-sky-950/50 p-2.5 text-center">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-sky-300">Time Azul</span>
                    <span className="mt-1 block text-sm font-black text-white">{interClassDrawForCard.blueClass}</span>
                  </div>
                  <div className="rounded-lg border border-rose-500/40 bg-rose-950/50 p-2.5 text-center">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-rose-300">Time Vermelho</span>
                    <span className="mt-1 block text-sm font-black text-white">{interClassDrawForCard.redClass}</span>
                  </div>
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-slate-700 px-3 py-2 text-center text-xs text-slate-500">
                  {confirmedDeckCardId === activeCard.id ? 'As classes ainda não foram sorteadas.' : 'Confirme esta carta para liberar o sorteio das classes.'}
                </p>
              )}
            </section>
          )}

          </div>
        </div>
        ) : (
          <div className="flex min-h-[340px] w-full max-w-md items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            Nenhuma carta ativa no baralho. Ative uma carta no Painel do Criador para continuar.
          </div>
        )}

        {captainRerollRequest && (
          <div className="mt-4 w-full max-w-md rounded-xl border border-amber-500/40 bg-slate-900 p-4 text-center shadow-xl" role="status">
            <div className="mb-2 flex items-center justify-center gap-2 text-amber-200">
              <Crown className="h-5 w-5 text-amber-400" />
              <span className="text-sm font-bold">Pedido de re-giro</span>
            </div>
            {captainRerollRequest.status === 'waiting_opponent' ? (
              <>
                <p className="mb-3 text-xs text-slate-200">O capitão {captainRerollRequest.requesterName} pediu um novo giro. O outro capitão precisa concordar.</p>
                {captainRequestOpponent && (
                  <div className="flex justify-center gap-2">
                    <button type="button" onClick={() => onRespondToCaptainReroll(true)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"><Check className="h-4 w-4" /> Concordar</button>
                    <button type="button" onClick={() => onRespondToCaptainReroll(false)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700">Recusar</button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-200">O capitão {captainRerollRequest.acceptedByName || 'adversário'} concordou. {canEditCards ? 'Confirme o novo giro para publicar a carta.' : 'Aguardando o Criador confirmar o novo giro.'}</p>
            )}
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-red-900/30">
        {canEditCards && <>
          <button
            onClick={handleSpin}
            disabled={isSpinning || Boolean(captainRerollRequest)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-red-950/40 transition-all disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
            {isSpinning ? 'Sorteando...' : 'Girar Outra Vez'}
          </button>

          <button
            onClick={handleConfirm}
            disabled={isSpinning || !activeCard}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Confirmar Carta
          </button>
        </>}

        {canEditCards && captainRerollRequest?.status === 'waiting_opponent' && (
          <button type="button" disabled title="O segundo capitão ainda precisa concordar com o pedido." className="inline-flex cursor-wait items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/50 px-5 py-2.5 text-sm font-bold text-amber-200 opacity-90">
            <Crown className="h-4 w-4 text-amber-400" />
            Re-giro pedido por {captainRerollRequest.requesterName}
          </button>
        )}

        {canEditCards && captainRerollRequest?.status === 'waiting_creator' && (
          <button type="button" onClick={handleApproveReroll} disabled={isSpinning} className="inline-flex items-center gap-2 rounded-xl border border-amber-400/60 bg-amber-400 px-5 py-2.5 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/40 transition hover:bg-amber-300 disabled:opacity-50">
            <RotateCw className={`h-4 w-4 ${isSpinning ? 'animate-spin' : ''}`} />
            {isSpinning ? 'Sorteando...' : 'Confirmar novo giro'}
          </button>
        )}

        {isCaptain && !canEditCards && currentUser && (
          <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleCaptainRerollRequest}
            disabled={isSpinning || !canRequestReroll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/50 text-amber-300 font-medium text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
            title={rerollDisabledReason || 'Solicita ao outro capitão a chance de girar outra carta'}
          >
            <Crown className="w-4 h-4 text-amber-400" />
            Pedir Re-Giro (Capitão)
          </button>
          {!canRequestReroll && rerollDisabledReason && (
            <span className="max-w-xs text-center text-[10px] text-slate-500">{rerollDisabledReason}</span>
          )}
          </div>
        )}
      </div>

      {/* View Deck Modal */}
      {viewDeckModal && !captainOnlyMode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-white">
                {manualCardSelection ? 'Escolher carta manualmente' : `Baralho de Cartas (${activeDeck.length} ativas)`}
                </h3>
                {manualCardSelection && <p className="mt-1 text-xs text-slate-400">Escolha uma carta. Ela será aplicada e confirmada para a partida.</p>}
              </div>
              <button
                onClick={() => { setViewDeckModal(false); setManualCardSelection(false); }}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Fechar seleção de cartas"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeDeck.map((c, i) => (
                <div
                  key={c.id}
                  className={`rounded-xl border p-2.5 transition-all ${activeCard?.id === c.id ? 'border-amber-500/60 bg-amber-950/20' : 'border-slate-800 bg-slate-950/70'}`}
                >
                  <div className="flex items-center gap-2.5">
                    {c.backgroundImage ? (
                      <img src={c.backgroundImage} alt="" aria-hidden="true" className="h-12 w-16 shrink-0 rounded-lg border border-slate-700 bg-black/60 object-contain" />
                    ) : (
                      <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Sem foto</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-bold font-display text-white">{c.title}</span>
                        {activeCard?.id === c.id && <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-300">Atual</span>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-400">{c.rule}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {manualCardSelection && canEditCards && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isSpinning) return;
                            setCurrentCardIndex(i);
                            setConfirmedCard(c);
                            setViewDeckModal(false);
                            setManualCardSelection(false);
                            rouletteSound.playRouletteFinish();
                            onConfirmCard?.(c);
                          }}
                          disabled={isSpinning || confirmedCard?.id === c.id}
                          aria-pressed={confirmedCard?.id === c.id}
                          className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmedCard?.id === c.id ? 'border border-emerald-700/60 bg-emerald-950/50 text-emerald-300' : 'bg-amber-500 text-slate-950 hover:bg-amber-400'}`}
                        >
                          {confirmedCard?.id === c.id ? 'Confirmada' : 'Escolher'}
                        </button>
                      )}
                      {canEditCards && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingCard({ ...c, tags: [...c.tags] });
                          }}
                          aria-label={`Editar foto da carta ${c.title}`}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:border-slate-500 hover:text-white"
                        >
                          Foto
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingCard && canEditCards && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="mb-1 font-display text-lg font-bold text-white">Foto da carta: {editingCard.title}</h3>
            <p className="mb-4 text-xs text-slate-400">A imagem aparece na frente da carta, separada do título e da regra.</p>
            <div className="space-y-3 text-xs">
              <BackgroundImageField
                label="Imagem principal da carta"
                value={editingCard.backgroundImage}
                onChange={(backgroundImage) => setEditingCard({ ...editingCard, backgroundImage })}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingCard(null)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300">Cancelar</button>
              <button type="button" onClick={handleSaveEditedCard} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500">Salvar foto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
