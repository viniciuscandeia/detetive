/**
 * Per-bot deduction engine.
 *
 * For each (player, card) pair we track:
 *   HAS      – this player definitely holds this card
 *   NOT_HAS  – this player definitely does NOT hold this card
 *   UNKNOWN  – we don't know yet
 *
 * A card is in the envelope iff ALL players are NOT_HAS for it.
 */

export type Certainty = 'HAS' | 'NOT_HAS' | 'UNKNOWN';

export interface KnowledgeConstraint {
  playerIdx: number;
  cards:     number[]; // player has at least one of these
}

export interface BotKnowledge {
  botIdx:     number;
  numPlayers: number;
  handSizes:  number[];
  matrix:     Certainty[][];
  constraints: KnowledgeConstraint[];
  /** Cards already revealed to specific players: shownTo[playerIdx] = Set<cardId> */
  shownTo:    Record<number, number[]>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────
export function createBotKnowledge(
  botIdx:     number,
  hand:       number[],
  numPlayers: number,
  handSizes?: number[],
): BotKnowledge {
  const matrix: Certainty[][] = Array.from({ length: numPlayers }, () =>
    Array(21).fill('UNKNOWN' as Certainty)
  );

  for (let c = 0; c < 21; c++) {
    if (hand.includes(c)) {
      matrix[botIdx][c] = 'HAS';
      for (let p = 0; p < numPlayers; p++) {
        if (p !== botIdx) matrix[p][c] = 'NOT_HAS';
      }
    } else {
      matrix[botIdx][c] = 'NOT_HAS';
    }
  }

  // Deal distributes 18 cards round-robin; earlier players get one extra when not divisible
  const defaultSizes = Array.from({ length: numPlayers }, (_, i) =>
    Math.floor((18 + numPlayers - 1 - i) / numPlayers)
  );
  const sizes = handSizes ?? defaultSizes;

  const kb: BotKnowledge = {
    botIdx, numPlayers, handSizes: sizes,
    matrix, constraints: [],
    shownTo: {},
  };
  propagate(kb);
  return kb;
}

// ─── Updates ──────────────────────────────────────────────────────────────────
/** Called when someone shows the bot a specific card. */
export function recordCardShown(
  kb: BotKnowledge, fromPlayerIdx: number, cardId: number
): BotKnowledge {
  const m = cloneMatrix(kb);
  setHas(m, fromPlayerIdx, cardId, kb.numPlayers);
  const next: BotKnowledge = { ...kb, matrix: m };
  propagate(next);
  return next;
}

/** Called when THIS bot shows a card to another player — track for smarter disprove. */
export function recordCardShownByBot(
  kb: BotKnowledge, toPlayerIdx: number, cardId: number
): BotKnowledge {
  const prev = kb.shownTo[toPlayerIdx] ?? [];
  if (prev.includes(cardId)) return kb;
  return {
    ...kb,
    shownTo: { ...kb.shownTo, [toPlayerIdx]: [...prev, cardId] },
  };
}

/**
 * Called when player P could NOT disprove — P does NOT have any of the three cards.
 */
export function recordCannotDisprove(
  kb: BotKnowledge,
  playerIdx: number,
  sc: number, wc: number, rc: number,
): BotKnowledge {
  const m = cloneMatrix(kb);
  setNotHas(m, playerIdx, sc);
  setNotHas(m, playerIdx, wc);
  setNotHas(m, playerIdx, rc);
  const next: BotKnowledge = { ...kb, matrix: m };
  propagate(next);
  return next;
}

/**
 * Called when player P DID disprove (but we don't know which card).
 * Adds a constraint: P has at least one of the three cards.
 */
export function recordSuggestionResult(
  kb: BotKnowledge,
  disproverIdx: number,
  sc: number, wc: number, rc: number,
): BotKnowledge {
  const cards = [sc, wc, rc].filter(c => kb.matrix[disproverIdx][c] === 'UNKNOWN');
  if (cards.length === 0) return kb;
  if (cards.length === 1) {
    const m = cloneMatrix(kb);
    setHas(m, disproverIdx, cards[0], kb.numPlayers);
    const next: BotKnowledge = { ...kb, matrix: m, constraints: [...kb.constraints] };
    propagate(next);
    return next;
  }
  const next: BotKnowledge = {
    ...kb,
    matrix:      cloneMatrix(kb),
    constraints: [...kb.constraints, { playerIdx: disproverIdx, cards }],
  };
  propagate(next);
  return next;
}

// ─── Queries ──────────────────────────────────────────────────────────────────
export function envelopeCards(kb: BotKnowledge): Set<number> {
  const result = new Set<number>();
  for (let c = 0; c < 21; c++) {
    if (kb.matrix.every(row => row[c] === 'NOT_HAS')) result.add(c);
  }
  return result;
}

export function canAccuse(kb: BotKnowledge): boolean {
  const env = envelopeCards(kb);
  return [0,1,2,3,4,5].some(c => env.has(c)) &&
         [6,7,8,9,10,11].some(c => env.has(c)) &&
         [12,13,14,15,16,17,18,19,20].some(c => env.has(c));
}

export function unknownCards(kb: BotKnowledge): number[] {
  const result: number[] = [];
  for (let c = 0; c < 21; c++) {
    const anyHas    = kb.matrix.some(row => row[c] === 'HAS');
    const allNotHas = kb.matrix.every(row => row[c] === 'NOT_HAS');
    if (!anyHas && !allNotHas) result.push(c);
  }
  return result;
}

// ─── Propagation ──────────────────────────────────────────────────────────────
function propagate(kb: BotKnowledge): void {
  let changed = true;
  while (changed) {
    changed = false;

    // 1. If card HAS owner → all others NOT_HAS
    for (let c = 0; c < 21; c++) {
      const hasPlayer = kb.matrix.findIndex(row => row[c] === 'HAS');
      if (hasPlayer !== -1) {
        for (let p = 0; p < kb.numPlayers; p++) {
          if (p !== hasPlayer && kb.matrix[p][c] !== 'NOT_HAS') {
            kb.matrix[p][c] = 'NOT_HAS';
            changed = true;
          }
        }
      }
    }

    // 2. Hand-size inference:
    //    2a. If player p has exactly handSizes[p] HAS cards → remaining UNKNOWN become NOT_HAS
    //    2b. If player p's remaining UNKNOWN count equals (handSizes[p] - hasCount)
    //        → those UNKNOWN cards must be HAS (naked-single / positive dual)
    for (let p = 0; p < kb.numPlayers; p++) {
      const hasCount     = kb.matrix[p].filter(c => c === 'HAS').length;
      const unknownCount = kb.matrix[p].filter(c => c === 'UNKNOWN').length;
      const needed       = kb.handSizes[p] - hasCount;

      if (needed === 0) {
        // Rule 2a: hand is full — no more unknowns can be HAS
        for (let c = 0; c < 21; c++) {
          if (kb.matrix[p][c] === 'UNKNOWN') {
            kb.matrix[p][c] = 'NOT_HAS';
            changed = true;
          }
        }
      } else if (unknownCount > 0 && unknownCount === needed) {
        // Rule 2b: exactly as many unknowns as slots left → all must be HAS
        for (let c = 0; c < 21; c++) {
          if (kb.matrix[p][c] === 'UNKNOWN') {
            setHas(kb.matrix, p, c, kb.numPlayers);
            changed = true;
          }
        }
      }
    }

    // 3. Constraints: if only one card still UNKNOWN → player must HAS it
    kb.constraints = kb.constraints.filter(con => {
      const still = con.cards.filter(c => kb.matrix[con.playerIdx][c] === 'UNKNOWN');
      if (still.length === 0) return false;
      if (still.length === 1) {
        setHas(kb.matrix, con.playerIdx, still[0], kb.numPlayers);
        changed = true;
        return false;
      }
      con.cards = still;
      return true;
    });
  }
}

// ─── Internals ────────────────────────────────────────────────────────────────
function cloneMatrix(kb: BotKnowledge): Certainty[][] {
  return kb.matrix.map(row => [...row]);
}

function setHas(m: Certainty[][], playerIdx: number, cardId: number, numPlayers: number): void {
  m[playerIdx][cardId] = 'HAS';
  for (let p = 0; p < numPlayers; p++) {
    if (p !== playerIdx) m[p][cardId] = 'NOT_HAS';
  }
}

function setNotHas(m: Certainty[][], playerIdx: number, cardId: number): void {
  if (!m[playerIdx]) return;  // guard against out-of-bounds playerIdx
  if (m[playerIdx][cardId] === 'UNKNOWN') m[playerIdx][cardId] = 'NOT_HAS';
}
