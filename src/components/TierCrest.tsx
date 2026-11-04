import React, { useId } from 'react';
import { EloTier } from '../types';

const crestColors: Record<EloTier, { light: string; mid: string; dark: string; glow: string }> = {
  lenda: { light: '#fff2b5', mid: '#d5a62e', dark: '#6d4215', glow: '#ffce55' },
  challenger: { light: '#fff1a8', mid: '#58dcff', dark: '#14608c', glow: '#51dfff' },
  grao_mestre: { light: '#ffd0b5', mid: '#f25a57', dark: '#7b162a', glow: '#f04f56' },
  mestre: { light: '#f5c8ff', mid: '#bd78f1', dark: '#532993', glow: '#ca7dff' },
  diamante: { light: '#d1f7ff', mid: '#59c8f3', dark: '#175d9d', glow: '#51cfff' },
  esmeralda: { light: '#c8ffdc', mid: '#49d29a', dark: '#11654d', glow: '#48e2a3' },
  platina: { light: '#e0ffff', mid: '#71d7df', dark: '#2d728b', glow: '#6ae5ed' },
  ouro: { light: '#fff2a3', mid: '#e9aa2d', dark: '#8a4b15', glow: '#ffd04e' },
  prata: { light: '#ffffff', mid: '#b8c9d9', dark: '#56697d', glow: '#d2e5f5' },
  bronze: { light: '#ffc996', mid: '#c47a42', dark: '#66351f', glow: '#d18a4c' },
  ferro: { light: '#e2e8f0', mid: '#78889a', dark: '#313c4d', glow: '#8496aa' },
  madeira: { light: '#e8b77e', mid: '#986039', dark: '#45251a', glow: '#a56e40' },
  criminoso: { light: '#ff9696', mid: '#dc3948', dark: '#591421', glow: '#ff3d4d' },
  mencao_honrosa: { light: '#d6fff9', mid: '#55d7bd', dark: '#166e6d', glow: '#53dfc6' },
};

const tierNames: Record<EloTier, string> = {
  lenda: 'Lenda', challenger: 'Challenger', grao_mestre: 'Grão-Mestre', mestre: 'Mestre',
  diamante: 'Diamante', esmeralda: 'Esmeralda', platina: 'Platina', ouro: 'Ouro',
  prata: 'Prata', bronze: 'Bronze', ferro: 'Ferro', madeira: 'Madeira',
  criminoso: 'Criminoso', mencao_honrosa: 'Menção honrosa',
};

