type GeminiTextResponse = { text?: string | null };
type GeminiGenerate = (model: string) => Promise<GeminiTextResponse>;

const OCR_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite'];

export class GeminiOcrUnavailableError extends Error {
  constructor() {
    super('Todos os modelos de leitura estão temporariamente ocupados. Tente novamente em alguns instantes.');
    this.name = 'GeminiOcrUnavailableError';
  }
}

function isTemporaryProviderError(error: unknown) {
  const value = error as { code?: unknown; status?: unknown; statusCode?: unknown; message?: unknown } | null;
  const details = [value?.code, value?.status, value?.statusCode, value?.message]
    .filter((part) => part !== undefined && part !== null)
    .map(String)
    .join(' ')
    .toUpperCase();
  return /\b(?:500|502|503|504)\b|UNAVAILABLE|SERVICE_UNAVAILABLE|HIGH DEMAND|TEMPORARILY OVERLOADED/.test(details);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generateOcrWithFallback(generate: GeminiGenerate) {
  for (const [index, model] of OCR_MODELS.entries()) {
    try {
      return await generate(model);
    } catch (error) {
      if (!isTemporaryProviderError(error)) throw error;
      if (index === OCR_MODELS.length - 1) throw new GeminiOcrUnavailableError();
      await wait(250 * (index + 1));
    }
  }

  throw new GeminiOcrUnavailableError();
}

export function getGeminiOcrError(error: unknown) {
  if (error instanceof GeminiOcrUnavailableError) {
    return { status: 503, message: error.message };
  }

  const value = error as { code?: unknown; status?: unknown; statusCode?: unknown; message?: unknown } | null;
  const details = [value?.code, value?.status, value?.statusCode, value?.message]
    .filter((part) => part !== undefined && part !== null)
    .map(String)
    .join(' ')
    .toUpperCase();

  if (/\b429\b|RESOURCE_EXHAUSTED|RATE_LIMIT/.test(details)) {
    return { status: 429, message: 'O limite de uso da API Gemini foi atingido. Aguarde e tente novamente.' };
  }
  if (/\b401\b|\b403\b|API_KEY_INVALID|PERMISSION_DENIED|UNAUTHENTICATED/.test(details)) {
    return { status: 503, message: 'A chave da API Gemini foi recusada. Confira a configuração da chave no Vercel.' };
  }
  return { status: 502, message: 'Não foi possível ler esse print. Confira se os dados estão visíveis e tente novamente.' };
}
