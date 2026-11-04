export async function compressImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem.');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();

    const maxDimension = 1400;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível processar esta imagem.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/webp', 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
