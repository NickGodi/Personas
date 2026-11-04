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
      onChange(await compressImageFile(file));
    } catch {
      setError('Não foi possível carregar esta imagem. Tente outro arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-slate-400">{label}</label>
      <input
        type="url"
        value={isUploadedImage ? '' : value}
        onChange={(event) => onChange(event.target.value.trim() || undefined)}
        placeholder={isUploadedImage ? 'Imagem enviada. Cole outro link para substituí-la.' : 'Cole um link de imagem ou envie do computador'}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white placeholder:text-slate-600"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-200 transition-colors hover:bg-slate-700">
          {isProcessing ? <ImagePlus className="h-3.5 w-3.5 animate-pulse" /> : <Upload className="h-3.5 w-3.5" />}
          {isProcessing ? 'Processando…' : 'Enviar imagem'}
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
          <img src={value} alt="Prévia da imagem de fundo" className="h-14 w-20 rounded-md border border-slate-700 object-cover" />
          <span className="text-slate-400">Prévia do fundo da carta</span>
        </div>
      )}
    </div>
  );
};
