import React, { useEffect, useRef, useState } from 'react';
import type { MatchResult, User, UserStats } from '../types';
import { getSupabaseAuthorizationHeaders } from '../lib/supabase';
import { sound } from '../utils/audio';
import { isCompleteMatchStats, matchOcrPlayerName, parseOcrMatchStats, type ExtractedMatchStats } from '../utils/matchStats';
import { AlertCircle, CheckCircle2, Coins, Loader2, Scan, Save, Swords, Upload, Users } from 'lucide-react';

interface OcrParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onApplyMatchStats: (result: { userId: string; playerName: string; stats: UserStats; result: Exclude<MatchResult, 'unrecorded'>; imageFingerprint: string }) => Promise<void>;
}

type ReviewData = ExtractedMatchStats & { matchedUserId?: string; ambiguousMatch: boolean; result?: Exclude<MatchResult, 'unrecorded'> };

const IMAGE_MAX_SIZE = 15 * 1024 * 1024;
const OCR_IMAGE_MAX_SIZE = 2_700_000;

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Não foi possível ler a imagem.'));
  reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
  reader.readAsDataURL(blob);
});

async function prepareImageForOcr(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2_600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Este navegador não conseguiu preparar a imagem para leitura.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.94, 0.88, 0.82, 0.76, 0.68]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= OCR_IMAGE_MAX_SIZE) return { dataUrl: await blobToDataUrl(blob), mimeType: 'image/jpeg' };
    }
    throw new Error('O print ficou grande demais mesmo após a compressão. Envie um recorte menor da tela.');
  } finally {
    bitmap.close();
  }
}

