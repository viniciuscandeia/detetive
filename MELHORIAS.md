# Do MVP ao Produto — Backlog de Implementações

Cada item tem: **severidade**, **arquivo:linha**, **problema** e **implementação**.

---

## 🔴 Bugs Críticos (quebram a partida)

---

### 1. `SuggestionModal` mostra apenas N suspeitos em vez de 6

**Arquivo:** `src/components/SuggestionModal.tsx:23`

**Problema:** `SUSPECTS.slice(0, numPlayers)` assume que só os suspeitos dos jogadores
ativos podem ser acusados. Mas o assassino pode ser qualquer um dos 6, inclusive fichas de
suspeitos cujos jogadores não estão na partida (fichas paradas no tabuleiro).

```tsx
// ❌ atual
{SUSPECTS.slice(0, numPlayers).map(s => (...))}

// ✅ correto
{SUSPECTS.map(s => (...))}
```

---

### 2. `initBk` não passa tamanhos reais de mão para os bots

**Arquivo:** `src/state/useGame.ts:18`

**Problema:** `createBotKnowledge(p.idx, p.hand, game.players.length)` omite o quarto
argumento `handSizes`. A função usa uma fórmula estimada que funciona para 3/6 jogadores
mas pode divergir em 4–5 jogadores se a ordem de distribuição diferir. O bot pode inferir
erroneamente que um jogador "tem todas as cartas" e parar de propagar NOT_HAS.

```ts
// ❌ atual
bk[p.idx] = KB.createBotKnowledge(p.idx, p.hand, game.players.length);

// ✅ correto
const sizes = game.players.map(p => p.hand.length);
bk[p.idx] = KB.createBotKnowledge(p.idx, p.hand, game.players.length, sizes);
```

---

### 3. Bot nunca sugere na sala para onde foi transportado

**Arquivo:** `src/state/useGame.ts` (bloco `phase === 'ROLL' && cp.isBot`)

**Problema:** `doSuggestFromTransport` existe no engine mas nunca é chamado. Quando um bot
chega transportado (`arrivedByTransport=true`), o `useEffect` entra no bloco ROLL e
simplesmente rola o dado — desperdiçando a suposição gratuita que as regras garantem.

```ts
// ❌ atual — só rola
if (Engine.canUseSecretPassage(game) && Math.random() < 0.5) {
  dispatch({ t: 'SECRET' });
} else {
  dispatch({ t: 'ROLL', rng: rngRef.current });
}

// ✅ correto — verifica transporte primeiro
if (game.arrivedByTransport) {
  // Bot decide: sugerir sem rolar ou rolar e sair
  const kb = bk[cp.idx];
  const pos = cp.position;
  if (kb && pos.type === 'room') {
    const { suspectId, weaponId } = botChooseSuggestion(kb, pos.roomId);
    // Vai para ACTION sem rolar, então fará a suposição no próximo tick
    dispatch({ t: 'SECRET_TRANSPORT' }); // ← novo action type que chama doSuggestFromTransport
  } else {
    dispatch({ t: 'ROLL', rng: rngRef.current });
  }
} else if (Engine.canUseSecretPassage(game) && Math.random() < 0.5) {
  dispatch({ t: 'SECRET' });
} else {
  dispatch({ t: 'ROLL', rng: rngRef.current });
}
```

Adicionar ao reducer:
```ts
case 'SECRET_TRANSPORT': return { ...st, game: Engine.doSuggestFromTransport(st.game) };
```

---

### 4. Modal de suposição não fecha quando fase muda

**Arquivo:** `src/components/GameScreen.tsx:21-24`

**Problema:** O comentário "use setTimeout(0) trick" indica que o dev sabia do problema
mas não implementou. Se o modal está aberto e a fase muda (ex: bot age muito rápido),
o modal fica preso na tela bloqueando o jogo.

```tsx
// ❌ atual — código morto
if (modal !== 'none' && !canAct) {
  // use setTimeout(0) trick instead of setting during render
}

// ✅ correto — useEffect que fecha o modal
useEffect(() => {
  if (!canAct && modal !== 'none') setModal('none');
}, [canAct]);
```

---

### 5. Botão "Rolar e sair" na fase ROLL com `arrivedByTransport`

**Arquivo:** `src/components/ActionPanel.tsx:63-67`

**Problema:** O botão chama `api.roll` mas o texto diz "Rolar e sair da sala" — semanticamente
confuso. Mais grave: não existe botão para **fazer a suposição gratuita** garantida pelas regras.
O jogador humano perde a opção de sugerir sem rolar.

