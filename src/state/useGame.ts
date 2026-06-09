import { useReducer, useEffect, useRef, useState } from 'react';
import { GameState, BotDifficulty } from '../game/types';
import { saveLogToFile } from '../utils/logExport';
import * as Engine from '../game/engine';
import * as KB from '../game/bot/knowledge';
import {
  botChooseDestination, botChooseSuggestion,
  botShouldAccuse, botBuildAccusation,
} from '../game/bot/strategy';
import { botChooseDisprove } from '../game/bot/disprove';
import { makeRng, Rng } from '../game/rng';
import { suspectCard, weaponCard, roomCard, SUSPECTS, WEAPONS, ROOMS } from '../game/cards';

// Delays keyed by phase for bot "thinking" feel
const BOT_DELAYS: Record<string, number> = {
  ROLL:    600,
  MOVE:    800,
  ACTION:  1000,
  DISPROVE: 500,
};

const SAVE_KEY    = 'detetive_save_v2';
const SAVE_KEY_BK = 'detetive_save_v2_bk';

// ─── Slice state ──────────────────────────────────────────────────────────────
interface St {
  game:        GameState;
  bk:          Record<number, KB.BotKnowledge>;
  botThinking: boolean;
}

function buildBk(game: GameState): Record<number, KB.BotKnowledge> {
  const bk: Record<number, KB.BotKnowledge> = {};
  const sizes = game.players.map(p => p.hand.length);
  game.players.forEach(p => {
    if (p.isBot)
      bk[p.idx] = KB.createBotKnowledge(p.idx, p.hand, game.players.length, sizes);
  });
  return bk;
}

// ─── Update bot knowledge after a disprove step ───────────────────────────────
function applyDisproveToBk(
  bk:        Record<number, KB.BotKnowledge>,
  game:      GameState,   // state BEFORE advanceDisprove
  shownCard: number | null,
): Record<number, KB.BotKnowledge> {
  const sug = game.currentSuggestion;
  if (!sug) return bk;

  const disproverIdx = sug.disproveOrder[sug.disproveStep];
  if (disproverIdx === undefined) return bk;   // step past end — nothing to record
  const sc = suspectCard(sug.suspectId);
  const wc = weaponCard(sug.weaponId);
  const rc = roomCard(sug.roomId);
  const nextBk = { ...bk };

  for (const p of game.players) {
    if (!p.isBot) continue;
    let kb = nextBk[p.idx];
    if (!kb) continue;

    if (shownCard === null) {
      kb = KB.recordCannotDisprove(kb, disproverIdx, sc, wc, rc);
    } else {
      if (p.idx === sug.suggesterIdx) {
        // This bot made the suggestion — sees which card was shown
        kb = KB.recordCardShown(kb, disproverIdx, shownCard);
      } else {
        // Observing bot — only knows someone disproved
        kb = KB.recordSuggestionResult(kb, disproverIdx, sc, wc, rc);
      }
      // If this bot IS the disprover, track which card it showed to the suggester
      if (p.idx === disproverIdx) {
        kb = KB.recordCardShownByBot(kb, sug.suggesterIdx, shownCard);
      }
    }
    nextBk[p.idx] = kb;
  }
  return nextBk;
}

// ─── localStorage persistence ─────────────────────────────────────────────────
function saveGame(game: GameState): void {
  try {
    // Reachable contains Sets — strip before serialising
    const storable = { ...game, reachable: null };
    localStorage.setItem(SAVE_KEY, JSON.stringify(storable));
  } catch { /* ignore quota errors */ }
}

