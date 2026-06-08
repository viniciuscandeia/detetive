# Detetive 🔍

Simulação do clássico jogo de dedução **Detetive / Clue** para navegador.
1 jogador humano contra bots com inteligência dedutiva.

## Como Rodar

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173` no navegador.

## Como Jogar

1. Na tela de setup, escolha seu nome, quantos jogadores e qual suspeito você quer ser.
2. Clique em **Iniciar Investigação**.
3. Role o dado, mova sua ficha no tabuleiro, faça suposições e anote pistas no **Caderno**.
4. Quando tiver certeza, faça uma **Acusação** — você só tem uma chance!

### Controles Principais

| Fase | Ação |
|---|---|
| Sua vez (ROLAR) | Clique em **Rolar Dado** |
| Cômodo de canto | Clique em **Passagem Secreta** para ir direto ao cômodo oposto |
| Mover (MOVE) | Clique nas células douradas do tabuleiro ou no overlay do cômodo |
| No cômodo | Clique em **Fazer Suposição** para interrogar |
| Desmentir (você) | Escolha qual carta mostrar no modal que aparece |
| Caderno | Clique em qualquer célula para ciclar: `·` → `✓` → `✗` → `?` |

### Debug

Clique em **👁 Debug: Ver Envelope** para revelar a solução (útil para aprender/testar).

## Bots

Cada bot mantém uma **base de conhecimento** interna:
- Sabe suas próprias cartas e deduz que os demais não as têm.
- Registra quando outros jogadores não podem desmentir uma suposição (→ não têm aquelas cartas).
- Propaga inferências até ponto fixo para deduzir o conteúdo do envelope.
- Acusa assim que os 3 itens do envelope são deduzidos.

## Regras Completas

Veja [REGRAS.md](./REGRAS.md).

## Scripts

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção
npm test         # testes unitários (Vitest)
npm run preview  # pré-visualizar o build
```

## Tecnologias

- **React 18** + **TypeScript** + **Vite**
- **Vitest** para testes unitários
- CSS puro (tema noir) — sem framework externo
