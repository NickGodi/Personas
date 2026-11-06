import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpToLine, Eye, EyeOff, Move, RotateCcw, Scaling } from 'lucide-react';
import { CardItem, CardOrnamentSettings, EloTier, User } from '../types';
import { DEFAULT_CARD_ORNAMENT_SETTINGS, getTierOrnamentReferenceCard, normalizeCardOrnamentSettings, ORNAMENT_TIER_ORDER, TierCardOrnamentSettings } from '../utils/cardOrnament';
import { RankedCard } from './RankedCard';

const TIER_LABELS: Partial<Record<EloTier, string>> = {
  lenda: 'Lenda', challenger: 'Challenger', grao_mestre: 'Grão-Mestre', mestre: 'Mestre',
  diamante: 'Diamante', esmeralda: 'Esmeralda', platina: 'Platina', ouro: 'Ouro',
  prata: 'Prata', bronze: 'Bronze', ferro: 'Ferro', madeira: 'Madeira', criminoso: 'Criminoso',
};

const TIER_PREVIEW_SCORES: Partial<Record<EloTier, number>> = {
  lenda: 99, challenger: 95, grao_mestre: 85, mestre: 78, diamante: 72, esmeralda: 64,
  platina: 56, ouro: 50, prata: 43, bronze: 35, ferro: 27, madeira: 19, criminoso: 8,
};

const createPreviewCard = (tier: EloTier, user?: User): CardItem => ({
  id: `ornament-preview-${tier}`,
  userId: user?.id || 'ornament-preview-player',
  userName: user?.name || 'Prévia do elo',
  userHandle: user?.handle || '@previa',
  userAvatar: user?.avatar || '',
  season: 1,
  score: TIER_PREVIEW_SCORES[tier] ?? 50,
  tier,
  lane: user?.primaryLane || 'MID',
  favoriteChampion: user?.favoriteChampion || '',
  isMvp: false,
  isAce: false,
  isCriminoso: tier === 'criminoso',
  isLegend: tier === 'lenda',
  isMencaoHonrosa: false,
  stats: user?.stats || { kills: 0, deaths: 0, assists: 0, minions: 0, gold: 0 },
  date: '2026-01-01T00:00:00.000Z',
});

interface CardOrnamentEditorProps {
  cards: CardItem[];
  users: User[];
  ornamentSettingsByTier: TierCardOrnamentSettings;
  defaultSettings: CardOrnamentSettings;
  onSave: (tier: EloTier, settings: CardOrnamentSettings) => void | Promise<void>;
}

