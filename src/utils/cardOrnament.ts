import { CardItem, CardOrnamentSettings, EloTier } from '../types';
import { readStorage } from './storage';

export const CARD_ORNAMENT_STORAGE_KEY = 'personas_card_ornament_settings_v1';
export const CARD_ORNAMENT_SETTINGS_VERSION_KEY = 'personas_card_ornament_settings_version';
export const CARD_ORNAMENT_SETTINGS_VERSION = 4;
export const TIER_CARD_ORNAMENT_STORAGE_KEY = 'personas_tier_card_ornament_settings_v1';

export const ORNAMENT_TIER_ORDER: EloTier[] = [
  'lenda', 'challenger', 'grao_mestre', 'mestre', 'diamante', 'esmeralda', 'platina', 'ouro',
  'prata', 'bronze', 'ferro', 'madeira', 'criminoso',
];

export type TierCardOrnamentSettings = Partial<Record<EloTier, CardOrnamentSettings>>;

export const DEFAULT_CARD_ORNAMENT_SETTINGS: CardOrnamentSettings = {
  showFrame: true,
  scale: 1,
  heightScale: 1,
  topScale: 0.8,
  offsetX: 0,
  offsetY: 0,
  layer: 'front',
};

export function getTierOrnamentReferenceCard(cards: CardItem[], tier: EloTier): CardItem | undefined {
  const tierCards = cards.filter((card) => card.tier === tier && (tier === 'lenda' || !card.isLegend));
  if (!tierCards.length) return undefined;

  // Kairos is the visual reference the creator selected for the Challenger frame.
  if (tier === 'challenger') {
    const kairosCard = tierCards.find((card) => card.userId === 'user_kairos');
    if (kairosCard) return kairosCard;
  }

  const configuredCards = tierCards.filter((card) => Boolean(card.ornamentSettings));
  const referencePool = configuredCards.length ? configuredCards : tierCards;
  return [...referencePool].sort((left, right) => right.score - left.score)[0];
}

export function createTierCardOrnamentSettings(
  cards: CardItem[],
  fallback: CardOrnamentSettings = DEFAULT_CARD_ORNAMENT_SETTINGS,
): TierCardOrnamentSettings {
  return Object.fromEntries(ORNAMENT_TIER_ORDER.map((tier) => {
    const referenceCard = getTierOrnamentReferenceCard(cards, tier);
    return [tier, normalizeCardOrnamentSettings(referenceCard?.ornamentSettings ?? fallback)];
  })) as TierCardOrnamentSettings;
}

export function normalizeTierCardOrnamentSettings(
  value: Partial<Record<EloTier, Partial<CardOrnamentSettings>>> | null | undefined,
  fallback: TierCardOrnamentSettings = {},
): TierCardOrnamentSettings {
  return Object.fromEntries(ORNAMENT_TIER_ORDER.map((tier) => [
    tier,
    normalizeCardOrnamentSettings({
      ...(fallback[tier] ?? DEFAULT_CARD_ORNAMENT_SETTINGS),
      ...(value?.[tier] ?? {}),
    }),
  ])) as TierCardOrnamentSettings;
}

export function loadTierCardOrnamentSettings(
  cards: CardItem[],
  fallback: CardOrnamentSettings = DEFAULT_CARD_ORNAMENT_SETTINGS,
  portableSettings: Partial<Record<EloTier, Partial<CardOrnamentSettings>>> = {},
): TierCardOrnamentSettings {
  const seeded = normalizeTierCardOrnamentSettings(portableSettings, createTierCardOrnamentSettings(cards, fallback));
  const stored = readStorage<Partial<Record<EloTier, Partial<CardOrnamentSettings>>> | null>(TIER_CARD_ORNAMENT_STORAGE_KEY, null);
  return stored ? normalizeTierCardOrnamentSettings(stored, seeded) : seeded;
}

export function migrateCardOrnamentSettings(value: Partial<CardOrnamentSettings>): CardOrnamentSettings {
  const normalized = normalizeCardOrnamentSettings(value);
  return normalizeCardOrnamentSettings({
    ...normalized,
    scale: DEFAULT_CARD_ORNAMENT_SETTINGS.scale,
    heightScale: DEFAULT_CARD_ORNAMENT_SETTINGS.heightScale,
    layer: 'front',
  });
}

export function loadCardOrnamentSettings(): CardOrnamentSettings {
  const stored = readStorage<Partial<CardOrnamentSettings> | null>(CARD_ORNAMENT_STORAGE_KEY, null);
  if (!stored) return DEFAULT_CARD_ORNAMENT_SETTINGS;

  const normalized = normalizeCardOrnamentSettings(stored);
  const version = readStorage<number>(CARD_ORNAMENT_SETTINGS_VERSION_KEY, 0);
  if (version >= CARD_ORNAMENT_SETTINGS_VERSION) return normalized;
  return migrateCardOrnamentSettings(normalized);
}

export function normalizeCardOrnamentSettings(
  value: Partial<CardOrnamentSettings> | null | undefined,
): CardOrnamentSettings {
  const scale = Number(value?.scale);
  const heightScale = Number(value?.heightScale);
  const topScale = Number(value?.topScale);
  const offsetX = Number(value?.offsetX);
  const offsetY = Number(value?.offsetY);

  return {
    showFrame: value?.showFrame !== false,
    scale: Number.isFinite(scale) ? Math.min(1.8, Math.max(0.8, scale)) : DEFAULT_CARD_ORNAMENT_SETTINGS.scale,
    heightScale: Number.isFinite(heightScale) ? Math.min(1.8, Math.max(0.8, heightScale)) : DEFAULT_CARD_ORNAMENT_SETTINGS.heightScale,
    topScale: Number.isFinite(topScale) ? Math.min(3, Math.max(0.7, topScale)) : DEFAULT_CARD_ORNAMENT_SETTINGS.topScale,
    offsetX: Number.isFinite(offsetX) ? Math.min(15, Math.max(-15, offsetX)) : DEFAULT_CARD_ORNAMENT_SETTINGS.offsetX,
    offsetY: Number.isFinite(offsetY) ? Math.min(15, Math.max(-15, offsetY)) : DEFAULT_CARD_ORNAMENT_SETTINGS.offsetY,
    layer: value?.layer === 'back' ? 'back' : 'front',
  };
}
