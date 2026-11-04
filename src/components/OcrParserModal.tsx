import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { sound } from '../utils/audio';
import { 
  Scan, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Users, 
  Calculator, 
  Save, 
  Image as ImageIcon,
  Trophy,
} from 'lucide-react';

interface ExtractedPlayer {
  nick: string;
  score: number;
  role?: string;
  matchedUserId?: string;
}

interface OcrParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onApplyScores: (results: {
    players: { userId: string; score: number; nick: string }[];
    seasonAverage: number;
    mvpUserId?: string;
    notes?: string;
  }) => void;
}

export const OcrParserModal: React.FC<OcrParserModalProps> = ({
  isOpen,
  onClose,
  users,
  onApplyScores,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [extractedData, setExtractedData] = useState<{
    players: ExtractedPlayer[];
    calculatedAverage: number;
    notes?: string;
    source?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [matchMvpIndex, setMatchMvpIndex] = useState<number | null>(null);

  // Handle Paste event anywhere when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            readAndProcessFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, users]);

  if (!isOpen) return null;

  const readAndProcessFile = (file: File) => {
    setError(null);
    setSuccessMsg(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Use uma imagem PNG, JPEG ou WebP.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('A imagem precisa ter no máximo 15 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setImagePreview(base64);
      runOcrAnalysis(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readAndProcessFile(file);
    }
  };

  // Quick preset loader using the user's uploaded screenshot
  const handleLoadSampleScreenshot = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch('/assets/aistudio/image_866eb88a.png');
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setImagePreview(base64);
        runOcrAnalysis(base64, blob.type || 'image/png');
      };
      reader.readAsDataURL(blob);
    } catch {
      setIsLoading(false);
      setError('Falha ao carregar imagem de exemplo. Selecione uma do seu computador.');
    }
  };

  const runOcrAnalysis = async (base64Image: string, mimeType = 'image/png') => {
    setIsLoading(true);
    setError(null);
    setMatchMvpIndex(null);

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Image, mimeType }),
      });

      if (!res.ok) {
        throw new Error('Falha na resposta do servidor OCR');
      }

      const json = await res.json();
      const rawPlayers: ExtractedPlayer[] = json.data?.players || [];

      // Auto-match nicks with users in our database
      const matchedPlayers = rawPlayers.map((p) => {
        const cleanNick = p.nick.toLowerCase().trim();
        const found = users.find(
          (u) =>
            u.name.toLowerCase().includes(cleanNick) ||
            cleanNick.includes(u.name.toLowerCase()) ||
            u.handle.toLowerCase().includes(cleanNick) ||
            cleanNick.includes(u.handle.toLowerCase().replace('@', '')) ||
            (u.riotId && u.riotId.toLowerCase().includes(cleanNick))
        );
        return {
          ...p,
          matchedUserId: found ? found.id : undefined,
        };
      });

      // Recalculate average
      const sum = matchedPlayers.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
      const avg = matchedPlayers.length > 0 ? Math.round((sum / matchedPlayers.length) * 10) / 10 : 0;

      setExtractedData({
        players: matchedPlayers,
        calculatedAverage: json.data?.calculatedAverage || avg,
        notes: json.data?.notes,
        source: json.source,
      });

      sound.playVictory();
    } catch (err: unknown) {
      console.warn('Fallback to local heuristics parser:', err);
      // Client-side fallback if server fails
      const fallbackPlayers: ExtractedPlayer[] = [
        { nick: 'RAIQ', score: 70, role: 'CABS' },
        { nick: 'Reis', score: 70, role: 'RÚSTICO' },
        { nick: 'Maycão', score: 70, role: 'MID' },
        { nick: 'Nick', score: 64, role: 'AP' },
        { nick: 'Celesta', score: 70, role: 'SUP' },
        { nick: 'Derick', score: 70, role: 'TAV' },
      ].map((p) => {
        const found = users.find((u) => u.name.toLowerCase().includes(p.nick.toLowerCase()));
        return { ...p, matchedUserId: found?.id };
      });

      setExtractedData({
        players: fallbackPlayers,
        calculatedAverage: 69,
        notes: 'Heurística Local Personas (Modo de Contingência)',
        source: 'local_heuristic',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateScore = (index: number, newScore: number) => {
    if (!extractedData) return;
    const updated = [...extractedData.players];
    updated[index].score = newScore;
    const sum = updated.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
    const avg = updated.length > 0 ? Math.round((sum / updated.length) * 10) / 10 : 0;
    setExtractedData({
      ...extractedData,
      players: updated,
      calculatedAverage: avg,
    });
  };

  const handleUpdateMatchedUser = (index: number, userId: string) => {
    if (!extractedData) return;
    if (!userId && matchMvpIndex === index) setMatchMvpIndex(null);
    const updated = [...extractedData.players];
    updated[index].matchedUserId = userId;
    setExtractedData({
      ...extractedData,
      players: updated,
    });
  };

  const handleSaveAndDistribute = () => {
    if (!extractedData || extractedData.players.length === 0) return;

    const validPayload = extractedData.players
      .filter((p) => p.matchedUserId)
      .map((p) => ({
        userId: p.matchedUserId!,
        score: p.score,
        nick: p.nick,
      }));

    if (validPayload.length === 0) {
      setError('Por favor, vincule ao menos 1 jogador a um usuário cadastrado.');
      return;
    }

    onApplyScores({
      players: validPayload,
      seasonAverage: extractedData.calculatedAverage,
      mvpUserId: matchMvpIndex === null ? undefined : extractedData.players[matchMvpIndex]?.matchedUserId,
      notes: extractedData.notes,
    });

    setSuccessMsg('Estatísticas distribuídas com sucesso para as cartas e perfis!');
    sound.playVictory();
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-950 rounded-2xl border border-red-700/60 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-red-950/80 via-slate-900 to-slate-950 border-b border-red-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-white">
                Distribuidor de Estatísticas via OCR
              </h3>
              <p className="text-xs text-slate-400">
                Cole (Ctrl+V) ou envie o print do chat de votação ou pós-jogo para preencher automaticamente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Drop / Paste Zone */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Input card */}
            <div className="flex-1 border-2 border-dashed border-red-900/60 hover:border-red-500 rounded-2xl p-6 bg-slate-900/50 flex flex-col items-center justify-center text-center transition-colors relative">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileInput}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="w-10 h-10 text-red-400 mb-2" />
              <h4 className="text-sm font-bold text-white">Arraste, selecione ou cole seu Print</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Pressione <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-amber-300 font-mono">Ctrl + V</kbd> para colar a captura de tela da área de transferência
              </p>

              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  onClick={handleLoadSampleScreenshot}
                  className="px-3 py-1.5 rounded-lg bg-red-950/80 border border-red-700/60 text-xs font-semibold text-red-300 hover:bg-red-900 transition-colors flex items-center gap-1.5 z-10"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Carregar Print Exemplo (Discord)
                </button>
              </div>
            </div>

            {/* Preview of Image */}
            {imagePreview && (
              <div className="w-full md:w-56 h-48 md:h-auto rounded-xl border border-slate-800 overflow-hidden relative bg-black flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Screenshot do Jogo"
                  className="w-full h-full object-contain"
                />
                <div className="absolute bottom-1 right-1 bg-black/80 px-2 py-0.5 rounded text-[10px] text-slate-300 font-mono">
                  Captura Ativa
                </div>
              </div>
            )}
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="p-8 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-2" />
              <p className="text-sm font-bold text-white">Processando imagem com OCR Inteligente...</p>
              <p className="text-xs text-slate-400 mt-1">Identificando nicks, notas, cargos e calculando médias</p>
            </div>
          )}

          {/* Error / Success message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-600/60 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-600/60 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Extracted Results Table */}
          {extractedData && !isLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-white">
                    Jogadores e Notas Detectados ({extractedData.players.length})
                  </span>
                </div>

                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-red-950/80 border border-red-700/60">
                  <Calculator className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-slate-300">Média Calculada:</span>
                  <span className="text-sm font-black font-mono text-amber-400">
                    {extractedData.calculatedAverage}
                  </span>
                </div>
              </div>

              {extractedData.source !== 'gemini_vision' && (
                <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>Modo de demonstração: estes valores são simulados e não foram extraídos da imagem. Confira tudo antes de salvar.</span>
                </p>
              )}

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Nick na Imagem</th>
                      <th className="py-2.5 px-3">Cargo / Tag</th>
                      <th className="py-2.5 px-3">Nota (0-100)</th>
                      <th className="py-2.5 px-3">MVP da partida</th>
                      <th className="py-2.5 px-3">Vincular a Usuário Personas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {extractedData.players.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-white">{item.nick}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{item.role || '—'}</td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.score}
                            onChange={(e) => handleUpdateScore(idx, Number(e.target.value))}
                            className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono font-bold text-amber-300 focus:outline-none focus:border-red-500"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            disabled={!item.matchedUserId}
                            aria-pressed={matchMvpIndex === idx}
                            onClick={() => setMatchMvpIndex((current) => current === idx ? null : idx)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${matchMvpIndex === idx ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-slate-700 text-slate-400 hover:border-amber-500/50 hover:text-amber-200'}`}
                          >
                            <Trophy className="h-3.5 w-3.5" />
                            {matchMvpIndex === idx ? 'MVP' : 'Marcar'}
                          </button>
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={item.matchedUserId || ''}
                            onChange={(e) => handleUpdateMatchedUser(idx, e.target.value)}
                            className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-red-500 max-w-[200px]"
                          >
                            <option value="">-- Não vinculado --</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.handle})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-slate-500">Marque o jogador que foi MVP desta partida. Sem seleção, as cartas ficam sem o selo MVP.</p>

              {extractedData.notes && (
                <p className="text-[11px] text-slate-400 italic">
                  * {extractedData.notes}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>

          <button
            onClick={handleSaveAndDistribute}
            disabled={!extractedData || extractedData.players.length === 0}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-red-950 transition-all disabled:opacity-40"
          >
            <Save className="w-4 h-4" />
            Distribuir e Salvar Estatísticas
          </button>
        </div>
      </div>
    </div>
  );
};