```tsx
// ❌ atual — apenas mostra "Rolar e sair"
{game.arrivedByTransport && inRoom && (
  <button className="btn-secondary" onClick={api.roll}>
    Rolar e sair da sala
  </button>
)}

// ✅ correto — mostra sugestão gratuita primeiro, rolar como alternativa
{game.arrivedByTransport && inRoom && (
  <>
    <button className="btn-primary" onClick={() => {
      api.useTransportSuggest(); // chama doSuggestFromTransport → fase vai para ACTION
    }}>
      🔍 Sugerir nesta sala (sem rolar)
    </button>
    <button className="btn-secondary" onClick={api.roll}>
      🎲 Ignorar e Rolar
    </button>
  </>
)}
```

---

### 6. `botChooseDestination` — corredor fallback pega célula arbitrária do Set

**Arquivo:** `src/game/bot/strategy.ts:93-97`

**Problema:** `const [firstKey] = reachable.corridorCells` pega o primeiro elemento da
`Set`, que reflete a ordem de inserção do BFS (célula de saída do cômodo, geralmente
a porta). O bot pode ficar parado próximo à porta em vez de avançar para uma sala útil.

```ts
// ❌ atual
const [firstKey] = reachable.corridorCells;
if (firstKey) {
  const [r, c] = firstKey.split(',').map(Number);
  return { type: 'corridor', row: r, col: c };
}

// ✅ correto — mover em direção à sala com maior pontuação (BFS reverso)
// Calcular a sala-alvo mais valiosa e escolher a célula de corredor
// que minimiza a distância Manhattan até alguma porta dessa sala.
const targetRoomId = bestRoomByScore(kb); // extrair lógica de scoring existente
const targetDoors  = ROOM_DEFS[targetRoomId].doors;
let bestCell: string | null = null;
let bestDist = Infinity;
for (const key of reachable.corridorCells) {
  const [r, c] = key.split(',').map(Number);
  for (const [dr, dc] of targetDoors) {
    const dist = Math.abs(r - dr) + Math.abs(c - dc);
    if (dist < bestDist) { bestDist = dist; bestCell = key; }
  }
}
if (bestCell) {
  const [r, c] = bestCell.split(',').map(Number);
  return { type: 'corridor', row: r, col: c };
}
```

---

## 🟡 Funcionalidades Ausentes (partida incompleta sem elas)

---

### 7. Caderno não preenche ✗ automaticamente quando jogador passa na suposição

**Arquivo:** `src/components/Notebook.tsx:19-34`

**Problema:** O caderno auto-preenche ✓ quando uma carta é mostrada ao humano, mas não
preenche ✗ quando um jogador **não consegue desmentir** (passed). Perda de informação
valiosa — as regras garantem que ele não tem nenhuma das 3 cartas sugeridas.

**Implementação:** No `useEffect` do Notebook, monitorar `game.log` para entradas
`type: 'disprove'` onde `disproverIdx` é null (ninguém desmentiu) ou entradas parciais
de disprove — ou melhor: expor no `GameState` um histórico de `{playerIdx, cardsMissed: number[]}`.

```ts
// Novo campo em GameState:
passedHistory: Array<{ playerIdx: number; cards: [number, number, number] }>;

// Em engine.ts / advanceDisprove — quando shownCard === null:
if (shownCard === null) {
  s.passedHistory = [
    ...s.passedHistory,
    { playerIdx: disproverIdx, cards: [sc, wc, rc] }
  ];
}

// Em Notebook.tsx / useEffect:
for (const pass of game.passedHistory) {
  for (const c of pass.cards) {
    if (marks[c]?.[pass.playerIdx] !== '✓') { // não sobreescreve se já confirmado
      next[c] = { ...next[c], [pass.playerIdx]: '✗' };
    }
  }
}
```

---

### 8. Notificação visual quando o token do humano é teleportado

**Arquivo:** `src/state/useGame.ts` + `src/components/GameScreen.tsx`

**Problema:** Quando um bot sugere e move o token do jogador humano para outra sala,
não há feedback visual além do log (texto pequeno). O jogador pode não perceber.

**Implementação:** Novo campo `lastTransportedTo: number | null` no `GameState`. Mostrar
um toast/banner:

```tsx
// GameScreen.tsx
{game.lastTransportedTo !== null && (
  <div className="transport-toast">
    ⚡ Você foi levado para <strong>{ROOMS[game.lastTransportedTo].name}</strong>!
    {!game.hasSuggestedThisTurn && ' Você pode sugerir aqui.'}
  </div>
)}
```

---

### 9. Bot não rastreia cartas já mostradas a cada oponente

**Arquivo:** `src/game/bot/disprove.ts:14-18`

**Problema:** `kb.matrix[suggesterIdx][c] === 'HAS'` verifica se o bot **deduziu** que o
sugestante tem a carta — mas o bot quer saber se ele **já mostrou** essa carta antes ao
mesmo sugestante (para não vazar novas informações). Os dois não são equivalentes.

