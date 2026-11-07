import React, { useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { compressImageFile } from '../utils/images';

interface BackgroundImageFieldProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  label?: string;
}

export const BackgroundImageField: React.FC<BackgroundImageFieldProps> = ({
  value = '',
  onChange,
  label = 'Imagem de fundo da carta',
}) => {
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const isUploadedImage = value.startsWith('data:');

  const handleFile = async (file?: File) => {
    if (!file) return;
    setIsProcessing(true);
    setError('');
    try {
      if (file.type === 'image/gif') {
        if (file.size > 2 * 1024 * 1024) throw new Error('GIFs do computador precisam ter até 2 MB. Para arquivos maiores, cole o link do GIF.');
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Não foi possível ler o GIF.'));
          reader.onerror = () => reject(new Error('Não foi possível ler o GIF.'));
          reader.readAsDataURL(file);
        });
        onChange(dataUrl);
      } else {
        onChange(await compressImageFile(file));
      }
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'Não foi possível carregar esta imagem. Tente outro arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardImage = Array.from(event.clipboardData.items)
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
      ?.getAsFile();
    const file = clipboardImage || Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/'));

    if (file) {
      event.preventDefault();
      void handleFile(file);
      return;
    }

    const pastedText = event.clipboardData.getData('text/plain').trim();
    if (/^https?:\/\//i.test(pastedText)) {
      event.preventDefault();
      setError('');
      onChange(pastedText);
      return;
    }

    event.preventDefault();
    setError('Copie uma imagem ou cole o link direto de uma imagem ou GIF.');
  };

  return (
    <div className="space-y-2">
      <label className="block text-slate-400">{label}</label>
      <input
        type="url"
        value={isUploadedImage ? '' : value}
        onChange={(event) => onChange(event.target.value.trim() || undefined)}
        placeholder={isUploadedImage ? 'Imagem enviada. Cole outro link para substituí-la.' : 'Cole um link direto de imagem ou GIF animado'}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white placeholder:text-slate-600"
      />
      <div className="relative">
        <ImagePlus className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-amber-300" />
        <textarea
          rows={2}
          onPaste={handlePaste}
          readOnly
          disabled={isProcessing}
          aria-label="Colar imagem com Ctrl+V"
          placeholder="Clique aqui e pressione Ctrl+V para colar uma imagem ou GIF"
          className="w-full resize-none rounded-lg border border-dashed border-amber-700/60 bg-amber-950/15 py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none disabled:opacity-60"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-200 transition-colors hover:bg-slate-700">
          {isProcessing ? <ImagePlus className="h-3.5 w-3.5 animate-pulse" /> : <Upload className="h-3.5 w-3.5" />}
          {isProcessing ? 'Processando…' : 'Enviar imagem ou GIF'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={isProcessing}
            onChange={(event) => {
              void handleFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-slate-400 hover:bg-red-950/40 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover imagem
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {value && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-2">
          <img src={value} alt="Prévia da imagem de fundo" className="h-14 w-20 rounded-md border border-slate-700 bg-black/60 object-contain" />
          <span className="text-slate-400">Prévia do fundo da carta</span>
        </div>
      )}
    </div>
  );
};
