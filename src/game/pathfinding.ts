import { ROOM_DEFS, cellKey, doorRoomId, getTile, DIRS } from './board';
import { PlayerPosition, ReachableSet } from './types';

/**
 * BFS over corridor cells from `position` with `roll` steps.
 *
 * Model:
 *  - Exiting a room costs 1 step (room → door corridor cell).
 *  - Moving between corridor cells costs 1 step each.
 *  - Entering a room is FREE once you reach its door corridor cell
 *    (i.e., a room is reachable if any of its doors is in the BFS result).
 *  - Cannot land on / pass through an occupied corridor cell.
 *  - Cannot enter a forbidden room (e.g., the room you started in).
 *  - Cannot use a door blocked by an occupant (occupant on the door cell).
 */
export function computeReachable(
  position:     PlayerPosition,
  roll:         number,
  occupied:     Set<string>,   // "r,c" of corridor cells taken by other players
  forbidden:    Set<number>,   // roomIds the mover cannot enter
): ReachableSet {
  const corridorCells = new Set<string>();
  const rooms         = new Set<number>();

  if (roll <= 0) return { corridorCells, rooms };

  // visited maps cell key → max remaining steps seen so far
  // We use Dijkstra-style BFS (uniform cost = 1, so plain BFS suffices)
  const dist   = new Map<string, number>();
  // queue items: [row, col, stepsRemaining]
  const queue: [number, number, number][] = [];

  function tryEnqueue(r: number, c: number, rem: number) {
    if (rem < 0) return;
    const key = cellKey(r, c);
    if (occupied.has(key)) return;          // blocked by a player
    const best = dist.get(key) ?? -1;
    if (best >= rem) return;                 // already reached with >= steps
    dist.set(key, rem);
    queue.push([r, c, rem]);
  }

  // ── Seed BFS ──────────────────────────────────────────────────────────────
  if (position.type === 'corridor') {
    // Start from current cell; first expansions cost 1 step
    const { row, col } = position;
    const key = cellKey(row, col);
    dist.set(key, roll); // mark start
    // Expand neighbours
    for (const [dr, dc] of DIRS) {
      const nr = row + dr, nc = col + dc;
      if (getTile(nr, nc).kind === 'corridor') tryEnqueue(nr, nc, roll - 1);
    }
  } else {
    // Exiting room: reach each door corridor cell with (roll-1) remaining
    if (roll < 1) return { corridorCells, rooms };
    for (const [dr, dc] of ROOM_DEFS[position.roomId].doors) {
      tryEnqueue(dr, dc, roll - 1);
    }
  }

  // ── BFS ───────────────────────────────────────────────────────────────────
  let qi = 0;
  while (qi < queue.length) {
    const [r, c, rem] = queue[qi++];
    const key = cellKey(r, c);

    // Skip stale entries
    if ((dist.get(key) ?? -1) > rem) continue;

    corridorCells.add(key);

    // Check if this corridor cell is a door to any room
    const rId = doorRoomId(r, c);
    if (rId !== null && !forbidden.has(rId)) rooms.add(rId);

    if (rem === 0) continue;

    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (getTile(nr, nc).kind === 'corridor') tryEnqueue(nr, nc, rem - 1);
    }
  }

  return { corridorCells, rooms };
}

/** Build the set of corridor cells currently occupied by all players EXCEPT `selfIdx`. */
export function occupiedByOthers(
  players: { idx: number; position: PlayerPosition; eliminated: boolean }[],
  selfIdx: number,
): Set<string> {
  const s = new Set<string>();
  for (const p of players) {
    if (p.idx === selfIdx) continue;
    if (p.eliminated) continue;  // eliminated tokens don't block movement
    if (p.position.type === 'corridor') s.add(cellKey(p.position.row, p.position.col));
  }
  return s;
}
