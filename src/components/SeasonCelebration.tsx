import React from 'react';
import { Sparkles, Trophy } from 'lucide-react';

interface SeasonCelebrationProps {
  kind: 'start' | 'finish';
  season: number;
  automatic?: boolean;
}

const confettiColors = ['#fbbf24', '#34d399', '#fb7185', '#38bdf8', '#c084fc', '#f8fafc'];

export const SeasonCelebration: React.FC<SeasonCelebrationProps> = ({ kind, season, automatic }) => {
  const started = kind === 'start';
  return (
    <div className="season-celebration" aria-live="assertive" role="status">
      <div className="season-celebration__confetti" aria-hidden="true">
        {Array.from({ length: 48 }, (_, index) => (
          <span
            key={index}
            style={{
              left: `${(index * 43 + 7) % 100}%`,
              backgroundColor: confettiColors[index % confettiColors.length],
              animationDelay: `${(index % 16) * 55}ms`,
              animationDuration: `${2600 + (index % 7) * 160}ms`,
              transform: `rotate(${index * 29}deg)`,
            }}
          />
        ))}
      </div>
      <div className={`season-celebration__panel ${started ? 'season-celebration__panel--start' : 'season-celebration__panel--finish'}`}>
        <span className="season-celebration__icon">{started ? <Sparkles className="h-8 w-8" /> : <Trophy className="h-8 w-8" />}</span>
        <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-amber-200">Personas · Temporada {season}</p>
        <h2 className="mt-2 font-display text-3xl font-black text-white sm:text-5xl">{started ? 'Começou!' : 'Temporada encerrada!'}</h2>
        <p className="mt-2 text-base text-slate-200">{started ? 'Que venham as partidas.' : automatic ? 'As estatísticas foram salvas automaticamente.' : 'Resultados e cartas foram salvos no histórico.'}</p>
      </div>
    </div>
  );
};
