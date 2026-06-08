# Detetive — Referência do Projeto

Jogo de dedução estilo Cluedo em React + TypeScript + Vite.
URL pública: **https://viniciuscandeia.github.io/detetive/**
Repo: **https://github.com/viniciuscandeia/detetive**

---

## Stack

- React 18 + TypeScript (strict)
- Vite 5 (`base: '/detetive/'` — obrigatório para GitHub Pages)
- Vitest + happy-dom para testes
- CSS puro em `src/styles/index.css` (sem Tailwind/módulos)

---

## Desenvolvimento local

```bash
npm install        # instalar dependências (só na primeira vez)
npm run dev        # servidor local em http://localhost:5173
npm run test       # rodar testes unitários
npx tsc --noEmit   # checar tipos sem buildar
```

O servidor dev inclui middleware em `vite.config.ts` que salva logs em `./logs/`
(`current_game.json` ao vivo + `partida_TIMESTAMP.json` ao fim de cada partida).
Esses arquivos **não vão para o git** (`.gitignore`).

---

## Deploy (GitHub Pages)

O deploy é **automático**: qualquer push para `main` dispara o workflow
`.github/workflows/deploy.yml` que roda `npm run build` e publica `dist/`.

### Fluxo normal de trabalho

```bash
# 1. Fazer as alterações no código

# 2. Checar tipos e buildar localmente (opcional mas recomendado)
npx tsc --noEmit
npm run build

# 3. Commitar e enviar
git add -A
git commit -m "descrição das mudanças"
git push
```

Após o push, o workflow leva ~50 s para concluir. Acompanhar:

```bash
gh run list                  # listar runs recentes
gh run watch                 # aguardar o run mais recente ao vivo
```

### Deploy manual (forçar sem novo commit)

```bash
gh workflow run deploy.yml
```

### Ver status do Pages

```bash
gh api repos/viniciuscandeia/detetive/pages --jq '{url: .html_url, status: .status}'
```

---

## Estrutura principal

```
src/
  game/
    engine.ts          # lógica pura do jogo (sem React)
    types.ts           # GameState, Player, LogEntry, ...
    cards.ts           # SUSPECTS, WEAPONS, ROOMS, IDs
    board.ts           # tabuleiro, passagens secretas, START_POSITIONS
    pathfinding.ts     # computeReachable
    rng.ts             # Rng, shuffle, roll2d6
    bot/
      knowledge.ts     # BotKnowledge — matriz HAS/NOT_HAS + propagação
      strategy.ts      # escolha de destino, suposição, acusação
      disprove.ts      # escolha de carta ao desmentir
    __tests__/         # testes Vitest
  state/
    useGame.ts         # reducer + automação de bots (useEffect) + API pública
  components/
    GameScreen.tsx     # tela principal, overlay de suposição, caderno
    Notebook.tsx       # caderno de anotações (estado em GameScreen)
    GameLog.tsx        # registro de ações
    Board.tsx          # tabuleiro SVG/grid
    ActionPanel.tsx    # painel de ações do jogador
    SetupScreen.tsx    # tela de configuração
    ...
  styles/
    index.css          # todo CSS (variáveis CSS em :root)
  utils/
    logExport.ts       # salvar log (só dev) / download (prod)
```

---

## Pontos importantes

- **`cloneState` em `engine.ts`** clona profundamente `currentSuggestion` (incluindo
  `disproveOrder`) para evitar mutação do estado original pelo StrictMode do React.
- **`game.suggestionSeq`** incrementa a cada suposição; usado como dep do `useEffect`
  de overlay em `GameScreen` e como gate de reconhecimento em `useGame`.
- **`marks` do Notebook** vive em `GameScreen` (não no componente) para persistir
  entre a aba lateral e o overlay de suposição.
- O middleware `/api/save-log` **só existe em dev**; em produção `saveLogToFile`
  retorna imediatamente (`import.meta.env.DEV` guard).
