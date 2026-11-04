# Personas

Painel da comunidade Personas para acompanhar cartas da temporada, votar, montar equipes e sortear regras de partida.

## Requisitos

- Node.js 20.19 ou superior, ou 22.12 ou superior
- npm

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. O servidor também disponibiliza `GET /api/health` para verificar se está ativo.

Para habilitar a leitura de imagens com Gemini, copie `.env.example` para `.env.local` e preencha `GEMINI_API_KEY`. Sem a chave, a área de OCR usa dados demonstrativos.

## Comandos

- `npm run build` gera a versão de produção em `dist/`.
- `npm run preview` abre localmente a versão compilada.
- `npm run typecheck` valida os tipos TypeScript.
- `npm run clean` remove os artefatos de build no Windows, macOS e Linux.

Os dados do protótipo ficam no armazenamento local do navegador.
