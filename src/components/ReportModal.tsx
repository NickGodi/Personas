import React, { useState } from 'react';
import { User, ReportItem } from '../types';
import { sound } from '../utils/audio';
import { AlertOctagon, X, Send, ShieldAlert } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  users: User[];
  preselectedUser?: User | null;
  onSubmitReport: (report: { targetUserId: string; reason: string; details: string }) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users,
  preselectedUser,
  onSubmitReport,
}) => {
  const [targetId, setTargetId] = useState<string>(
    preselectedUser?.id || users[0]?.id || ''
  );
  const [reason, setReason] = useState<string>('Conduta Tóxica / Rage');
  const [details, setDetails] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !targetId || !details.trim()) return;

    onSubmitReport({
      targetUserId: targetId,
      reason,
      details: details.trim(),
    });

    sound.playVictory();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 rounded-2xl border border-red-700/60 max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-red-900/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-950 border border-red-700/60 text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="font-display font-extrabold text-base text-white">
              Sistema de Denúncias Personas
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-2">
          Sua denúncia será enviada com prioridade máxima diretamente para o Painel do Criador (@nicolaslike).
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Jogador a ser Denunciado:
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-red-500"
            >
              {users
                .filter((u) => u.id !== currentUser?.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.handle}) - Rota {u.primaryLane}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Motivo da Infração:
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-red-500"
            >
              <option value="Conduta Tóxica / Rage">Conduta Tóxica / Rage</option>
              <option value="Abandono de Partida (AFK)">Abandono de Partida (AFK)</option>
              <option value="Manipulação de Votos / Média Falsa">Manipulação de Votos / Média Falsa</option>
              <option value="Descumprimento da Regra da Carta Sorteada">Descumprimento da Regra da Carta Sorteada</option>
              <option value="Desrespeito às Decisões dos Capitães">Desrespeito às Decisões dos Capitães</option>
              <option value="Outro Motivo Grave">Outro Motivo Grave</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Detalhes e Evidências do Ocorrido:
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Descreva o que aconteceu durante o torneio ou votação..."
              rows={3}
              required
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!details.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold shadow-md shadow-red-950 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar Denúncia
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
