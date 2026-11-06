import React, { useState } from 'react';
import { CardItem, CardOrnamentSettings, EloTier } from '../types';
import { Sparkles, Flame, Star, Trophy, Award } from 'lucide-react';
import { formatDamage } from '../utils/stats';
import { DEFAULT_CARD_ORNAMENT_SETTINGS, normalizeCardOrnamentSettings } from '../utils/cardOrnament';
import rankCardFrameNoMvp from '../assets/images/personas-rank-card-frame-complete.png';
import rankCardFrameMvp from '../assets/images/personas-rank-card-frame-mvp.png';
import rankCardFrameBronze from '../assets/images/personas-rank-card-bronze.png';
import rankCardFramePrata from '../assets/images/personas-rank-card-prata-v2.png';
import rankCardFramePlatina from '../assets/images/personas-rank-card-platina-v2.png';
import rankCardFrameFerro from '../assets/images/personas-rank-card-ferro.png';
import rankCardFrameCriminoso from '../assets/images/personas-rank-card-criminoso.png';
import rankCardFrameMadeira from '../assets/images/personas-rank-card-madeira.png';
import rankCardFrameOuro from '../assets/images/personas-rank-card-ouro-v4.png';
import rankCardFrameEsmeralda from '../assets/images/personas-rank-card-esmeralda-v2.png';
import rankCardFrameDiamante from '../assets/images/personas-rank-card-diamante-v2.png';
import rankCardFrameMestre from '../assets/images/personas-rank-card-mestre-v2.png';
import rankCardFrameGraoMestre from '../assets/images/personas-rank-card-grao-mestre.png';

const CardCombatStats: React.FC<{ card: CardItem; light?: boolean }> = ({ card, light = false }) => {
  const values = [
    ['ABATES', String(card.stats.kills)],
    ['MORTES', String(card.stats.deaths)],
    ['ASSIST.', String(card.stats.assists)],
    ['WARDS', String(card.stats.wards)],
    ['DANO +', formatDamage(card.stats.damageDealt)],
    ['DANO -', formatDamage(card.stats.damageReceived)],
  ];
  return (
    <div className={`mt-1.5 grid grid-cols-3 gap-y-1 text-center ${light ? 'text-[#4a3b18]' : 'text-slate-100'}`}>
      {values.map(([label, value]) => (
        <div key={label}>
          <div className={`text-[8px] font-bold ${light ? 'text-slate-400' : 'text-slate-400'}`}>{label}</div>
          <div className="text-[11px] font-black font-mono leading-tight">{value}</div>
        </div>
      ))}
    </div>
  );
};

const OrnamentFrameSlice: React.FC<{
  src: string;
  sourceStart: number;
  sourceEnd: number;
  destinationStart: number;
  destinationEnd: number;
  filter: string;
}> = ({ src, sourceStart, sourceEnd, destinationStart, destinationEnd, filter }) => {
  const sourceHeight = sourceEnd - sourceStart;
  const destinationHeight = destinationEnd - destinationStart;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 overflow-hidden"
      style={{ top: `${destinationStart * 100}%`, height: `${destinationHeight * 100}%` }}
      aria-hidden="true"
    >
      <img
        src={src}
        alt=""
        className="absolute left-0 w-full object-fill"
        style={{
          top: `${(-sourceStart / sourceHeight) * 100}%`,
          height: `${(1 / sourceHeight) * 100}%`,
          filter,
        }}
      />
    </div>
  );
};

interface RankedCardProps {
  card: CardItem;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  showDetails?: boolean;
  ornamentSettings?: CardOrnamentSettings;
}

