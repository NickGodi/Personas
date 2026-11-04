import React from 'react';
import { PERSONAS_RULES } from '../data/initialData';
import { BookOpen, Crown, AlertCircle } from 'lucide-react';

export const RulesSection: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-red-950/80 via-slate-900 to-slate-950 border border-red-900/40 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-red-600/20 border border-red-500/40 text-red-400">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-black text-white tracking-wide">
              Regras
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Regulamento Oficial Personas · Escala dos Elos, Capitães, Cartas & Votação
            </p>
          </div>
        </div>
      </div>

      {/* Rules Breakdown */}
      <div className="space-y-6">
        {PERSONAS_RULES.sections.map((sec, idx) => (
          <div
            key={idx}
            className="p-6 rounded-2xl bg-slate-950/90 border border-slate-800 hover:border-red-900/60 shadow-xl transition-all"
          >
            <h3 className="font-display font-black text-base text-amber-400 mb-3 flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              {sec.title}
            </h3>

            <ul className="space-y-2.5 text-xs text-slate-300">
              {sec.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Note about Criminoso, Madeira and Legends */}
      <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-600/40 text-xs text-amber-200/90 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white block mb-0.5">Hierarquia Oficial dos Elos Personas:</strong>
          A ordem exata do maior para o menor é: <strong>Lenda &gt; Challenger &gt; Grão Mestre &gt; Mestre &gt; Diamante &gt; Esmeralda &gt; Platina &gt; Ouro &gt; Prata &gt; Bronze &gt; Ferro &gt; Madeira &gt; Criminoso</strong>. O jogador com a menor média é sentenciado ao Elo Criminoso com foto atrás das grades de ferro!
        </div>
      </div>
    </div>
  );
};