function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as GameState;
    // Ensure fields added after first save exist
    if (!g.passedHistory)    g.passedHistory    = [];
    if (!g.lastTransportedTo && g.lastTransportedTo !== 0) g.lastTransportedTo = null;
    if (!g.botDifficulty)    g.botDifficulty    = 'NORMAL';
    if (!g.diceValues)       g.diceValues       = null;
    if (g.suggestionSeq === undefined) g.suggestionSeq = 0;
    // Validate currentSuggestion — if disproveOrder is missing (old save), clear it
    if (g.currentSuggestion && !Array.isArray(g.currentSuggestion.disproveOrder)) {
      g.currentSuggestion = null;
      g.phase = 'ACTION';  // recover gracefully
    }
    return g;
  } catch { return null; }
}

function saveBk(bk: Record<number, KB.BotKnowledge>): void {
  try { localStorage.setItem(SAVE_KEY_BK, JSON.stringify(bk)); } catch { /* ignore quota errors */ }
}

function loadBk(): Record<number, KB.BotKnowledge> | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY_BK);
    return raw ? JSON.parse(raw) as Record<number, KB.BotKnowledge> : null;
  } catch { return null; }
}

function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(SAVE_KEY_BK);
  } catch { /* noop */ }
}

/** Public helper: returns true if a non-finished save exists. Avoids duplicating parse logic. */
export function hasSavedGame(): boolean {
  const g = loadGame();
  return g !== null && g.phase !== 'GAME_OVER';
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
type Action =
  | { t: 'INIT';          config: Engine.GameConfig; seed: number }
  | { t: 'ROLL';          rng: Rng }
  | { t: 'SECRET' }
  | { t: 'TRANSPORT_SUGGEST' }
  | { t: 'MOVE_ROOM';     roomId: number }
  | { t: 'MOVE_COR';      row: number; col: number }
  | { t: 'SUGGEST';       suspectId: number; weaponId: number }
  | { t: 'ADV_DISP';      shownCard: number | null; prevGame: GameState }
  | { t: 'PROMPT_DISP';   opts: number[] }
  | { t: 'HUMAN_CARD';    cardId: number; prevGame: GameState }
  | { t: 'ACCUSE';        suspectId: number; weaponId: number; roomId: number }
  | { t: 'END_TURN' }
  | { t: 'DEBUG' }
  | { t: 'SET_THINKING';  val: boolean };

function reducer(st: St, a: Action): St {
  switch (a.t) {
    case 'INIT': {
      const rng  = makeRng(a.seed);
      const game = Engine.initGame(a.config, rng);
      clearSave();
      return { game, bk: buildBk(game), botThinking: false };
    }
    case 'ROLL': {
      const game = Engine.doRoll(st.game, a.rng);
      saveGame(game);
      return { ...st, game, botThinking: false };
    }
    case 'SECRET': {
      const game = Engine.doUseSecretPassage(st.game);
      saveGame(game);
      return { ...st, game, botThinking: false };
    }
    case 'TRANSPORT_SUGGEST': {
      const game = Engine.doSuggestFromTransport(st.game);
      saveGame(game);
      return { ...st, game, botThinking: false };
    }
    case 'MOVE_ROOM': {
      const game = Engine.doMoveToRoom(st.game, a.roomId);
      saveGame(game);
      return { ...st, game };
    }
    case 'MOVE_COR': {
      const game = Engine.doMoveToCorridor(st.game, a.row, a.col);
      saveGame(game);
      return { ...st, game };
    }
    case 'SUGGEST': {
      const game = Engine.doMakeSuggestion(st.game, a.suspectId, a.weaponId);
      saveGame(game);
      return { ...st, game };
    }
    case 'ADV_DISP': {
      const bk   = applyDisproveToBk(st.bk, a.prevGame, a.shownCard);
      const game = Engine.advanceDisprove(st.game, a.shownCard);
      saveGame(game);
      return { ...st, game, bk, botThinking: false };
    }
    case 'PROMPT_DISP': {
      const game = Engine.promptHumanDisprove(st.game, a.opts);
      return { ...st, game };
    }
    case 'HUMAN_CARD': {
      const bk   = applyDisproveToBk(st.bk, a.prevGame, a.cardId);
      const game = Engine.advanceDisprove(st.game, a.cardId);
      saveGame(game);
      return { ...st, game, bk };
    }
    case 'ACCUSE': {
      const game = Engine.doMakeAccusation(st.game, a.suspectId, a.weaponId, a.roomId);
      if (game.phase === 'GAME_OVER') clearSave();
      else saveGame(game);
      return { ...st, game };
    }
    case 'END_TURN': {
      const game = Engine.doEndTurn(st.game);
      saveGame(game);
      return { ...st, game };
    }
    case 'DEBUG':
      return { ...st, game: { ...st.game, debugReveal: !st.game.debugReveal } };
    case 'SET_THINKING':
      return { ...st, botThinking: a.val };
    default:
      return st;
  }
}

// ─── Initial state (from save or blank) ───────────────────────────────────────
function makeInitialState(): St {
  const saved = loadGame();
  if (saved && saved.phase !== 'GAME_OVER') {
    // Restore bot knowledge from persisted save; fall back to fresh build if missing/corrupt.
    const savedBk = loadBk() ?? buildBk(saved);
    return { game: saved, bk: savedBk, botThinking: false };
  }
  const rng  = makeRng(1);
  const game = Engine.initGame(
    { numPlayers: 4, humanName: 'Detetive', humanSuspectId: 0, botDifficulty: 'NORMAL' },
    rng,
  );
  return { game, bk: buildBk(game), botThinking: false };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useGame() {
  const [st, dispatch]    = useReducer(reducer, undefined, makeInitialState);
  // ackedSeq: last bot-suggestion seq the user acknowledged (-1 = none yet)
  // When game.suggestionSeq > ackedSeq the bot-suggestion overlay shows and
  // the DISPROVE step-0 timer is NOT scheduled — no race condition possible.
  const [ackedSeq, setAckedSeq]     = useState(-1);
  const [stepMode, setStepMode]     = useState(false);
  const [stepAdvances, setStepAdvances] = useState(0);
  const [gameKey, setGameKey]       = useState(0);  // increments on each newGame — forces bot effect to re-run even when other deps unchanged
  const stepConsumedRef = useRef(0);  // tracks how many advances have been consumed
  const rngRef          = useRef<Rng>(makeRng(Date.now()));
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  // Live-save: overwrite ./logs/current_game.json on every new log entry
  useEffect(() => {
    if (st.game.log.length === 0) return;
    saveLogToFile(st.game, false).catch(() => { /* server not running */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.game.log.length]);

  // Persist bot knowledge alongside game save so bots remember deductions on page reload
  useEffect(() => {
    if (st.game.phase !== 'GAME_OVER') saveBk(st.bk);
  }, [st.bk, st.game.phase]);

  // Bot automation — depend on phase + currentPlayerIdx + humanDisproveOpts only
  useEffect(() => {
    clearTimer();
    const { game, bk } = st;
    if (game.phase === 'GAME_OVER') return;

    const cp   = game.players[game.currentPlayerIdx];
    const diff = game.botDifficulty;

    // ── Bot ROLL ────────────────────────────────────────────────────────────
    if (game.phase === 'ROLL' && cp.isBot) {
      // Step mode: wait for user to click "Avançar" before each bot turn
      if (stepMode && stepConsumedRef.current >= stepAdvances) {
        return;  // waiting — effect re-fires when stepAdvances increments
      }
      if (stepMode) stepConsumedRef.current = stepAdvances;  // consume this advance

      dispatch({ t: 'SET_THINKING', val: true });
      timerRef.current = setTimeout(() => {
        if (game.arrivedByTransport) {
          // Bot decides: suggest here or roll out
          dispatch({ t: 'TRANSPORT_SUGGEST' });
        } else if (Engine.canUseSecretPassage(game) && rngRef.current() < 0.5) {
          dispatch({ t: 'SECRET' });
        } else {
          dispatch({ t: 'ROLL', rng: rngRef.current });
        }
      }, BOT_DELAYS.ROLL);
      return clearTimer;
    }

    // ── Bot MOVE ────────────────────────────────────────────────────────────
    if (game.phase === 'MOVE' && cp.isBot) {
      dispatch({ t: 'SET_THINKING', val: true });
      timerRef.current = setTimeout(() => {
        const kb   = bk[cp.idx];
        const dest = kb ? botChooseDestination(game, cp.idx, kb) : null;
        if (!dest) { dispatch({ t: 'END_TURN' }); return; }
        if (dest.type === 'room') dispatch({ t: 'MOVE_ROOM', roomId: dest.roomId });
        else                      dispatch({ t: 'MOVE_COR', row: dest.row, col: dest.col });
      }, BOT_DELAYS.MOVE);
      return clearTimer;
    }

    // ── Bot ACTION ──────────────────────────────────────────────────────────
    if (game.phase === 'ACTION' && cp.isBot) {
      dispatch({ t: 'SET_THINKING', val: true });
      timerRef.current = setTimeout(() => {
        const kb = bk[cp.idx];
        if (kb && botShouldAccuse(kb, diff, rngRef.current)) {
          const acc = botBuildAccusation(kb);
          if (acc) { dispatch({ t: 'ACCUSE', ...acc }); return; }
        }
        if (Engine.canSuggest(game) && kb) {
          const pos = cp.position;
          if (pos.type === 'room') {
            const { suspectId, weaponId } = botChooseSuggestion(kb, diff, pos.roomId, rngRef.current);
            dispatch({ t: 'SUGGEST', suspectId, weaponId });
            return;
          }
        }
        dispatch({ t: 'END_TURN' });
      }, BOT_DELAYS.ACTION);
      return clearTimer;
    }

    // ── DISPROVE rotation ───────────────────────────────────────────────────
    if (game.phase === 'DISPROVE') {
      const sug = game.currentSuggestion!;

      // Gate: if the suggestion was made by a bot and step 0 hasn't started yet,
      // wait for the user to acknowledge the notification before scheduling anything.
      // This eliminates the race where the step-0 timer was scheduled and then
      // immediately cancelled by a paused→true state update.
      const suggester = game.players[sug.suggesterIdx];
      if (suggester?.isBot && sug.disproveStep === 0 && game.suggestionSeq > ackedSeq) {
        return;  // effect re-fires when ackedSeq increments (via acknowledgeBotSuggestion)
      }
      if (sug.disproveStep >= sug.disproveOrder.length) return;
      const disproverIdx = sug.disproveOrder[sug.disproveStep];
      const disprover    = game.players[disproverIdx];
      // Guard: disproveOrder entry is invalid or player doesn't exist
      if (disproverIdx == null || !disprover) return;
      const matching     = Engine.matchingCards(game, disproverIdx);

      if (disprover.isBot) {
        dispatch({ t: 'SET_THINKING', val: true });
        timerRef.current = setTimeout(() => {
          const prevGame    = game;
          const kb          = bk[disproverIdx];
          const shownBefore = kb?.shownTo[sug.suggesterIdx] ?? [];
          const hasNewCard  = matching.some(c => !shownBefore.includes(c));

          // Pass if no matching cards, or all matching cards already shown to this suggester
          if (matching.length === 0 || !hasNewCard) {
            dispatch({ t: 'ADV_DISP', shownCard: null, prevGame });
          } else {
            const card = kb
              ? botChooseDisprove(matching, kb, sug.suggesterIdx)
              : matching[0];
            dispatch({ t: 'ADV_DISP', shownCard: card, prevGame });
          }
        }, BOT_DELAYS.DISPROVE);
        return clearTimer;
      } else {
        // Human disprover
        if (matching.length === 0) {
          timerRef.current = setTimeout(() =>
            dispatch({ t: 'ADV_DISP', shownCard: null, prevGame: game }), 0);
          return clearTimer;
        }
        if (game.humanDisproveOpts === null) {
          dispatch({ t: 'PROMPT_DISP', opts: matching });
        }
      }
    }
  }, [
    gameKey,                                   // new game always re-fires even if phase/idx unchanged
    ackedSeq,                                  // acknowledgement fires the effect again
    stepMode,                                  // step mode toggle
    stepAdvances,                              // increment triggers effect after Avançar click
    st.game.phase,
    st.game.currentPlayerIdx,
    st.game.humanDisproveOpts,
    st.game.arrivedByTransport,
    st.game.currentSuggestion?.disproveStep,  // keeps disprove rotation firing on each pass
  ]);

  // Public API
  return {
    game:        st.game,
    botThinking: st.botThinking,
    hasSave:     hasSavedGame(),

    newGame: (config: Engine.GameConfig) => {
      setAckedSeq(-1);                       // reset acknowledgement for new game
      setGameKey(k => k + 1);               // force bot-automation effect to re-run after INIT
      rngRef.current = makeRng(Date.now());
      dispatch({ t: 'INIT', config, seed: Date.now() });
    },
    // resumeSave removed: actual resume happens via makeInitialState reading localStorage
    // before any INIT dispatch. App.tsx calls onResume={() => setStarted(true)} which
    // displays GameScreen with the already-loaded state — no extra dispatch needed.

    roll:        ()                        => dispatch({ t: 'ROLL', rng: rngRef.current }),
    useSecret:   ()                        => dispatch({ t: 'SECRET' }),
    useTransportSuggest: ()                => dispatch({ t: 'TRANSPORT_SUGGEST' }),
    moveToRoom:     (r: number)            => dispatch({ t: 'MOVE_ROOM', roomId: r }),
    moveToCorridor: (r: number, c: number) => dispatch({ t: 'MOVE_COR', row: r, col: c }),
    suggest:    (s: number, w: number)     => dispatch({ t: 'SUGGEST', suspectId: s, weaponId: w }),
    showCard:   (cardId: number)           => dispatch({ t: 'HUMAN_CARD', cardId, prevGame: st.game }),
    accuse:     (s: number, w: number, r: number) =>
                                              dispatch({ t: 'ACCUSE', suspectId: s, weaponId: w, roomId: r }),
    endTurn:    ()                         => dispatch({ t: 'END_TURN' }),
    toggleDebug: ()                        => dispatch({ t: 'DEBUG' }),

    isHumanTurn:   !st.game.players[st.game.currentPlayerIdx]?.isBot,
    canSuggestNow: Engine.canSuggest(st.game),
    canUsePassage: Engine.canUseSecretPassage(st.game),

    botSuggestionPending: (() => {
      const { game } = st;
      if (game.phase !== 'DISPROVE') return null;
      const sug = game.currentSuggestion;
      if (!sug || sug.disproveStep !== 0) return null;
      const suggester = game.players[sug.suggesterIdx];
      if (!suggester?.isBot) return null;
      if (game.suggestionSeq <= ackedSeq) return null;
      return {
        playerName:  suggester.name,
        playerColor: SUSPECTS[suggester.suspectId].color,
        suspectName: SUSPECTS[sug.suspectId].name,
        weaponName:  WEAPONS[sug.weaponId].name,
        roomName:    ROOMS[sug.roomId].name,
      };
    })(),
    acknowledgeBotSuggestion: () => setAckedSeq(st.game.suggestionSeq),

    stepMode,
    toggleStepMode: () => setStepMode(v => !v),
    advanceStep:    () => setStepAdvances(s => s + 1),
    // true when step mode is on and waiting for user to click Avançar
    waitingForStep: stepMode &&
      !!(st.game.players[st.game.currentPlayerIdx]?.isBot) &&
      st.game.phase === 'ROLL' &&
      !st.botThinking,
  };
}

export type GameAPI = ReturnType<typeof useGame>;
