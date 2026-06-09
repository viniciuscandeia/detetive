/**
 * Pure game engine – all functions are (state, …args) → newState.
 * No React, no side-effects, fully testable.
 */
import { GameState, Player, PlayerPosition, BotDifficulty } from './types';
import { SUSPECTS, suspectCard, weaponCard, roomCard, suggestionCards } from './cards';
import { START_POSITIONS, secretPassageDest, cellKey } from './board';
import { computeReachable, occupiedByOthers } from './pathfinding';
import { shuffle, roll1d6, roll2d6, Rng } from './rng';

// ─── Config ────────────────────────────────────────────────────────────────────
export interface GameConfig {
  numPlayers:     number;  // 3–6
  humanName:      string;
  humanSuspectId: number;  // 0–5
  botDifficulty:  BotDifficulty;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function dealCards(n: number, rng: Rng) {
  const sus = shuffle([0,1,2,3,4,5], rng);
  const wep = shuffle([0,1,2,3,4,5], rng);
  const rom = shuffle([0,1,2,3,4,5,6,7,8], rng);
  const envelope = { suspectId: sus[0], weaponId: wep[0], roomId: rom[0] };

  const deck = shuffle([
    ...sus.slice(1).map(s => suspectCard(s)),
    ...wep.slice(1).map(w => weaponCard(w)),
    ...rom.slice(1).map(r => roomCard(r)),
  ], rng);

  const hands: number[][] = Array.from({ length: n }, () => []);
  deck.forEach((c, i) => hands[i % n].push(c));
  return { envelope, hands };
}

function cloneState(s: GameState): GameState {
  return {
    ...s,
    players:           s.players.map(p => ({ ...p, hand: [...p.hand] })),
    log:               [...s.log],
    weaponPositions:   { ...s.weaponPositions },
    passedHistory:     [...s.passedHistory],
    currentSuggestion: s.currentSuggestion
      ? { ...s.currentSuggestion, disproveOrder: [...s.currentSuggestion.disproveOrder] }
      : null,
  };
}

function nextActive(state: GameState, from: number): number {
  const n = state.players.length;
  let i = (from + 1) % n;
  while (i !== from && state.players[i].eliminated) i = (i + 1) % n;
  return i === from && state.players[i].eliminated ? -1 : i;
}

function allEliminated(state: GameState): boolean {
  return state.players.every(p => p.eliminated);
}

function buildDisproveOrder(state: GameState, suggesterIdx: number): number[] {
  const n = state.players.length;
  const order: number[] = [];
  let i = (suggesterIdx + 1) % n;
  while (i !== suggesterIdx) {
    if (!state.players[i].eliminated) order.push(i);
    i = (i + 1) % n;
  }
  return order;
}

// ─── Init ──────────────────────────────────────────────────────────────────────
export function initGame(cfg: GameConfig, rng: Rng): GameState {
  const n = Math.max(3, Math.min(6, cfg.numPlayers));
  const { envelope, hands } = dealCards(n, rng);

  const suspectIds = [0, 1, 2, 3, 4, 5].slice(0, n);

  const players: Player[] = suspectIds.map((sid, idx) => ({
    idx,
    suspectId: sid,
    name:      sid === cfg.humanSuspectId ? cfg.humanName : SUSPECTS[sid].name,
    isBot:     sid !== cfg.humanSuspectId,
    hand:      hands[idx],
    position:  {
      type: 'corridor',
      row:  START_POSITIONS[sid][0],
      col:  START_POSITIONS[sid][1],
    } as PlayerPosition,
    eliminated: false,
  }));

  const roomOrder = shuffle([0,1,2,3,4,5,6,7,8], rng);
  const weaponPositions: Record<number, number | null> = {};
  for (let w = 0; w < 6; w++) weaponPositions[w] = roomOrder[w];

  return {
    phase:                     'ROLL',
    players,
    currentPlayerIdx:          0,
    envelope,
    weaponPositions,
    diceRoll:                  null,
    diceValues:                null,
    reachable:                 null,
    currentSuggestion:         null,
    humanDisproveOpts:         null,
    log:                       [],
    winner:                    null,
    debugReveal:               false,
    arrivedByTransport:        false,
    hasSuggestedThisTurn:      false,
    pendingTransportPlayerIdx: null,
    passedHistory:             [],
    lastTransportedTo:         null,
    botDifficulty:             cfg.botDifficulty,
    suggestionSeq:             0,
  };
}

// ─── Roll ──────────────────────────────────────────────────────────────────────
export function doRoll(state: GameState, rng: Rng): GameState {
  if (state.phase !== 'ROLL') return state;
  const s = cloneState(state);
  const player = s.players[s.currentPlayerIdx];
  const dice   = roll2d6(rng);
  const roll   = dice[0] + dice[1];
  s.diceRoll          = roll;
  s.diceValues        = dice;
  s.arrivedByTransport = false;
  s.lastTransportedTo  = null;
  s.log.push({ type: 'roll', playerIdx: s.currentPlayerIdx, roll, dice });

  const occ = occupiedByOthers(s.players, s.currentPlayerIdx);
  const forbidden = player.position.type === 'room'
    ? new Set([player.position.roomId])
    : new Set<number>();

  const reachable = computeReachable(player.position, roll, occ, forbidden);
  s.reachable = reachable;

  if (reachable.corridorCells.size === 0 && reachable.rooms.size === 0) {
    s.reachable = null;
    s.diceRoll   = null;
    s.diceValues = null;
    s.phase      = 'ACTION';
  } else {
    s.phase = 'MOVE';
  }
  return s;
}

// ─── Secret passage ────────────────────────────────────────────────────────────
export function doUseSecretPassage(state: GameState): GameState {
  if (state.phase !== 'ROLL') return state;
  const player = state.players[state.currentPlayerIdx];
  if (player.position.type !== 'room') return state;
  const dest = secretPassageDest(player.position.roomId);
  if (dest === undefined) return state;

  const s = cloneState(state);
  const fromRoom = (s.players[s.currentPlayerIdx].position as { type: 'room'; roomId: number }).roomId;
  s.players[s.currentPlayerIdx].position = { type: 'room', roomId: dest };
  s.log.push({ type: 'secret_passage', playerIdx: s.currentPlayerIdx, fromRoom, toRoom: dest });
  s.phase              = 'ACTION';
  s.arrivedByTransport = false;
  s.lastTransportedTo  = null;
  return s;
}

// ─── Move ──────────────────────────────────────────────────────────────────────
export function doMoveToRoom(state: GameState, roomId: number): GameState {
  if (state.phase !== 'MOVE') return state;
  if (!state.reachable?.rooms.has(roomId)) return state;

  const s = cloneState(state);
  s.players[s.currentPlayerIdx].position = { type: 'room', roomId };
  s.reachable = null;
  s.phase     = 'ACTION';
  s.log.push({ type: 'move_room', playerIdx: s.currentPlayerIdx, roomId });
  return s;
}

export function doMoveToCorridor(state: GameState, row: number, col: number): GameState {
  if (state.phase !== 'MOVE') return state;
  const key = cellKey(row, col);
  if (!state.reachable?.corridorCells.has(key)) return state;

  const s = cloneState(state);
  s.players[s.currentPlayerIdx].position = { type: 'corridor', row, col };
  s.reachable = null;
  s.phase     = 'ACTION';
  s.log.push({ type: 'move_corridor', playerIdx: s.currentPlayerIdx });
  return s;
}

// ─── Suggest from transport (no roll needed) ───────────────────────────────────
export function doSuggestFromTransport(state: GameState): GameState {
  if (state.phase !== 'ROLL') return state;
  if (!state.arrivedByTransport) return state;
  const player = state.players[state.currentPlayerIdx];
  if (player.position.type !== 'room') return state;

  const s = cloneState(state);
  s.arrivedByTransport = false;
  s.lastTransportedTo  = null;
  s.phase = 'ACTION';
  return s;
}

// ─── Suggestion ────────────────────────────────────────────────────────────────
export function doMakeSuggestion(
  state: GameState, suspectId: number, weaponId: number
): GameState {
  if (state.phase !== 'ACTION') return state;
  if (state.hasSuggestedThisTurn) return state;
  const player = state.players[state.currentPlayerIdx];
  if (player.position.type !== 'room') return state;
  const roomId = player.position.roomId;

  const s = cloneState(state);
  s.hasSuggestedThisTurn = true;

  const suspectPlayer = s.players.find(p => p.suspectId === suspectId);
  if (suspectPlayer) {
    const wasElsewhere =
      suspectPlayer.position.type !== 'room' ||
      suspectPlayer.position.roomId !== roomId;
    suspectPlayer.position = { type: 'room', roomId };
    if (wasElsewhere && suspectPlayer.idx !== s.currentPlayerIdx) {
      s.pendingTransportPlayerIdx = suspectPlayer.idx;
      // Notify the human when they are teleported
      if (!suspectPlayer.isBot) {
        s.lastTransportedTo = roomId;
      }
    }
  }

  s.weaponPositions[weaponId] = roomId;

  const disproveOrder = buildDisproveOrder(s, s.currentPlayerIdx);
  s.currentSuggestion = {
    roomId, suspectId, weaponId,
    suggesterIdx:  s.currentPlayerIdx,
    disproveOrder,
    disproveStep:  0,
    disproverIdx:  null,
    cardShown:     null,
  };

  s.log.push({ type: 'suggestion', playerIdx: s.currentPlayerIdx, suspectId, weaponId, roomId });
  s.suggestionSeq = state.suggestionSeq + 1;
  s.phase = 'DISPROVE';
  return s;
}

// ─── Disprove helpers ──────────────────────────────────────────────────────────
export function matchingCards(state: GameState, playerIdx: number): number[] {
  const sug = state.currentSuggestion;
  if (!sug) return [];
  const player = state.players[playerIdx];
  if (!player) return [];
  const cards = suggestionCards(sug.suspectId, sug.weaponId, sug.roomId);
  return player.hand.filter(c => cards.includes(c));
}

export function advanceDisprove(state: GameState, shownCard: number | null): GameState {
  if (state.phase !== 'DISPROVE' && state.phase !== 'AWAIT_HUMAN_DISPROVE') return state;
  const s  = cloneState(state);
  const sg = s.currentSuggestion!;

  if (shownCard !== null) {
    sg.disproverIdx     = sg.disproveOrder[sg.disproveStep];
    sg.cardShown        = shownCard;
    s.log.push({ type: 'disprove', suggesterIdx: sg.suggesterIdx, disproverIdx: sg.disproverIdx,
                  suspectId: sg.suspectId, weaponId: sg.weaponId, roomId: sg.roomId });
    s.phase             = 'ACTION';
    s.humanDisproveOpts = null;
    return s;
  }

  // Player cannot disprove — record pass for notebook auto-fill and log
  const passedPlayerIdx = sg.disproveOrder[sg.disproveStep];
  const [sc, wc, rc] = suggestionCards(sg.suspectId, sg.weaponId, sg.roomId) as [number, number, number];

  // Guard: if step is out of bounds (corrupted state), end phase cleanly
  if (passedPlayerIdx == null) {
    sg.disproverIdx = null;
    s.log.push({ type: 'disprove', suggesterIdx: sg.suggesterIdx, disproverIdx: null,
                  suspectId: sg.suspectId, weaponId: sg.weaponId, roomId: sg.roomId });
    s.phase = 'ACTION';
    s.humanDisproveOpts = null;
    return s;
  }

  s.passedHistory.push({ playerIdx: passedPlayerIdx, cards: [sc, wc, rc] });
  s.log.push({ type: 'pass', playerIdx: passedPlayerIdx, suggesterIdx: sg.suggesterIdx,
               suspectId: sg.suspectId, weaponId: sg.weaponId, roomId: sg.roomId });

  sg.disproveStep++;
  s.humanDisproveOpts = null;

  if (sg.disproveStep >= sg.disproveOrder.length) {
    sg.disproverIdx = null;
    s.log.push({ type: 'disprove', suggesterIdx: sg.suggesterIdx, disproverIdx: null,
                  suspectId: sg.suspectId, weaponId: sg.weaponId, roomId: sg.roomId });
    s.phase = 'ACTION';
    return s;
  }

  s.phase = 'DISPROVE';
  return s;
}

export function promptHumanDisprove(state: GameState, opts: number[]): GameState {
  const s = cloneState(state);
  s.phase             = 'AWAIT_HUMAN_DISPROVE';
  s.humanDisproveOpts = opts;
  return s;
}

// ─── Accusation ────────────────────────────────────────────────────────────────
export function doMakeAccusation(
  state: GameState, suspectId: number, weaponId: number, roomId: number
): GameState {
  if (state.phase !== 'ACTION') return state;
  const s   = cloneState(state);
  const env = s.envelope;
  const correct =
    env.suspectId === suspectId &&
    env.weaponId  === weaponId  &&
    env.roomId    === roomId;

  const wrongFields = correct ? undefined : {
    suspect: env.suspectId !== suspectId,
    weapon:  env.weaponId  !== weaponId,
    room:    env.roomId    !== roomId,
  };

  s.log.push({ type: 'accusation', playerIdx: s.currentPlayerIdx, correct, wrongFields,
               suspectId, weaponId, roomId });

  if (correct) {
    s.winner = s.currentPlayerIdx;
    s.phase  = 'GAME_OVER';
  } else {
    s.players[s.currentPlayerIdx].eliminated = true;
    s.log.push({ type: 'eliminated', playerIdx: s.currentPlayerIdx });
    if (allEliminated(s)) {
      s.winner = -1;
      s.phase  = 'GAME_OVER';
    } else {
      return doEndTurn(s);
    }
  }
  return s;
}

// ─── End turn ──────────────────────────────────────────────────────────────────
export function doEndTurn(state: GameState): GameState {
  if (state.phase === 'GAME_OVER') return state;
  const s = cloneState(state);
  const next = nextActive(s, s.currentPlayerIdx);

  if (next === -1) {
    s.winner = -1;
    s.phase  = 'GAME_OVER';
    return s;
  }

  const wasTransported = s.pendingTransportPlayerIdx === next &&
    s.players[next].position.type === 'room';

  s.currentPlayerIdx     = next;
  s.diceRoll             = null;
  s.diceValues           = null;
  s.reachable            = null;
  s.currentSuggestion    = null;
  s.humanDisproveOpts    = null;
  s.hasSuggestedThisTurn = false;
  // Only clear pendingTransportPlayerIdx when that player's turn actually arrives;
  // otherwise a transported player who is not immediately next loses their benefit.
  if (s.pendingTransportPlayerIdx === next) s.pendingTransportPlayerIdx = null;
  s.arrivedByTransport = wasTransported;
  // Keep lastTransportedTo only if the incoming player is the one who was transported
  if (!wasTransported) s.lastTransportedTo = null;
  s.phase = 'ROLL';
  return s;
}

// ─── Helpers for external callers ─────────────────────────────────────────────
export function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIdx];
}

export function canUseSecretPassage(state: GameState): boolean {
  if (state.phase !== 'ROLL') return false;
  const p = currentPlayer(state);
  if (p.position.type !== 'room') return false;
  return secretPassageDest(p.position.roomId) !== undefined;
}

export function canSuggest(state: GameState): boolean {
  if (state.phase !== 'ACTION') return false;
  if (state.hasSuggestedThisTurn) return false;
  return currentPlayer(state).position.type === 'room';
}
