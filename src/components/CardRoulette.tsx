import React, { useEffect, useState } from 'react';
import { MatchDeckCard, User } from '../types';
import { rouletteSound } from '../utils/audio';
import { BackgroundImageField } from './BackgroundImageField';
import { 
  RotateCw, 
  Check, 
  Sparkles, 
  ShieldAlert, 
  AlertTriangle, 
  Crown,
  Eye
} from 'lucide-react';

interface CardRouletteProps {
  deck: MatchDeckCard[];
  currentUser: User | null;
  isCaptain: boolean;
  canEditCards: boolean;
  onUpdateDeck: (deck: MatchDeckCard[]) => void;
  onConfirmCard?: (card: MatchDeckCard) => void;
}

export const CardRoulette: React.FC<CardRouletteProps> = ({
  deck,
  currentUser,
  isCaptain,
  canEditCards,
  onUpdateDeck,
  onConfirmCard,
}) => {
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [confirmedCard, setConfirmedCard] = useState<MatchDeckCard | null>(null);
  const [captainRequestPending, setCaptainRequestPending] = useState<boolean>(false);
  const [requestFeedback, setRequestFeedback] = useState<string | null>(null);
  const [viewDeckModal, setViewDeckModal] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<MatchDeckCard | null>(null);

  const activeCard = deck[currentCardIndex] || deck[0];

  const cardTheme = {
    border: 'border-amber-500/50',
    glow: 'shadow-amber-500/20',
    headerBg: 'from-slate-900 to-slate-950',
    accent: 'text-amber-300',
  };

  // Spin the card roulette with smooth harmonic chime
  const handleSpin = () => {
    if (!canEditCards || isSpinning || deck.length === 0) return;
    setIsSpinning(true);
    setConfirmedCard(null);
    setRequestFeedback(null);

    let spins = 0;
    const maxSpins = 14 + Math.floor(Math.random() * 6);
    const interval = setInterval(() => {
      setCurrentCardIndex((prev) => (prev + 1) % deck.length);
      rouletteSound.playRouletteTick();
      spins++;
      if (spins >= maxSpins) {
        clearInterval(interval);
        setIsSpinning(false);
        rouletteSound.playRouletteFinish();
      }
    }, 100);
  };

  // Captain requesting reroll flow
  const handleCaptainRerollRequest = () => {
    if (!currentUser || !isCaptain || canEditCards) return;
    setCaptainRequestPending(true);
    setRequestFeedback(`Capitão ${currentUser.name} solicitou um novo giro! Aguardando aceite do capitão adversário...`);
  };

  const handleOpponentCaptainResponse = (accepted: boolean) => {
    setCaptainRequestPending(false);
    if (accepted) {
      setRequestFeedback('Aceite concedido pelo capitão adversário! Sorteando outra carta...');
      setTimeout(() => {
        handleSpin();
      }, 400);
    } else {
      setRequestFeedback('O capitão adversário recusou o pedido de re-giro. A carta atual permanece.');
    }
  };

  const handleConfirm = () => {
    if (!canEditCards) return;
    setConfirmedCard(activeCard);
    rouletteSound.playRouletteFinish();
    if (onConfirmCard) {
      onConfirmCard(activeCard);
    }
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
              Sorteio de Carta Pré-Partida (Personas)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gire a roleta antes da partida. O baralho reúne regras Personas e títulos do catálogo CBLOW, com efeitos adaptados para as partidas daqui.
          </p>
        </div>

        {!captainOnlyMode && (
          <button
            onClick={() => setViewDeckModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
          >
            <Eye className="w-4 h-4 text-amber-400" />
            Ver Baralho ({deck.length} cartas)
          </button>
        )}
      </div>

      {/* Main Roulette Visual Showcase */}
      <div className="my-8 flex flex-col items-center justify-center">
        {/* The Card */}
        <div
          className={`relative w-full max-w-md min-h-[340px] overflow-hidden rounded-2xl border-2 ${cardTheme.border} bg-gradient-to-b ${cardTheme.headerBg} p-6 shadow-2xl transition-all duration-500 transform ${
            isSpinning ? 'scale-95 rotate-y-180 animate-pulse' : 'scale-100 hover:scale-[1.02]'
          } ${cardTheme.glow}`}
        >
          {activeCard.backgroundImage && (
            <>
              <img src={activeCard.backgroundImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/65 via-slate-950/50 to-slate-950/80" />
            </>
          )}

          {/* Card Title & Icon */}
          <div className="relative z-10 my-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center shadow-inner mb-3">
              <ShieldAlert className={`w-8 h-8 ${cardTheme.accent}`} />
            </div>
            <h3 className="text-2xl font-display font-black text-white tracking-wide">
              {activeCard.title}
            </h3>
            <div className="flex justify-center gap-1.5 mt-2">
              {activeCard.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-slate-300 border border-white/5"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Rule Box */}
          <div className="relative z-10 mt-4 p-3.5 rounded-xl bg-black/60 border border-white/10 shadow-inner">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Regra Mandatória no Rift:
            </div>
            <p className="text-sm font-semibold text-slate-100 leading-snug">
              {activeCard.rule}
            </p>
          </div>

          {/* Description */}
          <p className="relative z-10 text-xs text-slate-300 mt-3 text-center italic">
            "{activeCard.description}"
          </p>

          {/* Confirmed Stamp */}
          {confirmedCard?.id === activeCard.id && (
            <div className="absolute inset-0 bg-black/80 rounded-2xl backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-2 animate-bounce">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h4 className="text-lg font-black font-display text-emerald-300">CARTA CONFIRMADA!</h4>
              <p className="text-xs text-slate-300 text-center mt-1">
                A regra <span className="font-bold text-white">{activeCard.title}</span> está ativa para este confronto.
              </p>
            </div>
          )}
        </div>

        {/* Feedback Message if any */}
        {requestFeedback && (
          <div className="mt-4 p-3 rounded-xl bg-slate-900 border border-amber-500/40 text-center max-w-md w-full">
            <p className="text-xs text-amber-300 font-medium">{requestFeedback}</p>
          </div>
        )}

        {/* Opponent Captain Confirmation Box */}
        {captainRequestPending && canEditCards && (
          <div className="mt-4 p-4 rounded-xl bg-red-950/90 border border-red-500/70 text-center max-w-md w-full shadow-xl">
            <div className="flex items-center justify-center gap-2 mb-2 text-red-300">
              <Crown className="w-5 h-5 text-amber-400" />
              <span className="font-bold text-sm">Decisão do Capitão Oponente</span>
            </div>
            <p className="text-xs text-slate-200 mb-3">
              O capitão adversário solicitou girar novamente a roleta. Você aceita o re-giro da carta?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => handleOpponentCaptainResponse(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-md"
              >
                <Check className="w-4 h-4" /> Aceitar Re-Giro
              </button>
              <button
                onClick={() => handleOpponentCaptainResponse(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs rounded-lg transition-colors"
              >
                Recusar (Manter Carta)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-red-900/30">
        {canEditCards && <>
          <button
            onClick={handleSpin}
            disabled={isSpinning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-red-950/40 transition-all disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
            {isSpinning ? 'Sorteando...' : 'Girar Outra Vez'}
          </button>

          <button
            onClick={handleConfirm}
            disabled={isSpinning || confirmedCard?.id === activeCard.id}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Confirmar Carta
          </button>
        </>}

        {isCaptain && !canEditCards && (
          <button
            onClick={handleCaptainRerollRequest}
            disabled={isSpinning || captainRequestPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/50 text-amber-300 font-medium text-sm transition-all disabled:opacity-50"
            title="Solicita ao capitão adversário a chance de rodar outra carta"
          >
            <Crown className="w-4 h-4 text-amber-400" />
            Pedir Re-Giro (Capitão)
          </button>
        )}
      </div>

      {/* View Deck Modal */}
      {viewDeckModal && !captainOnlyMode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">
                Baralho de Cartas ({deck.length})
              </h3>
              <button
                onClick={() => setViewDeckModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3">
              {deck.map((c, i) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setCurrentCardIndex(i);
                    setViewDeckModal(false);
                  }}
                  className="relative overflow-hidden p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 cursor-pointer transition-all flex flex-col justify-between"
                >
                  {c.backgroundImage && (
                    <>
                      <img src={c.backgroundImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-45" />
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/45 to-slate-950/75" />
                    </>
                  )}
                  <div className="relative z-10">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold font-display text-white">{c.title}</span>
                      {canEditCards && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingCard({ ...c, tags: [...c.tags] });
                          }}
                          aria-label={`Editar foto da carta ${c.title}`}
                          className="shrink-0 rounded-md border border-slate-600 bg-slate-900/90 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:border-amber-400"
                        >
                          Foto
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2">{c.rule}</p>
                  </div>
                  <div className="relative z-10 mt-2 text-[10px] text-amber-400/80 italic">Clique para selecionar</div>
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
            <p className="mb-4 text-xs text-slate-400">Adicione, substitua ou remova a imagem de fundo da carta.</p>
            <div className="space-y-3 text-xs">
              <BackgroundImageField
                label="Imagem de fundo"
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