**Implementação:** Adicionar `shownTo: Record<number, Set<number>>` ao `BotKnowledge`
(quais cartas já mostrei para cada playerIdx) e alimentar em `applyDisproveToBk`.

```ts
// Em BotKnowledge:
shownTo: Record<number, number[]>; // shownTo[playerIdx] = [cardIds mostrados]

// Em disprove.ts:
const alreadyShown = matching.filter(c =>
  (kb.shownTo[suggesterIdx] ?? []).includes(c)
);
if (alreadyShown.length > 0) return alreadyShown[0];
```

---

### 10. Layout responsivo ausente

**Arquivo:** `src/styles/index.css` — `.game-screen`

**Problema:** Grid de 2 colunas (`auto 280px`) quebra em telas < 1100px. Num celular
o tabuleiro fica fora da tela.

```css
/* ✅ adicionar ao .game-screen */
@media (max-width: 1000px) {
  .game-screen {
    grid-template-columns: 1fr;
    grid-template-areas: "left" "right" "bottom";
  }
  .board-grid {
    /* células menores em mobile */
    grid-template-columns: repeat(24, 15px);
    grid-template-rows:    repeat(24, 15px);
  }
}
```

---

### 11. Nenhum nível de dificuldade para os bots

**Arquivo:** `src/game/bot/strategy.ts` + `src/state/useGame.ts`

**Problema:** Todos os bots são igualmente dedutivos. Sem escolha de dificuldade, a partida
é sempre a mesma para um jogador iniciante.

**Implementação:** Enum `BotDifficulty = 'FACIL' | 'NORMAL' | 'DIFICIL'` passado via
`GameConfig`. No nível FÁCIL:
- Bot atrasa acusação mesmo quando deduz o envelope (40% de chance de esperar 1 turno).
- Bot não usa hand-size inference.
- Bot escolhe carta para desmentir aleatoriamente.

```ts
// strategy.ts
export function botShouldAccuse(kb: BotKnowledge, diff: BotDifficulty): boolean {
  if (!canAccuse(kb)) return false;
  if (diff === 'FACIL')  return Math.random() > 0.6;  // 40% de hesitação
  if (diff === 'NORMAL') return Math.random() > 0.1;
  return true; // DIFICIL: acusa imediatamente
}
```

---

### 12. Sem persistência de partida (F5 reseta tudo)

**Arquivo:** `src/state/useGame.ts`

**Problema:** Estado no React in-memory — recarregar a página perde a partida.

**Implementação:** Serializar/deserializar `GameState` no `localStorage`.

```ts
// useGame.ts — persistência simples
const SAVE_KEY = 'detetive_save';

function saveState(st: St) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(st.game)); } catch {}
}

function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) as GameState : null;
  } catch { return null; }
}

// No reducer, após INIT/qualquer ação mutante:
useEffect(() => { saveState(st); }, [st.game]);
```

**Nota:** `BotKnowledge` não precisa ser serializado — pode ser reconstruído a partir
do log ao carregar (replay das observações).

---

### 13. Nenhuma animação de turno do bot (bots agem instantaneamente do ponto de vista do usuário)

**Arquivo:** `src/state/useGame.ts:10` — `BOT_MS = 850`

**Problema:** O delay de 850ms existe, mas todos os passos do bot (roll → move → suggest →
disprove) disparam em cascata sem feedback visual intermediário. O jogador vê o estado
final, não o processo.

**Implementação:** Adicionar estado visual `botThinking: boolean` que ativa um indicador
"🤔 pensando…" no painel de ação, e aumentar delays progressivos por fase:

```ts
const BOT_DELAYS = { ROLL: 600, MOVE: 800, ACTION: 1000, DISPROVE: 500 };
```

---

## 🟠 Problemas de UX / Jogabilidade

---

### 14. Log mostra `#i` em ordem reversa confusa

**Arquivo:** `src/components/GameLog.tsx:41`

**Problema:** `flex-direction: column-reverse` mostra entradas novas em cima, mas o índice
`#{log.length - i}` conta do total para baixo — confuso. Melhor mostrar `#${i + 1}` com
scroll para o mais recente.

```tsx
// Trocar column-reverse por scroll to bottom:
<div className="log-scroll" ref={scrollRef}>
  {log.map((e, i) => (
    <div key={i} className={`log-entry log-${e.type}`}>
      <span className="log-idx">#{i + 1}</span>
      {formatEntry(e, players)}
    </div>
  ))}
  <div ref={endRef} />
</div>
// + CSS: .log-scroll { overflow-y: auto; max-height: 280px; }
```

---

### 15. Tokens múltiplos na mesma célula do tabuleiro se sobrepõem

**Arquivo:** `src/components/Board.tsx:29`

