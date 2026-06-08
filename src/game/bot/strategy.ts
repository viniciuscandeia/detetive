import { GameState, BotDifficulty } from '../types';
import { envelopeCards, unknownCards, canAccuse, BotKnowledge } from './knowledge';
import { isSuspectCard, isWeaponCard, isRoomCard } from '../cards';
import { ROOM_DEFS } from '../board';
import { computeReachable, occupiedByOthers } from '../pathfinding';

// ─── Accusation ────────────────────────────────────────────────────────────────
export function botShouldAccuse(kb: BotKnowledge, diff: BotDifficulty): boolean {
  if (!canAccuse(kb)) return false;
  if (diff === 'FACIL')  return Math.random() > 0.5;  // 50% hesitation
  if (diff === 'NORMAL') return Math.random() > 0.1;  // 10% hesitation
  return true;                                         // DIFICIL: accuse immediately
}

export function botBuildAccusation(kb: BotKnowledge): {
  suspectId: number; weaponId: number; roomId: number;
} | null {
  const env     = envelopeCards(kb);
  const suspect = [...env].find(c => isSuspectCard(c));
  const weapon  = [...env].find(c => isWeaponCard(c));
  const room    = [...env].find(c => isRoomCard(c));
  if (suspect === undefined || weapon === undefined || room === undefined) return null;
  return { suspectId: suspect, weaponId: weapon - 6, roomId: room - 12 };
}

// ─── Suggestion ────────────────────────────────────────────────────────────────
export function botChooseSuggestion(
  kb:   BotKnowledge,
  diff: BotDifficulty,
  _roomId: number,
): { suspectId: number; weaponId: number } {
  const unknown = new Set(unknownCards(kb));
  const env     = envelopeCards(kb);

  // FACIL: random choice from valid suspects/weapons
  if (diff === 'FACIL') {
    const s = Math.floor(Math.random() * 6);
    const w = Math.floor(Math.random() * 6);
    return { suspectId: s, weaponId: w };
  }

  const suspects = [0, 1, 2, 3, 4, 5];
  const weapons  = [0, 1, 2, 3, 4, 5];

  const pickSuspect =
    suspects.find(s => unknown.has(s) || env.has(s)) ??
    suspects[0];

  const pickWeapon =
    weapons.find(w => unknown.has(6 + w) || env.has(6 + w)) ??
    weapons[0];

  return { suspectId: pickSuspect, weaponId: pickWeapon };
}

// ─── Destination scoring ───────────────────────────────────────────────────────
function scoreRoom(roomId: number, kb: BotKnowledge): number {
  const unknown = new Set(unknownCards(kb));
  const env     = envelopeCards(kb);
  const rc      = 12 + roomId;
  let score = 0;
  if (unknown.has(rc)) score += 3;
  else if (env.has(rc)) score += 1;
  const s = [0,1,2,3,4,5].find(x => unknown.has(x) || env.has(x)) ?? 0;
  const w = [0,1,2,3,4,5].find(x => unknown.has(6 + x) || env.has(6 + x)) ?? 0;
  if (unknown.has(s) || env.has(s)) score += 1;
  if (unknown.has(6 + w) || env.has(6 + w)) score += 1;
  return score;
}

/**
 * Find the all-rooms best-score room ID (for corridor fallback targeting).
 */
function bestGlobalRoom(kb: BotKnowledge): number {
  let best = 0, bestScore = -1;
  for (let r = 0; r < 9; r++) {
    const s = scoreRoom(r, kb);
    if (s > bestScore) { bestScore = s; best = r; }
  }
  return best;
}

// ─── Destination ───────────────────────────────────────────────────────────────
export function botChooseDestination(
  state:  GameState,
  botIdx: number,
  kb:     BotKnowledge,
): { type: 'room'; roomId: number } | { type: 'corridor'; row: number; col: number } | null {
  const player  = state.players[botIdx];
  const roll    = state.diceRoll ?? 0;
  const occ     = occupiedByOthers(state.players, botIdx);
  const forbidden = player.position.type === 'room'
    ? new Set([player.position.roomId])
    : new Set<number>();

  const reachable = computeReachable(player.position, roll, occ, forbidden);
  if (reachable.rooms.size === 0 && reachable.corridorCells.size === 0) return null;

  // Score reachable rooms
  let bestRoom: number | null = null;
  let bestScore = -1;

  for (const rId of reachable.rooms) {
    const s = scoreRoom(rId, kb);
    if (s > bestScore) { bestScore = s; bestRoom = rId; }
  }

  if (bestRoom !== null) return { type: 'room', roomId: bestRoom };

  // No useful room reachable — move toward the best global target room
  const targetRoomId  = bestGlobalRoom(kb);
  const targetDoors   = ROOM_DEFS[targetRoomId].doors;

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

  // Final fallback: any reachable room or any corridor cell
  const [firstKey] = reachable.corridorCells;
  if (firstKey) {
    const [r, c] = firstKey.split(',').map(Number);
    return { type: 'corridor', row: r, col: c };
  }

  return null;
}