const RangeControl: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  description?: string;
  percentageInput?: boolean;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step, displayValue, description, percentageInput = false, onChange }) => {
  const [percentageText, setPercentageText] = useState(String(Math.round(value * 100)));

  useEffect(() => {
    setPercentageText(String(Math.round(value * 100)));
  }, [value]);

  const commitPercentage = () => {
    const parsed = Number(percentageText);
    const bounded = Number.isFinite(parsed)
      ? Math.min(max * 100, Math.max(min * 100, parsed))
      : value * 100;
    const rounded = Math.round(bounded);
    setPercentageText(String(rounded));
    onChange(rounded / 100);
  };

  return (
    <label className="block rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <span className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-200">
        <span>{label}</span>
        {percentageInput ? (
          <span className="inline-flex items-center gap-1 text-amber-300">
            <input
              type="number"
              min={min * 100}
              max={max * 100}
              step={step * 100}
              value={percentageText}
              aria-label={`${label} em porcentagem`}
              onChange={(event) => setPercentageText(event.target.value)}
              onBlur={commitPercentage}
              onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
              className="w-16 rounded-md border border-slate-700 bg-slate-900 px-1.5 py-1 text-right font-mono text-amber-300 focus:border-amber-400 focus:outline-none"
            />
            <span>%</span>
          </span>
        ) : (
          <span className="font-mono text-amber-300">{displayValue}</span>
        )}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-amber-400"
      />
      {description && <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">{description}</span>}
    </label>
  );
};

export const CardOrnamentEditor: React.FC<CardOrnamentEditorProps> = ({ cards, users, ornamentSettingsByTier, defaultSettings, onSave }) => {
  const cardsWithOrnament = useMemo(() => {
    return cards.map((card) => {
      const currentProfile = users.find((user) => user.id === card.userId);
      return currentProfile ? {
        ...card,
        userName: currentProfile.name,
        userHandle: currentProfile.handle,
        userAvatar: currentProfile.avatar,
        lane: currentProfile.primaryLane,
        favoriteChampion: currentProfile.favoriteChampion,
      } : card;
    });
  }, [cards, users]);
  const previewCardsByTier = useMemo(() => ORNAMENT_TIER_ORDER
    .map((tier) => getTierOrnamentReferenceCard(cardsWithOrnament, tier) ?? createPreviewCard(tier, users[0])), [cardsWithOrnament, users]);
  const [previewTier, setPreviewTier] = useState<EloTier>(previewCardsByTier[0]?.tier || 'challenger');
  const [previewMvpMode, setPreviewMvpMode] = useState<'card' | 'without' | 'mvp'>('card');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const saveRequestId = useRef(0);
  const previewCard = useMemo(() => previewCardsByTier.find((card) => card.tier === previewTier) || previewCardsByTier[0], [previewCardsByTier, previewTier]);
  const selectedSettings = ornamentSettingsByTier[previewTier] ?? previewCard?.ornamentSettings ?? defaultSettings;
  const [draft, setDraft] = useState<CardOrnamentSettings>(() => normalizeCardOrnamentSettings(selectedSettings));
  const previewCardVariant = previewCard ? {
    ...previewCard,
    isMvp: previewMvpMode === 'mvp' || (previewMvpMode === 'card' && previewCard.isMvp),
    ornamentSettings: draft,
  } : undefined;

  useEffect(() => {
    setDraft(normalizeCardOrnamentSettings(selectedSettings));
  }, [previewTier, selectedSettings.showFrame, selectedSettings.scale, selectedSettings.heightScale, selectedSettings.topScale, selectedSettings.offsetX, selectedSettings.offsetY, selectedSettings.layer]);

  const persistSettings = useCallback(async (tier: EloTier, settings: CardOrnamentSettings) => {
    const requestId = ++saveRequestId.current;
    setSaveError(null);
    try {
      await onSave(tier, settings);
    } catch (error) {
      if (saveRequestId.current === requestId) {
        setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar o padrão compartilhado.');
      }
    }
  }, [onSave]);

  useEffect(() => {
    if (!hasPendingChanges) return;

    const tier = previewTier;
    const normalized = normalizeCardOrnamentSettings(draft);
    const timeoutId = window.setTimeout(() => {
      setHasPendingChanges(false);
      void persistSettings(tier, normalized);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [hasPendingChanges, draft, previewTier, persistSettings]);

  useEffect(() => {
    if (!previewCardsByTier.some((card) => card.tier === previewTier)) setPreviewTier(previewCardsByTier[0]?.tier || 'challenger');
  }, [previewCardsByTier, previewTier]);

  const updateDraft = (partial: Partial<CardOrnamentSettings>) => {
    setSaveError(null);
    setHasPendingChanges(true);
    setDraft((current) => normalizeCardOrnamentSettings({ ...current, ...partial }));
  };

  const saveSettings = (next = draft) => {
    const normalized = normalizeCardOrnamentSettings(next);
    setDraft(normalized);
    setHasPendingChanges(false);
    void persistSettings(previewTier, normalized);
  };

  const handleSelectTier = (tier: EloTier) => {
    if (hasPendingChanges) {
      void persistSettings(previewTier, normalizeCardOrnamentSettings(draft));
    }
    setPreviewTier(tier);
    setDraft(normalizeCardOrnamentSettings(ornamentSettingsByTier[tier] ?? defaultSettings));
    setHasPendingChanges(false);
    setSaveError(null);
  };

  return (
    <section className="mt-6 space-y-5">
      <header className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 p-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-2 text-amber-300"><Scaling className="h-5 w-5" /></span>
          <div>
            <h3 className="font-display text-lg font-black text-white">Editor do ornamento das cartas</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
              Ajuste o padrão de cada elo. Cada mudança é compartilhada e aplicada às cartas atuais e futuras desse elo.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <label className="block text-xs font-semibold text-slate-300">
          Elo para editar
          <select
            value={previewTier}
            onChange={(event) => handleSelectTier(event.target.value as EloTier)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
          >
            {ORNAMENT_TIER_ORDER.map((tier) => (
              <option key={tier} value={tier}>{TIER_LABELS[tier] || tier.replace('_', ' ')}</option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-slate-500">
            O padrão escolhido alcança todas as cartas desse elo, mesmo quando ainda não existe uma carta publicada.
          </span>
        </label>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <span className="text-xs font-semibold text-slate-200">Versão para conferir na prévia</span>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {([
              { id: 'card', label: 'Da carta' },
              { id: 'without', label: 'Sem MVP' },
              { id: 'mvp', label: 'Com MVP' },
            ] as const).map((variant) => (
              <button
                key={variant.id}
                type="button"
                aria-pressed={previewMvpMode === variant.id}
                onClick={() => setPreviewMvpMode(variant.id)}
                className={`rounded-lg border px-2 py-2 text-[11px] font-bold transition-colors ${previewMvpMode === variant.id ? 'border-amber-400 bg-amber-500/15 text-amber-200' : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'}`}
              >
                {variant.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Na galeria, a versão é escolhida automaticamente pelo destaque MVP da carta.</p>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(320px,1fr)_minmax(340px,1.15fr)]">
        <div className="flex min-h-[540px] flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-amber-400/20 bg-[radial-gradient(ellipse_at_center,_rgba(30,41,59,0.8),_rgba(2,6,23,0.98)_72%)] px-5 py-8 shadow-xl shadow-black/20 sm:px-12 sm:py-10 xl:sticky xl:top-20 xl:z-10 xl:self-start">
          <span className="rounded-full border border-amber-400/30 bg-slate-950/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200">Prévia · {TIER_LABELS[previewTier] || previewTier}</span>
          {previewCard ? (
            <RankedCard card={previewCardVariant!} size="md" ornamentSettings={draft} />
          ) : (
            <p className="text-center text-sm text-slate-400">A prévia deste elo estará disponível em instantes.</p>
          )}
          <p className="max-w-sm text-center text-[11px] leading-relaxed text-slate-400">
            {draft.showFrame
              ? `Este padrão é aplicado a todas as cartas de ${TIER_LABELS[previewTier] || previewTier}, atuais e futuras.`
              : `A moldura foi removida de todas as cartas de ${TIER_LABELS[previewTier] || previewTier}.`}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-white"><Move className="h-4 w-4 text-amber-300" /> Ajuste fino</h4>
            <RangeControl
              label="Tamanho"
              value={draft.scale}
              min={0.8}
              max={1.8}
              step={0.01}
              displayValue={`${Math.round(draft.scale * 100)}%`}
              percentageInput
              onChange={(scale) => updateDraft({ scale })}
            />
            <RangeControl
              label="Altura vertical"
              value={draft.heightScale}
              min={0.8}
              max={1.8}
              step={0.01}
              displayValue={`${Math.round(draft.heightScale * 100)}%`}
              onChange={(heightScale) => updateDraft({ heightScale })}
            />
            <RangeControl
              label="Altura somente da parte superior"
              value={draft.topScale}
              min={0.7}
              max={3}
              step={0.01}
              displayValue={`${Math.round(draft.topScale * 100)}%`}
              description="100% é a altura original; ajuste para reduzir ou ampliar só o topo."
              onChange={(topScale) => updateDraft({ topScale })}
            />
            <RangeControl
              label="Mover para os lados"
              value={draft.offsetX}
              min={-15}
              max={15}
              step={0.5}
              displayValue={`${draft.offsetX > 0 ? '+' : ''}${draft.offsetX}%`}
              onChange={(offsetX) => updateDraft({ offsetX })}
            />
            <RangeControl
              label="Mover para cima ou para baixo"
              value={draft.offsetY}
              min={-15}
              max={15}
              step={0.5}
              displayValue={`${draft.offsetY > 0 ? '+' : ''}${draft.offsetY}%`}
              onChange={(offsetY) => updateDraft({ offsetY })}
            />
          </div>

          <fieldset className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <legend className="px-1 text-sm font-bold text-white">Profundidade da moldura</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={draft.layer === 'front'}
                onClick={() => updateDraft({ layer: 'front' })}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${draft.layer === 'front' ? 'border-amber-400 bg-amber-500/15 text-amber-200' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}
              >
                <ArrowUpToLine className="h-4 w-4" /> Na frente
              </button>
              <button
                type="button"
                aria-pressed={draft.layer === 'back'}
                onClick={() => updateDraft({ layer: 'back' })}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${draft.layer === 'back' ? 'border-amber-400 bg-amber-500/15 text-amber-200' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}
              >
                <ArrowDownToLine className="h-4 w-4" /> Atrás da carta
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Na frente, o bordado passa por cima do contorno e pode cobrir parte das informações.</p>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-950/15 p-3">
            <div>
              <p className="text-xs font-bold text-white">Moldura deste elo</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {draft.showFrame ? 'A moldura aparece nas cartas atuais e futuras.' : 'As cartas deste elo aparecem sem moldura.'}
              </p>
            </div>
            <button
              type="button"
              aria-pressed={!draft.showFrame}
              onClick={() => updateDraft({ showFrame: !draft.showFrame })}
              className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${draft.showFrame ? 'border-rose-500/40 bg-rose-950/40 text-rose-200 hover:bg-rose-900/50' : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/50'}`}
            >
              {draft.showFrame ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {draft.showFrame ? 'Remover moldura' : 'Restaurar moldura'}
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {saveError && <p className="flex-1 text-xs text-rose-300" aria-live="polite">{saveError}</p>}
            <button
              type="button"
              onClick={() => saveSettings({ ...DEFAULT_CARD_ORNAMENT_SETTINGS, showFrame: previewTier !== 'lenda' })}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs font-bold text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" /> Restaurar este elo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
