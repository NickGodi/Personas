import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpToLine, Check, Move, RotateCcw, Save, Scaling } from 'lucide-react';
import { CardItem, CardOrnamentSettings, EloTier, User } from '../types';
import { DEFAULT_CARD_ORNAMENT_SETTINGS, getTierOrnamentReferenceCard, normalizeCardOrnamentSettings, ORNAMENT_TIER_ORDER, TierCardOrnamentSettings } from '../utils/cardOrnament';
import { RankedCard } from './RankedCard';

interface CardOrnamentEditorProps {
  cards: CardItem[];
  users: User[];
  ornamentSettingsByTier: TierCardOrnamentSettings;
  defaultSettings: CardOrnamentSettings;
  onSave: (tier: EloTier, settings: CardOrnamentSettings) => void;
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
    const previewCards = cards.filter((card) => !card.isLegend);
    const cardsToPreview = previewCards.length > 0 ? previewCards : cards;
    return cardsToPreview.map((card) => {
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
    .map((tier) => getTierOrnamentReferenceCard(cardsWithOrnament, tier))
    .filter((card): card is CardItem => Boolean(card)), [cardsWithOrnament]);
  const [previewTier, setPreviewTier] = useState<EloTier | ''>(previewCardsByTier[0]?.tier || '');
  const [previewMvpMode, setPreviewMvpMode] = useState<'card' | 'without' | 'mvp'>('card');
  const [saved, setSaved] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const previewCard = useMemo(
    () => previewCardsByTier.find((card) => card.tier === previewTier) || previewCardsByTier[0],
    [previewCardsByTier, previewTier],
  );
  const selectedSettings = previewCard
    ? ornamentSettingsByTier[previewCard.tier] ?? previewCard.ornamentSettings ?? defaultSettings
    : defaultSettings;
  const [draft, setDraft] = useState<CardOrnamentSettings>(() => normalizeCardOrnamentSettings(selectedSettings));
  const previewCardVariant = previewCard
    ? {
        ...previewCard,
        isMvp: previewMvpMode === 'mvp' || (previewMvpMode === 'card' && previewCard.isMvp),
        ornamentSettings: draft,
      }
    : undefined;

  useEffect(() => {
    setDraft(normalizeCardOrnamentSettings(selectedSettings));
  }, [previewTier, selectedSettings.scale, selectedSettings.heightScale, selectedSettings.topScale, selectedSettings.sideScale, selectedSettings.offsetX, selectedSettings.offsetY, selectedSettings.layer]);

  useEffect(() => {
    if (!hasPendingChanges || !previewCard) return;

    const tier = previewCard.tier;
    const normalized = normalizeCardOrnamentSettings(draft);
    const timeoutId = window.setTimeout(() => {
      onSave(tier, normalized);
      setHasPendingChanges(false);
      setSaved(true);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [hasPendingChanges, draft, previewCard?.tier, onSave]);

  useEffect(() => {
    if (!previewCardsByTier.some((card) => card.tier === previewTier)) setPreviewTier(previewCardsByTier[0]?.tier || '');
  }, [previewCardsByTier, previewTier]);

  const updateDraft = (partial: Partial<CardOrnamentSettings>) => {
    setSaved(false);
    setHasPendingChanges(true);
    setDraft((current) => normalizeCardOrnamentSettings({ ...current, ...partial }));
  };

  const saveSettings = (next = draft) => {
    const normalized = normalizeCardOrnamentSettings(next);
    setDraft(normalized);
    setHasPendingChanges(false);
    if (previewCard) onSave(previewCard.tier, normalized);
    setSaved(true);
  };

  const handleSelectTier = (tier: EloTier) => {
    if (hasPendingChanges && previewCard) {
      onSave(previewCard.tier, normalizeCardOrnamentSettings(draft));
    }
    setPreviewTier(tier);
    setDraft(normalizeCardOrnamentSettings(ornamentSettingsByTier[tier] ?? defaultSettings));
    setHasPendingChanges(false);
    setSaved(false);
  };

  return (
    <section className="mt-6 space-y-5">
      <header className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 p-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-2 text-amber-300"><Scaling className="h-5 w-5" /></span>
          <div>
            <h3 className="font-display text-lg font-black text-white">Editor do ornamento das cartas</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
              Ajuste o padrão de cada elo. Cada mudança é salva automaticamente e aplicada a todas as cartas daquele elo.
            </p>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(320px,1fr)_minmax(340px,1.15fr)]">
        <div className="flex min-h-[540px] items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-[radial-gradient(ellipse_at_center,_rgba(30,41,59,0.8),_rgba(2,6,23,0.98)_72%)] px-12 py-14">
          {previewCard ? (
            <RankedCard card={previewCardVariant!} size="md" ornamentSettings={draft} />
          ) : (
            <p className="text-center text-sm text-slate-400">Adicione uma carta para visualizar o ornamento.</p>
          )}
        </div>

        <div className="space-y-4">
          {previewCardsByTier.length > 1 && (
            <label className="block text-xs font-semibold text-slate-300">
              Elo da prévia
              <select
                value={previewCard?.tier || ''}
                onChange={(event) => handleSelectTier(event.target.value as EloTier)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
              >
                {previewCardsByTier.map((card) => (
                  <option key={card.tier} value={card.tier}>
                    {card.tier.replace('_', ' ')} · referência: {card.userName}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-slate-500">
                {previewCard ? `O padrão ${previewCard.tier.replace('_', ' ')} é compartilhado por todas as cartas desse elo.` : 'Escolha um elo para editar sua moldura.'}
              </span>
            </label>
          )}

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
              label="Largura das laterais — somente horizontal"
              value={draft.sideScale}
              min={0.25}
              max={1.5}
              step={0.01}
              displayValue={`${Math.round(draft.sideScale * 100)}%`}
              percentageInput
              description="Ajuste de 25% a 150%. Altera só a largura das laterais; altura, topo e base ficam intactos."
              onChange={(sideScale) => updateDraft({ sideScale })}
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

          <div className="flex flex-col gap-2 sm:flex-row">
            <p className="self-center text-xs text-slate-400" aria-live="polite">
              {hasPendingChanges ? 'Salvando automaticamente…' : saved ? 'Alterações salvas automaticamente.' : 'Salvamento automático ativado.'}
            </p>
            <button
              type="button"
              onClick={() => saveSettings()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300"
            >
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saved ? 'Salvo automaticamente' : 'Salvar agora'}
            </button>
            <button
              type="button"
              onClick={() => saveSettings(DEFAULT_CARD_ORNAMENT_SETTINGS)}
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