**Problema:** `c = rd.c1 + (p.suspectId % width)` pode colocar 2 tokens na mesma célula.
Quando a sala tem 2 jogadores, eles ficam sobrepostos.

```tsx
// ✅ distribuir tokens dentro da célula usando offset por índice na lista
const offset = i * 7; // px
style={{ left: `${4 + offset}px`, top: '4px' }}
```

---

### 16. Célula do tabuleiro 22px — cliques em corredor difíceis

**Arquivo:** `src/components/Board.tsx:6`, `src/styles/index.css`

**Problema:** Células de 22px são pequenas demais para clique preciso. Ao clicar no
corredor para mover, o jogador frequentemente acerta a célula errada.

**Implementação curto prazo:** Escalar via `transform: scale(1.5)` com overflow scroll.
**Implementação ideal:** Substituir o tilemap por uma representação vetorial (SVG) do
tabuleiro com cômodos como polígonos clicáveis maiores e corredores como caminhos.

---

### 17. Ausência de tutorial / primeira vez

**Arquivo:** `src/components/SetupScreen.tsx`

**Implementação:** Adicionar um botão "Como jogar" que abre um modal com as regras
resumidas (link para `REGRAS.md` ou versão inline simplificada).

---

### 18. Sem feedback de erro na acusação errada

**Arquivo:** `src/components/EndScreen.tsx` + engine

**Problema:** Quando a acusação está errada, o jogador é eliminado sem ver *qual* carta
do envelope estava diferente da sua acusação.

**Implementação:** No `doMakeAccusation`, registrar um `wrongGuess` com as diferenças:

```ts
s.log.push({
  type: 'accusation', playerIdx: s.currentPlayerIdx, correct: false,
  wrongFields: {
    suspect: env.suspectId !== suspectId,
    weapon:  env.weaponId  !== weaponId,
    room:    env.roomId    !== roomId,
  }
});
```

---

## ⚪ Dívida Técnica

---

### 19. `allCards` declarado mas nunca usado

**Arquivo:** `src/components/Notebook.tsx:13`

```ts
// ❌ remover
const allCards = Array.from({ length: 21 }, (_, i) => i)
```

---

### 20. `roomDoors` importado mas não usado

**Arquivo:** `src/game/bot/strategy.ts:4`

```ts
// ❌ remover da importação
import { ROOM_DEFS, roomDoors } from '../board';
```

---

### 21. `BLANK` calculado no load do módulo

**Arquivo:** `src/state/useGame.ts` — constante `BLANK`

**Problema:** Roda `initGame` com seed=1 no parse do módulo. Inofensivo mas
desnecessário — pode usar `null!` com um cheque ou `useMemo`.

---

### 22. `useEffect` de bots usa `[st]` como dependência — re-roda desnecessariamente

**Arquivo:** `src/state/useGame.ts`

**Problema:** `useEffect(..., [st])` re-executa a cada render mesmo quando só o `bk`
mudou (sem mudança de fase). Deveria depender de `[st.game.phase, st.game.currentPlayerIdx]`.

```ts
// ✅
}, [st.game.phase, st.game.currentPlayerIdx, st.game.humanDisproveOpts]);
```

---

### 23. Testes unitários não cobrem bots + engine integrado

**Arquivos de teste existentes:** apenas `engine.test.ts`, `pathfinding.test.ts`, `knowledge.test.ts`

**Faltam:**
- `strategy.test.ts` — `botBuildAccusation`, `botChooseSuggestion`, `botChooseDestination`
- `integration.test.ts` — partida completa simulada com 3 bots até o vencedor, verificando
  que o jogo sempre termina e o vencedor é correto

---

## Ordem de Implementação Sugerida

| Prioridade | Item | Impacto |
|---|---|---|
| 1 | Bug #1 — SuggestionModal 6 suspeitos | Regra errada |
| 2 | Bug #5 — Botão transporte humano | Funcionalidade perdida |
| 3 | Bug #3 — Bot sugere ao ser transportado | Regra errada |
| 4 | Bug #4 — Fechar modal na mudança de fase | Crash de UX |
| 5 | Bug #2 — handSizes nos bots | Dedução incorreta |
| 6 | Feature #7 — Caderno auto-✗ | Qualidade de vida |
| 7 | Feature #8 — Toast de transporte | Feedback visual |
| 8 | Bug #6 — Bot avança no corredor | Bots mais inteligentes |
| 9 | Feature #11 — Dificuldade | Rejogabilidade |
| 10 | Feature #12 — Persistência | Produção |
| 11 | UX #15 — Tokens sobrepostos | Legibilidade |
| 12 | UX #16 — Tabuleiro maior / SVG | Ergonomia |
| 13 | Feature #10 — Responsivo | Mobile |
| 14 | Dívida #22 — useEffect deps | Performance |
| 15 | Feature #13 — Animações bot | Polimento |
