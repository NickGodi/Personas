import type { CardOrnamentSettings, EloTier } from '../types';

/** Portable copy of the creator's shared settings, kept with the project for future deployments. */
export const PORTABLE_CARD_ORNAMENT_SETTINGS: Partial<Record<EloTier, CardOrnamentSettings>> = {
  lenda: { showFrame: false, scale: 1.27, heightScale: 1.22, topScale: 0.8, offsetX: 0, offsetY: 8.5, layer: 'front' },
  challenger: { showFrame: true, scale: 1.14, heightScale: 1.23, topScale: 0.8, offsetX: 0, offsetY: 9.5, layer: 'front' },
  grao_mestre: { showFrame: true, scale: 1.1, heightScale: 1.38, topScale: 0.94, offsetX: 0, offsetY: 3, layer: 'front' },
  mestre: { showFrame: true, scale: 1.15, heightScale: 1.25, topScale: 0.94, offsetX: 0, offsetY: 8.5, layer: 'front' },
  diamante: { showFrame: true, scale: 1.12, heightScale: 1.28, topScale: 0.93, offsetX: 0, offsetY: 5.5, layer: 'front' },
  esmeralda: { showFrame: true, scale: 1.16, heightScale: 1.31, topScale: 0.98, offsetX: 0, offsetY: 9, layer: 'front' },
  platina: { showFrame: true, scale: 1.16, heightScale: 1.34, topScale: 0.94, offsetX: 0, offsetY: 7, layer: 'front' },
  ouro: { showFrame: true, scale: 1.09, heightScale: 1.31, topScale: 0.94, offsetX: 0, offsetY: 7, layer: 'front' },
  prata: { showFrame: true, scale: 1.3, heightScale: 1.14, topScale: 1.1, offsetX: 0, offsetY: 3, layer: 'front' },
  bronze: { showFrame: true, scale: 1.34, heightScale: 1.06, topScale: 1.07, offsetX: 0, offsetY: 0, layer: 'front' },
  ferro: { showFrame: true, scale: 1.32, heightScale: 1.03, topScale: 1.01, offsetX: 0, offsetY: 2, layer: 'front' },
  madeira: { showFrame: true, scale: 1.35, heightScale: 1, topScale: 0.8, offsetX: 0, offsetY: 5.5, layer: 'front' },
  criminoso: { showFrame: true, scale: 1.52, heightScale: 1, topScale: 0.8, offsetX: 0, offsetY: 5.5, layer: 'front' },
};