async function fingerprintImage(dataUrl: string): Promise<string> {
  const encoded = dataUrl.split(',')[1];
  if (!encoded || !globalThis.crypto?.subtle) throw new Error('Não foi possível validar o print. Selecione a imagem novamente.');
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const OcrParserModal: React.FC<OcrParserModalProps> = ({ isOpen, onClose, users, onApplyMatchStats }) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedData, setExtractedData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runOcrAnalysis = async (dataUrl: string, mimeType: string) => {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    setExtractedData(null);

    try {
      const authorization = await getSupabaseAuthorizationHeaders();
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authorization },
        body: JSON.stringify({ imageBase64: dataUrl, mimeType }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || 'Não foi possível analisar o print. Tente novamente.');
      }

      const recognized = parseOcrMatchStats(JSON.stringify(payload.data ?? payload));
      const match = matchOcrPlayerName(recognized.playerName, users);
      setExtractedData({ ...recognized, matchedUserId: match.userId, ambiguousMatch: match.ambiguous });
      sound.playVictory();
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Falha ao analisar o print.');
    } finally {
      setIsLoading(false);
    }
  };

  const readAndProcessFile = async (file: File) => {
    setError(null);
    setSuccessMsg(null);
    setExtractedData(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Use uma imagem PNG, JPEG ou WebP.');
      return;
    }
    if (file.size > IMAGE_MAX_SIZE) {
      setError('A imagem precisa ter no máximo 15 MB.');
      return;
    }

    setIsLoading(true);
    try {
      const prepared = await prepareImageForOcr(file);
      setImagePreview(prepared.dataUrl);
      await runOcrAnalysis(prepared.dataUrl, prepared.mimeType);
    } catch (imageError) {
      setIsLoading(false);
      setError(imageError instanceof Error ? imageError.message : 'Não foi possível preparar o print.');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'))?.getAsFile();
      if (image) void readAndProcessFile(image);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, users]);

  if (!isOpen) return null;

  const updateField = (field: keyof UserStats, rawValue: string) => {
    if (!extractedData) return;
    const parsed = rawValue === '' ? null : Number(rawValue);
    setExtractedData({
      ...extractedData,
      [field]: parsed !== null && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null,
    });
  };

  const updatePlayerName = (playerName: string) => {
    if (!extractedData) return;
    const match = matchOcrPlayerName(playerName, users);
    setExtractedData({ ...extractedData, playerName, matchedUserId: match.userId, ambiguousMatch: match.ambiguous });
  };

  const saveMatchStats = async () => {
    if (!extractedData || !extractedData.matchedUserId || !extractedData.result || !isCompleteMatchStats(extractedData)) {
      setError('Confirme o jogador, o resultado e preencha KDA, minions e ouro antes de salvar.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onApplyMatchStats({
        userId: extractedData.matchedUserId,
        playerName: extractedData.playerName || users.find((user) => user.id === extractedData.matchedUserId)?.name || 'Jogador',
        stats: {
          kills: extractedData.kills,
          deaths: extractedData.deaths,
          assists: extractedData.assists,
          minions: extractedData.minions,
          gold: extractedData.gold,
        },
        result: extractedData.result,
        imageFingerprint: await fingerprintImage(imagePreview || ''),
      });
      setSuccessMsg('Partida adicionada à média da temporada. Os dados mais recentes também foram atualizados no perfil.');
      sound.playVictory();
      window.setTimeout(onClose, 900);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar as estatísticas.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedUser = users.find((user) => user.id === extractedData?.matchedUserId);
  const statsComplete = Boolean(extractedData && isCompleteMatchStats(extractedData));
  const fields: { key: keyof UserStats; label: string; limit: number }[] = [
    { key: 'kills', label: 'Abates', limit: 100 },
    { key: 'deaths', label: 'Mortes', limit: 100 },
    { key: 'assists', label: 'Assistências', limit: 100 },
    { key: 'minions', label: 'Minions', limit: 2_000 },
    { key: 'gold', label: 'Ouro', limit: 1_000_000 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <section role="dialog" aria-modal="true" aria-labelledby="ocr-title" className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-red-700/60 bg-slate-950 shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-red-900/40 bg-gradient-to-r from-red-950/80 via-slate-900 to-slate-950 p-4">
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-red-500/40 bg-red-600/20 p-2 text-red-300"><Scan className="h-5 w-5" /></span>
            <div>
              <h2 id="ocr-title" className="font-display text-lg font-extrabold text-white">Importar estatísticas da partida</h2>
              <p className="text-xs text-slate-400">Envie um print. O site identifica o jogador e lê KDA, minions e ouro.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">×</button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_250px]">
            <label className="relative flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-red-900/60 bg-slate-900/50 p-6 text-center transition hover:border-red-500">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readAndProcessFile(file);
                  event.currentTarget.value = '';
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <Upload className="mb-2 h-9 w-9 text-red-400" />
              <span className="text-sm font-bold text-white">Selecione ou arraste um print</span>
              <span className="mt-1 max-w-sm text-xs text-slate-400">Também pode colar uma imagem com Ctrl + V. O arquivo é preparado para leitura antes do envio.</span>
            </label>

            {imagePreview ? (
              <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-black">
                <img src={imagePreview} alt="Prévia do print enviado" className="h-full w-full object-contain" />
                <span className="absolute bottom-1 right-1 rounded bg-black/80 px-2 py-0.5 font-mono text-[10px] text-slate-300">Print ativo</span>
              </div>
            ) : (
              <div className="flex h-44 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 text-center text-xs text-slate-500">A prévia aparecerá aqui</div>
            )}
          </div>

          {isLoading && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <Loader2 className="h-5 w-5 animate-spin text-red-400" />
              <div><p className="text-sm font-bold text-white">Lendo os dados da partida…</p><p className="text-xs text-slate-400">Localizando o nome, KDA, minions e ouro.</p></div>
            </div>
          )}

          {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-700/60 bg-red-950/50 p-3 text-sm text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
          {successMsg && <div role="status" className="flex gap-2 rounded-xl border border-emerald-700/60 bg-emerald-950/40 p-3 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4 shrink-0" />{successMsg}</div>}

          {extractedData && !isLoading && (
            <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Users className="h-4 w-4 text-sky-300" />
                <h3 className="text-sm font-bold text-white">Jogador encontrado no print</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-300">Nome lido no print
                  <input value={extractedData.playerName || ''} onChange={(event) => updatePlayerName(event.target.value)} placeholder="Digite o nome visível no print" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400" />
                </label>
                <label className="text-xs font-semibold text-slate-300">Perfil correspondente
                  <select value={extractedData.matchedUserId || ''} onChange={(event) => setExtractedData({ ...extractedData, matchedUserId: event.target.value || undefined, ambiguousMatch: false })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400">
                    <option value="">Selecione o jogador</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.handle})</option>)}
                  </select>
                </label>
              </div>
              {selectedUser && <p className="text-xs text-emerald-300">Correspondência: {selectedUser.name} · {selectedUser.handle}</p>}
              {!selectedUser && <p className="text-xs text-amber-300">{extractedData.ambiguousMatch ? 'O nome combina com mais de um perfil. Escolha a pessoa correta.' : 'Não encontrei uma correspondência única. Escolha o perfil correto acima.'}</p>}

              <fieldset className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <legend className="px-1 text-xs font-semibold text-slate-300">Resultado da partida</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'victory', label: 'Vitória', active: 'border-emerald-500/60 bg-emerald-950/50 text-emerald-200' },
                    { value: 'defeat', label: 'Derrota', active: 'border-rose-500/60 bg-rose-950/50 text-rose-200' },
                  ] as const).map((option) => (
                    <button key={option.value} type="button" aria-pressed={extractedData.result === option.value}
                      onClick={() => setExtractedData({ ...extractedData, result: option.value })}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-bold transition ${extractedData.result === option.value ? option.active : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white'}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {fields.map(({ key, label, limit }) => (
                  <label key={key} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs font-semibold text-slate-300">
                    <span className="mb-2 flex items-center gap-1.5">{key === 'gold' ? <Coins className="h-3.5 w-3.5 text-amber-300" /> : key === 'minions' ? <Users className="h-3.5 w-3.5 text-emerald-300" /> : <Swords className="h-3.5 w-3.5 text-rose-300" />}{label}</span>
                    <input type="number" min="0" max={limit} step="1" value={extractedData[key] ?? ''} onChange={(event) => updateField(key, event.target.value)} placeholder="Não lido" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-base font-black text-amber-300 outline-none focus:border-amber-400" />
                  </label>
                ))}
              </div>
              {!statsComplete && <p className="text-xs text-amber-300">Confira os campos vazios e complete os valores que não puderam ser lidos antes de salvar.</p>}
              {!extractedData.result && <p className="text-xs text-amber-300">Selecione se o jogador venceu ou perdeu para registrar o resultado da temporada.</p>}
              {extractedData.notes && <p className="text-xs text-slate-400">Observação do OCR: {extractedData.notes}</p>}
            </section>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-900 p-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white">Cancelar</button>
          <button type="button" onClick={() => void saveMatchStats()} disabled={!extractedData?.matchedUserId || !extractedData?.result || !statsComplete || isLoading || isSaving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-950 transition disabled:cursor-not-allowed disabled:opacity-40">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Salvando…' : 'Adicionar partida à temporada'}
          </button>
        </footer>
      </section>
    </div>
  );
};