export const RankedCard: React.FC<RankedCardProps> = ({
  card,
  size = 'md',
  onClick,
  showDetails = true,
  ornamentSettings,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  // Shared rank settings are the source of truth; embedded per-card values remain as a migration fallback.
  const activeOrnamentSettings = normalizeCardOrnamentSettings(ornamentSettings ?? card.ornamentSettings ?? DEFAULT_CARD_ORNAMENT_SETTINGS);

  // Dimension scaling
  const dimensions = {
    sm: 'w-[195px] h-[305px]',
    md: 'w-[260px] h-[410px]',
    lg: 'w-[310px] h-[485px]',
  }[size];

  // Colors & Themes according to the strict order:
  // Lenda > Challenger > Grão Mestre > Mestre > Diamante > Esmeralda > Platina > Ouro > Prata > Bronze > Ferro > Madeira > Criminoso
  const tierThemes: Record<
    EloTier,
    {
      border: string;
      glow: string;
      bgGradient: string;
      topHelmetColor: string;
      bottomWingsColor: string;
      accentText: string;
      label: string;
    }
  > = {
    lenda: {
      border: 'border-amber-300',
      glow: 'shadow-[0_0_35px_rgba(245,158,11,0.9)]',
      bgGradient: 'from-amber-200/20 via-zinc-900/90 to-black',
      topHelmetColor: '#f59e0b',
      bottomWingsColor: '#f59e0b',
      accentText: 'text-amber-200',
      label: 'LENDA',
    },
    challenger: {
      border: 'border-amber-400',
      glow: 'shadow-[0_0_35px_rgba(245,158,11,0.8)]',
      bgGradient: 'from-blue-900/60 via-amber-950/30 to-black',
      topHelmetColor: '#fbbf24',
      bottomWingsColor: '#38bdf8',
      accentText: 'text-amber-300',
      label: 'CHALLENGER',
    },
    grao_mestre: {
      border: 'border-red-500',
      glow: 'shadow-[0_0_30px_rgba(239,68,68,0.7)]',
      bgGradient: 'from-red-950/60 via-rose-950/40 to-black',
      topHelmetColor: '#f87171',
      bottomWingsColor: '#dc2626',
      accentText: 'text-red-400',
      label: 'GRÃO-MESTRE',
    },
    mestre: {
      border: 'border-purple-500',
      glow: 'shadow-[0_0_30px_rgba(168,85,247,0.6)]',
      bgGradient: 'from-purple-950/60 via-fuchsia-950/40 to-black',
      topHelmetColor: '#c084fc',
      bottomWingsColor: '#9333ea',
      accentText: 'text-purple-300',
      label: 'MESTRE',
    },
    diamante: {
      border: 'border-sky-400',
      glow: 'shadow-[0_0_30px_rgba(56,189,248,0.6)]',
      bgGradient: 'from-sky-900/50 via-indigo-950/50 to-black',
      topHelmetColor: '#38bdf8',
      bottomWingsColor: '#0284c7',
      accentText: 'text-sky-300',
      label: 'DIAMANTE',
    },
    esmeralda: {
      border: 'border-emerald-400',
      glow: 'shadow-[0_0_25px_rgba(52,211,153,0.5)]',
      bgGradient: 'from-emerald-950/60 via-teal-950/40 to-black',
      topHelmetColor: '#10b981',
      bottomWingsColor: '#059669',
      accentText: 'text-emerald-400',
      label: 'ESMERALDA',
    },
    platina: {
      border: 'border-cyan-400',
      glow: 'shadow-[0_0_25px_rgba(34,211,238,0.4)]',
      bgGradient: 'from-cyan-900/40 via-slate-900 to-black',
      topHelmetColor: '#22d3ee',
      bottomWingsColor: '#0891b2',
      accentText: 'text-cyan-300',
      label: 'PLATINA',
    },
    ouro: {
      border: 'border-yellow-500',
      glow: 'shadow-[0_0_25px_rgba(234,179,8,0.5)]',
      bgGradient: 'from-amber-600/40 via-yellow-950/30 to-black',
      topHelmetColor: '#eab308',
      bottomWingsColor: '#ca8a04',
      accentText: 'text-yellow-400',
      label: 'OURO',
    },
    prata: {
      border: 'border-slate-300',
      glow: 'shadow-[0_0_20px_rgba(203,213,225,0.4)]',
      bgGradient: 'from-slate-700/50 via-slate-900 to-slate-950',
      topHelmetColor: '#cbd5e1',
      bottomWingsColor: '#94a3b8',
      accentText: 'text-slate-200',
      label: 'PRATA',
    },
    bronze: {
      border: 'border-amber-700',
      glow: 'shadow-[0_0_20px_rgba(180,83,9,0.4)]',
      bgGradient: 'from-amber-900/40 via-stone-900 to-black',
      topHelmetColor: '#b45309',
      bottomWingsColor: '#92400e',
      accentText: 'text-amber-500',
      label: 'BRONZE',
    },
    ferro: {
      border: 'border-zinc-500',
      glow: 'shadow-[0_0_20px_rgba(113,113,122,0.3)]',
      bgGradient: 'from-zinc-800 via-zinc-900 to-black',
      topHelmetColor: '#71717a',
      bottomWingsColor: '#52525b',
      accentText: 'text-zinc-400',
      label: 'FERRO',
    },
    madeira: {
      border: 'border-amber-800',
      glow: 'shadow-[0_0_20px_rgba(146,64,14,0.4)]',
      bgGradient: 'from-[#451a03]/80 via-[#291004] to-black',
      topHelmetColor: '#78350f',
      bottomWingsColor: '#451a03',
      accentText: 'text-amber-600',
      label: 'MADEIRA',
    },
    criminoso: {
      border: 'border-red-900',
      glow: 'shadow-[0_0_30px_rgba(185,28,28,0.5)]',
      bgGradient: 'from-stone-900 via-red-950/40 to-black',
      topHelmetColor: '#7f1d1d',
      bottomWingsColor: '#450a0a',
      accentText: 'text-red-500',
      label: 'CRIMINOSO',
    },
    mencao_honrosa: {
      border: 'border-teal-400',
      glow: 'shadow-[0_0_25px_rgba(45,212,191,0.5)]',
      bgGradient: 'from-teal-900/50 via-cyan-950/50 to-black',
      topHelmetColor: '#2dd4bf',
      bottomWingsColor: '#0d9488',
      accentText: 'text-teal-300',
      label: 'HONRA',
    },
  };

  const currentTheme = tierThemes[card.tier] || tierThemes.ouro;

  // Each upper rank uses its own artwork; Challenger retains its existing MVP/non-MVP pair.
  const frameFilter: Record<EloTier, string> = {
    lenda: 'grayscale(1) sepia(1) hue-rotate(15deg) saturate(3.2) brightness(1.08)',
    challenger: '',
    grao_mestre: '',
    mestre: '',
    diamante: '',
    esmeralda: '',
    platina: '',
    ouro: '',
    prata: '',
    bronze: '',
    ferro: '',
    madeira: '',
    criminoso: '',
    mencao_honrosa: 'grayscale(1) sepia(1) hue-rotate(145deg) saturate(3.5) brightness(1.08)',
  };
  const customTierFrames: Partial<Record<EloTier, string>> = {
    grao_mestre: rankCardFrameGraoMestre,
    mestre: rankCardFrameMestre,
    diamante: rankCardFrameDiamante,
    esmeralda: rankCardFrameEsmeralda,
    ouro: rankCardFrameOuro,
    prata: rankCardFramePrata,
    platina: rankCardFramePlatina,
    bronze: rankCardFrameBronze,
    ferro: rankCardFrameFerro,
    criminoso: rankCardFrameCriminoso,
    madeira: rankCardFrameMadeira,
  };
  const tierFrame = customTierFrames[card.tier];
  const usesCustomTierFrame = Boolean(tierFrame);
  const rankCardFrameSource = tierFrame ?? (card.isMvp ? rankCardFrameMvp : rankCardFrameNoMvp);
  const frameRanks: EloTier[] = [
    'challenger', 'grao_mestre', 'mestre', 'diamante', 'esmeralda', 'platina', 'ouro',
    'prata', 'bronze', 'ferro', 'madeira', 'criminoso', 'mencao_honrosa',
  ];
  const frameRankIndex = Math.max(0, frameRanks.indexOf(card.tier));
  const tierOrnamentScale = usesCustomTierFrame ? 1 : Math.max(0.9, 1 - frameRankIndex * 0.008);
  const ornamentScale = tierOrnamentScale * activeOrnamentSettings.scale;
  const cardBaseWidth = size === 'sm' ? 195 : size === 'md' ? 260 : 310;
  const cardBaseHeight = size === 'sm' ? 305 : size === 'md' ? 410 : 485;
  const ornamentBleed = cardBaseWidth * 0.02;
  const ornamentScaleY = ornamentScale * activeOrnamentSettings.heightScale;
  const ornamentHeight = cardBaseHeight + ornamentBleed * 2;
  const ornamentOffsetY = (activeOrnamentSettings.offsetY / 100) * ornamentHeight;
  const ornamentOriginY = 0.5;
  const ornamentScaleDelta = ornamentHeight * (ornamentScaleY - 1);
  const ornamentTopOverhang = Math.max(0, ornamentBleed + ornamentScaleDelta * ornamentOriginY - ornamentOffsetY);
  const ornamentBottomOverhang = Math.max(0, -ornamentBleed + ornamentHeight + ornamentScaleDelta * (1 - ornamentOriginY) + ornamentOffsetY - cardBaseHeight);
  const ornamentStyle: React.CSSProperties = {
    inset: `${-ornamentBleed}px`,
    transform: `translate(${activeOrnamentSettings.offsetX}%, ${activeOrnamentSettings.offsetY}%) scale(${ornamentScale}, ${ornamentScaleY})`,
    transformOrigin: 'center',
  };
  const ornamentFilter = `${frameFilter[card.tier]} drop-shadow(0 0 10px ${currentTheme.topHelmetColor}88)`;
  const ornamentLayer = activeOrnamentSettings.layer === 'front' ? 'z-[60]' : 'z-10';
  const removeSideRails = frameRankIndex >= 4;
  const cardBorderStyle: React.CSSProperties = {
    borderColor: currentTheme.topHelmetColor,
    borderTopWidth: frameRankIndex <= 1 ? 2 : 1,
    borderBottomWidth: frameRankIndex <= 1 ? 2 : 1,
    borderLeftWidth: removeSideRails ? 0 : frameRankIndex === 2 ? 1 : frameRankIndex === 3 ? 0.75 : 2,
    borderRightWidth: removeSideRails ? 0 : frameRankIndex === 2 ? 1 : frameRankIndex === 3 ? 0.75 : 2,
  };

  // If this is a Lenda (Legend) card: White marble & gold format with neon
  if (card.isLegend) {
    const legendCardWidth = size === 'sm' ? 195 : size === 'md' ? 260 : 310;
    const legendCardHeight = size === 'sm' ? 305 : size === 'md' ? 410 : 485;
    const legendBleed = legendCardWidth * 0.02;
    const legendScaleY = activeOrnamentSettings.scale * activeOrnamentSettings.heightScale;
    const legendFrameHeight = legendCardHeight + legendBleed * 2;
    const legendOffsetY = (activeOrnamentSettings.offsetY / 100) * legendFrameHeight;
    const legendScaleDelta = legendFrameHeight * (legendScaleY - 1);
    const legendTopOverhang = Math.max(0, legendBleed + legendScaleDelta * 0.5 - legendOffsetY);
    const legendBottomOverhang = Math.max(0, -legendBleed + legendFrameHeight + legendScaleDelta * 0.5 + legendOffsetY - legendCardHeight);
    const legendOrnamentStyle: React.CSSProperties = {
      inset: `${-legendBleed}px`,
      transform: `translate(${activeOrnamentSettings.offsetX}%, ${activeOrnamentSettings.offsetY}%) scale(${activeOrnamentSettings.scale}, ${legendScaleY})`,
      transformOrigin: 'center',
    };
    const legendOrnamentLayer = activeOrnamentSettings.layer === 'front' ? 'z-[60]' : 'z-10';
    const legendOrnamentFilter = `grayscale(1) sepia(1) hue-rotate(15deg) saturate(3.2) brightness(1.08) drop-shadow(0 0 10px #f59e0b88)`;
    const legendFrameSource = card.isMvp ? rankCardFrameMvp : rankCardFrameNoMvp;

    return (
      <div
        className={`relative ${dimensions} group cursor-pointer transition-all duration-300 transform perspective-1000 ${
          isHovered ? 'scale-105 -translate-y-2' : ''
        }`}
        style={{ marginTop: `${legendTopOverhang + 10}px`, marginBottom: `${legendBottomOverhang}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
      >
        {/* Animated Neon Glow Border */}
        <div className="absolute -inset-1.5 rounded-[28px] bg-gradient-to-r from-red-600 via-amber-400 to-rose-600 opacity-80 blur-md animate-neon-pulse group-hover:opacity-100 transition-opacity" />

        {/* Outer Card Body */}
        <div className="relative w-full h-full rounded-[26px] bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] p-2 border-2 border-[#d4af37] shadow-2xl overflow-hidden flex flex-col justify-between text-slate-800">
          
          {/* Top Marble Arch Accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-gradient-to-b from-[#d4af37] to-transparent opacity-40 rounded-b-full pointer-events-none" />

          {/* Top Header Section */}
          <div className="relative z-10 flex items-start justify-between px-2 pt-2">
            <div>
              <span className="text-2xl font-black font-display tracking-tight text-[#6b5824]">
                {card.lane}
              </span>
              <div className="text-3xl font-extrabold font-mono text-[#4a3b18] leading-none">
                {card.score}
              </div>
            </div>

            {/* Icon Stars Crest */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full border border-[#bfa15f] bg-[#f8f5ea] flex items-center justify-center shadow-inner">
                <Trophy className="w-4 h-4 text-[#997a36]" />
              </div>
              <div className="flex gap-0.5 mt-0.5">
                {[...Array(3)].map((_, i) => (
                  <Star key={i} className="w-2.5 h-2.5 fill-[#d4af37] text-[#d4af37]" />
                ))}
              </div>
            </div>
          </div>

          {/* Center Visual: Favorite Champion Background + Player Photo Foreground */}
          <div className="relative flex-1 my-1 overflow-hidden rounded-xl flex items-center justify-center bg-stone-900">
            <img
              src={card.userAvatar}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 z-0 h-full w-full scale-110 object-cover opacity-55 blur-md"
              referrerPolicy="no-referrer"
            />
            {/* Champion Art Faded in Background */}
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-900/80 via-slate-900/10 to-slate-900/20" />
            
            <div 
              className="absolute inset-0 z-[1] bg-cover bg-center filter grayscale contrast-125 opacity-35"
              style={{
                backgroundImage: 'url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Kayle_0.jpg)'
              }}
            />

            {/* Player Avatar Foreground */}
            <img
              src={card.userAvatar}
              alt={card.userName}
              className="relative z-20 h-full w-full object-contain object-center filter contrast-110 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)]"
              referrerPolicy="no-referrer"
            />

            {/* MVP / ACE Tag if active */}
            {card.isMvp && (
              <div className="absolute top-2 left-2 z-30 px-2 py-0.5 rounded bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-black text-[10px] tracking-wider shadow-lg flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-black" />
                MVP
              </div>
            )}
          </div>

          {/* Card Bottom: player name and combat statistics */}
          <div className="relative z-20 bg-gradient-to-t from-[#ffffff] via-[#f8fafc]/90 to-transparent pt-1 pb-2 px-2 rounded-b-xl border-t border-[#d4af37]/40">
            <div className="text-center">
              <h3 className="font-display font-extrabold text-sm md:text-base tracking-wider text-[#4a3b18] uppercase truncate">
                {card.userName}
              </h3>
              <p className="text-[10px] font-mono text-slate-500">{card.userHandle}</p>
            </div>

            <CardCombatStats card={card} light />

          </div>
        </div>
        <div className={`pointer-events-none absolute ${legendOrnamentLayer}`} style={legendOrnamentStyle}>
          {activeOrnamentSettings.topScale >= 0.999 && activeOrnamentSettings.topScale <= 1.001 ? (
            <img src={legendFrameSource} alt="" aria-hidden="true" className="h-full w-full object-fill" style={{ filter: legendOrnamentFilter }} />
          ) : (
            <>
              <OrnamentFrameSlice src={legendFrameSource} sourceStart={0} sourceEnd={0.24} destinationStart={0} destinationEnd={0.24 * activeOrnamentSettings.topScale} filter={legendOrnamentFilter} />
              <OrnamentFrameSlice src={legendFrameSource} sourceStart={0.24} sourceEnd={0.76} destinationStart={0.24 * activeOrnamentSettings.topScale} destinationEnd={0.76} filter={legendOrnamentFilter} />
              <OrnamentFrameSlice src={legendFrameSource} sourceStart={0.76} sourceEnd={1} destinationStart={0.76} destinationEnd={1} filter={legendOrnamentFilter} />
            </>
          )}
        </div>
      </div>
    );
  }

  // Standard LoL Ranked Cards (Challenger down to Madeira and Criminoso)
  return (
    <div
      className={`relative ${dimensions} group cursor-pointer transition-all duration-300 transform perspective-1000 ${
        isHovered ? 'scale-105 -translate-y-2' : ''
      }`}
      style={{ marginTop: `${ornamentTopOverhang + 10}px`, marginBottom: `${ornamentBottomOverhang}px` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Lower tiers keep light on their top and bottom ornaments, without side glow. */}
      {removeSideRails ? (
        <>
          <div className="pointer-events-none absolute -top-1 left-5 right-5 h-1 rounded-full blur-sm transition-opacity group-hover:opacity-100" style={{ backgroundColor: currentTheme.topHelmetColor, boxShadow: `0 0 18px ${currentTheme.topHelmetColor}` }} />
          <div className="pointer-events-none absolute -bottom-1 left-5 right-5 h-1 rounded-full blur-sm transition-opacity group-hover:opacity-100" style={{ backgroundColor: currentTheme.bottomWingsColor, boxShadow: `0 0 20px ${currentTheme.bottomWingsColor}` }} />
        </>
      ) : (
        <div className={`absolute -inset-1 rounded-[28px] opacity-60 blur-md group-hover:opacity-100 transition-opacity ${currentTheme.glow}`} />
      )}

      {/* Front mode places the full ornament over the card details, as requested. */}
      <div className={`pointer-events-none absolute ${ornamentLayer}`} style={ornamentStyle}>
        {activeOrnamentSettings.topScale >= 0.999 && activeOrnamentSettings.topScale <= 1.001 ? (
          <img
            src={rankCardFrameSource}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-fill"
            style={{ filter: ornamentFilter }}
          />
        ) : (
          <>
            <OrnamentFrameSlice
              src={rankCardFrameSource}
              sourceStart={0}
              sourceEnd={0.24}
              destinationStart={0}
              destinationEnd={0.24 * activeOrnamentSettings.topScale}
              filter={ornamentFilter}
            />
            <OrnamentFrameSlice
              src={rankCardFrameSource}
              sourceStart={0.24}
              sourceEnd={0.76}
              destinationStart={0.24 * activeOrnamentSettings.topScale}
              destinationEnd={0.76}
              filter={ornamentFilter}
            />
            <OrnamentFrameSlice
              src={rankCardFrameSource}
              sourceStart={0.76}
              sourceEnd={1}
              destinationStart={0.76}
              destinationEnd={1}
              filter={ornamentFilter}
            />
          </>
        )}
      </div>

      {usesCustomTierFrame && card.isMvp && (
        <div className="pointer-events-none absolute left-[7%] top-[10%] z-[70] flex h-6 items-center gap-1 rounded-md border border-amber-300 bg-gradient-to-r from-amber-500 to-yellow-300 px-2 text-[9px] font-black tracking-wider text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.65)]">
          <Sparkles className="h-3 w-3 fill-slate-950 text-slate-950" /> MVP
        </div>
      )}

      {/* Main Card Frame */}
      <div
        className={`relative w-full h-full rounded-[26px] bg-gradient-to-b ${currentTheme.bgGradient} p-1.5 border shadow-2xl overflow-hidden flex flex-col justify-between`}
        style={{ ...cardBorderStyle, backgroundColor: '#05070d' }}
      >
        {/* Holographic Sheen Layer */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none opacity-50 group-hover:opacity-90 transition-opacity" />

        {/* Score stays clear in the upper-left glass panel. */}
        <div className="absolute left-[13%] top-[24%] z-40 flex flex-col items-start">
          <div className="text-3xl font-black font-mono leading-none tracking-tighter text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            {card.score}
          </div>
        </div>

        {(card.isAce || card.isMencaoHonrosa) && (
          <div className="absolute right-[5%] top-[11%] z-40 flex flex-col items-end gap-1">
            {card.isAce && (
              <div className="flex items-center gap-1 rounded-md border border-purple-200/80 bg-gradient-to-r from-purple-700 via-fuchsia-500 to-indigo-600 px-2 py-0.5 text-[9px] font-black tracking-wider text-white shadow-[0_0_14px_rgba(168,85,247,0.8)]">
                <Flame className="h-3 w-3 fill-white" /> ACE
              </div>
            )}
            {card.isMencaoHonrosa && (
              <div className="flex items-center gap-1 rounded-md border border-teal-200/80 bg-gradient-to-r from-teal-700 to-emerald-500 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-lg">
                <Award className="h-3 w-3" /> HONRA
              </div>
            )}
          </div>
        )}

        {/* Top frame socket reserves room for the crest and score plate. */}
        <div className="relative z-10 h-[68px] shrink-0" />

        {/* CENTER PLAYER PHOTO & PRISON BARS FOR CRIMINOSO */}
        <div className="relative mx-2 my-1 min-h-[96px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/60 flex items-center justify-center">
          <img
            src={card.userAvatar}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 z-0 h-full w-full scale-110 object-cover opacity-60 blur-md"
            referrerPolicy="no-referrer"
          />
          <img
            src={card.userAvatar}
            alt={card.userName}
            className="relative z-10 h-full w-full object-contain object-center filter contrast-105"
            referrerPolicy="no-referrer"
          />

          {/* PRISON JAIL BARS FOR ELO CRIMINOSO */}
          {card.isCriminoso && (
            <div className="absolute inset-0 z-30 pointer-events-none flex justify-around items-stretch px-2 bg-gradient-to-b from-stone-900/50 via-transparent to-stone-900/70">
              {/* 7 Vertical Steel Prison Bars */}
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className="w-2.5 h-full rounded-sm bg-gradient-to-r from-zinc-800 via-zinc-400 to-zinc-900 shadow-[inset_0_0_3px_#000,0_2px_5px_rgba(0,0,0,0.8)] border-x border-zinc-950/70"
                />
              ))}

              {/* Crossbars */}
              <div className="absolute top-1/4 left-0 right-0 h-2 bg-gradient-to-b from-zinc-700 via-zinc-300 to-zinc-900 opacity-90 border-y border-black" />
              <div className="absolute bottom-1/4 left-0 right-0 h-2 bg-gradient-to-b from-zinc-700 via-zinc-300 to-zinc-900 opacity-90 border-y border-black" />

              {/* Jail Stamp Tag */}
              <div className="absolute top-2 right-2 bg-red-700 text-white font-mono font-black text-[9px] px-1.5 py-0.5 rounded border border-red-400 shadow-md transform rotate-6">
                PRESO
              </div>
            </div>
          )}

          {/* WOOD GRAIN OVERLAY FOR ELO MADEIRA */}
          {card.tier === 'madeira' && (
            <div className="absolute inset-0 z-20 pointer-events-none border-2 border-[#78350f] rounded-xl flex items-end justify-center p-1 bg-amber-950/20">
              <span className="text-[9px] font-mono font-black text-amber-200 bg-[#78350f]/90 px-1.5 py-0.5 rounded shadow">
                TABUAS DE CARVALHO
              </span>
            </div>
          )}

          {/* Vignette overlay */}
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
        </div>

        {/* BOTTOM ORNATE WINGS AND PLAYER FOOTER */}
        <div className="relative z-50 shrink-0 px-2 pb-2">
          <div className="relative z-10 border-t border-white/10 bg-slate-950/95 px-2 pt-2 text-center">
            <h4 className="font-display font-extrabold text-sm md:text-base tracking-wider text-white uppercase truncate drop-shadow-md">
              {card.userName}
            </h4>
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-300">
              <span className="text-slate-200">{card.lane}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-slate-400">S{card.season}</span>
            </div>
            <CardCombatStats card={card} />
          </div>
        </div>

      </div>
    </div>
  );
};