export const TierCrest: React.FC<{ tier: EloTier; size?: 'sm' | 'md'; scale?: number }> = ({ tier, size = 'md', scale = 1 }) => {
  const color = crestColors[tier];
  const id = useId().replace(/:/g, '');
  const large = size === 'md';
  const width = large ? 94 : 72;
  const height = large ? 62 : 48;

  return (
    <svg
      width={Math.round(width * scale)}
      height={Math.round(height * scale)}
      viewBox="0 0 120 78"
      role="img"
      aria-label={`Brasão ${tierNames[tier]}`}
      className="overflow-visible drop-shadow-[0_4px_8px_rgba(0,0,0,.65)]"
    >
      <defs>
        <linearGradient id={`crest-metal-${id}`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor={color.light} />
          <stop offset="0.48" stopColor={color.mid} />
          <stop offset="1" stopColor={color.dark} />
        </linearGradient>
        <linearGradient id={`crest-core-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color.light} />
          <stop offset="0.52" stopColor={color.mid} />
          <stop offset="1" stopColor={color.dark} />
        </linearGradient>
        <radialGradient id={`crest-glow-${id}`}>
          <stop offset="0" stopColor={color.glow} stopOpacity=".68" />
          <stop offset="1" stopColor={color.glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="60" cy="38" rx="48" ry="31" fill={`url(#crest-glow-${id})`} opacity=".65" />

      {tier === 'challenger' && <>
        <path d="M49 39 10 25l16 17L8 44l32 10 13-8M71 39l39-14-16 17 18 2-32 10-13-8" fill={`url(#crest-metal-${id})`} stroke="#d9f8ff" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m13 29 19 11-11-2m86-9L88 40l11-2" fill="none" stroke="#ecfbff" strokeOpacity=".8" strokeWidth="2" />
        <path d="m60 7 8 14 15 4-11 11 2 16-14-7-14 7 2-16-11-11 15-4z" fill={`url(#crest-core-${id})`} stroke="#fff4bd" strokeWidth="2" strokeLinejoin="round" />
        <path d="m60 15 4 10 9 2-7 7 1 9-7-5-7 5 1-9-7-7 9-2z" fill="#f9e38b" stroke="#fff6c7" strokeWidth="1.3" />
        <path d="M60 5v-3m-6 16 6-8 6 8" fill="none" stroke="#fff2a8" strokeWidth="2" strokeLinecap="round" />
      </>}

      {tier === 'grao_mestre' && <>
        <path d="m47 37-29-9 13 18-18 2 31 9 12-9m24-11 29-9-13 18 18 2-31 9-12-9" fill={`url(#crest-metal-${id})`} stroke="#ffd2c5" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M60 6c12 12 17 21 13 32-2 7-7 11-13 15-6-4-11-8-13-15-4-11 1-20 13-32Z" fill={`url(#crest-core-${id})`} stroke="#ffe0c5" strokeWidth="2" />
        <path d="M60 20c5 8 7 13 0 22-7-9-5-14 0-22Z" fill="#fff0cc" opacity=".9" />
      </>}

      {tier === 'mestre' && <>
        <path d="m49 38-28-8 12 17-15 3 30 9 11-9m22-12 28-8-12 17 15 3-30 9-11-9" fill={`url(#crest-metal-${id})`} stroke="#f4d9ff" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m60 7 8 15 15 3-11 11 2 16-14-7-14 7 2-16-11-11 15-3z" fill={`url(#crest-core-${id})`} stroke="#f8e4ff" strokeWidth="2" />
        <circle cx="60" cy="34" r="7" fill="#f5d8ff" stroke="#fff" strokeWidth="1.5" />
      </>}

      {tier === 'diamante' && <>
        <path d="m49 41-25-9 12 14-10 5 24 6 10-8m22-8 25-9-12 14 10 5-24 6-10-8" fill={`url(#crest-metal-${id})`} stroke="#d8f9ff" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m60 6 17 19-17 29-17-29z" fill={`url(#crest-core-${id})`} stroke="#e2fbff" strokeWidth="2" />
        <path d="m60 12 8 14-8 19-8-19z" fill="#e5fbff" fillOpacity=".9" />
      </>}

      {tier === 'esmeralda' && <>
        <path d="m49 41-25-9 12 14-10 5 24 6 10-8m22-8 25-9-12 14 10 5-24 6-10-8" fill={`url(#crest-metal-${id})`} stroke="#d8ffec" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M60 8c13 8 19 17 16 29-2 9-8 15-16 19-8-4-14-10-16-19C41 25 47 16 60 8Z" fill={`url(#crest-core-${id})`} stroke="#d9ffea" strokeWidth="2" />
        <path d="M60 17v31m0-17-9-8m9 15 9-9" fill="none" stroke="#dbffec" strokeWidth="2" strokeLinecap="round" />
      </>}

      {tier === 'platina' && <>
        <path d="m49 41-25-9 12 14-10 5 24 6 10-8m22-8 25-9-12 14 10 5-24 6-10-8" fill={`url(#crest-metal-${id})`} stroke="#e2ffff" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m60 8 17 12-5 27-12 9-12-9-5-27z" fill={`url(#crest-core-${id})`} stroke="#e6ffff" strokeWidth="2" />
        <path d="m60 17 8 10-8 18-8-18z" fill="#ddffff" opacity=".9" />
      </>}

      {tier === 'lenda' && <>
        <path d="m49 42-31-14 13 19-15 4 32 8 12-9m22-8 31-14-13 19 15 4-32 8-12-9" fill={`url(#crest-metal-${id})`} stroke="#fff3c7" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m60 6 8 15 16 3-12 12 3 17-15-8-15 8 3-17-12-12 16-3z" fill={`url(#crest-core-${id})`} stroke="#fff3c7" strokeWidth="2" />
        <path d="m60 15 3 9 9 1-7 6 2 9-7-5-7 5 2-9-7-6 9-1z" fill="#fff5d1" />
        <circle cx="60" cy="3" r="3" fill="#fff0a8" /><circle cx="43" cy="18" r="2" fill="#fff0a8" /><circle cx="77" cy="18" r="2" fill="#fff0a8" />
      </>}

      {tier === 'ouro' && <>
        <path d="m60 10 8 13 15-3-5 17H42l-5-17 15 3z" fill={`url(#crest-core-${id})`} stroke="#fff1ad" strokeWidth="2" strokeLinejoin="round" />
        <path d="M44 43h32l-4 9H48z" fill={`url(#crest-metal-${id})`} stroke="#fff1ad" strokeWidth="1.5" />
        <circle cx="60" cy="27" r="5" fill="#fff1ad" />
      </>}

      {tier === 'prata' && <>
        <path d="m60 8 22 10-4 28-18 14-18-14-4-28z" fill={`url(#crest-core-${id})`} stroke="#eef7ff" strokeWidth="2" />
        <path d="m60 17 11 8-11 20-11-20z" fill="#f4f9ff" opacity=".85" />
        <path d="M34 26h9m34 0h9" stroke="#dce8f4" strokeWidth="3" strokeLinecap="round" />
      </>}

      {tier === 'bronze' && <>
        <path d="m43 15 12 5 5-8 5 8 12-5-3 30-14 15-14-15z" fill={`url(#crest-core-${id})`} stroke="#ffdfbd" strokeWidth="2" />
        <path d="m49 27 11 7 11-7-4 17-7 7-7-7z" fill="#ffd2a7" opacity=".78" />
      </>}

      {tier === 'ferro' && <>
        <path d="m60 7 24 15-5 29-19 12-19-12-5-29z" fill={`url(#crest-core-${id})`} stroke="#e5edf5" strokeWidth="2" />
        <path d="M60 16v37M44 26l32 18M76 26 44 44" stroke="#e3e9f1" strokeOpacity=".75" strokeWidth="2" />
        <circle cx="60" cy="34" r="7" fill="#f4f6f9" />
      </>}

      {tier === 'madeira' && <>
        <path d="m60 9 21 12-4 26-17 15-17-15-4-26z" fill={`url(#crest-core-${id})`} stroke="#e9c195" strokeWidth="2" />
        <path d="M48 24v26m8-30v34m8-34v34m8-30v26" stroke="#edc796" strokeOpacity=".8" strokeWidth="2" />
        <path d="m43 21 34 29m0-29L43 50" stroke="#4b2617" strokeOpacity=".65" strokeWidth="2" />
      </>}

      {tier === 'criminoso' && <>
        <path d="m60 7 22 14-4 31-18 12-18-12-4-31z" fill={`url(#crest-core-${id})`} stroke="#ffc0c0" strokeWidth="2" />
        <path d="M48 24v27m8-32v37m8-37v37m8-32v27M42 35h36M43 46h34" stroke="#ffe0e0" strokeWidth="2.5" />
        <path d="m50 8 10 10 10-10" fill="none" stroke="#ffaaaa" strokeWidth="3" />
      </>}

      {tier === 'mencao_honrosa' && <>
        <path d="M60 8c17 10 23 22 16 36-4 8-10 13-16 17-6-4-12-9-16-17C37 30 43 18 60 8Z" fill={`url(#crest-core-${id})`} stroke="#dcfff7" strokeWidth="2" />
        <path d="m60 19 3 10 10 1-8 6 3 10-8-6-8 6 3-10-8-6 10-1z" fill="#e0fff9" />
      </>}

      <path d="M24 68h72" stroke={color.mid} strokeOpacity=".7" strokeWidth="1" />
      <circle cx="21" cy="68" r="2" fill={color.light} /><circle cx="99" cy="68" r="2" fill={color.light} />
    </svg>
  );
};
