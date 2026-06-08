// Board layout: 24 rows × 24 cols (indices 0-23).
// Row 0, row 23, col 0, col 23 = outer walls.
// Everything not a room / center / outer-wall = corridor.

export const BOARD_ROWS = 24;
export const BOARD_COLS = 24;

export interface RoomBoardDef {
  id: number;
  r1: number; c1: number; r2: number; c2: number;
  /** Corridor cells that are valid door entrances (adjacent to room boundary). */
  doors: [number, number][];
  /** Room ID reachable via secret passage, or undefined. */
  secretPassage?: number;
}

// ─── Room definitions ────────────────────────────────────────────────────────
export const ROOM_DEFS: RoomBoardDef[] = [
  // 0 Cozinha            (top-left corner)
  { id: 0, r1: 1, c1: 1,  r2: 5,  c2: 6,  doors: [[6,4]],         secretPassage: 8 },
  // 1 Salão de Baile     (top-centre)
  { id: 1, r1: 1, c1: 9,  r2: 5,  c2: 15, doors: [[6,11],[6,13]] },
  // 2 Jardim de Inverno  (top-right corner)
  { id: 2, r1: 1, c1: 18, r2: 4,  c2: 22, doors: [[3,17]],         secretPassage: 6 },
  // 3 Sala de Jantar     (mid-left upper)
  { id: 3, r1: 8, c1: 1,  r2: 12, c2: 5,  doors: [[10,6],[13,2]] },
  // 4 Sala de Bilhar     (mid-left lower)
  { id: 4, r1: 14,c1: 1,  r2: 18, c2: 5,  doors: [[16,6],[13,4]] },
  // 5 Biblioteca         (mid-right)
  { id: 5, r1: 10,c1: 18, r2: 17, c2: 22, doors: [[9,20],[13,17]] },
  // 6 Sala de Estar      (bottom-left corner)
  { id: 6, r1: 20,c1: 1,  r2: 22, c2: 6,  doors: [[21,7]],         secretPassage: 2 },
  // 7 Hall               (bottom-centre)
  { id: 7, r1: 20,c1: 9,  r2: 22, c2: 14, doors: [[21,8],[19,11]] },
  // 8 Escritório         (bottom-right corner)
  { id: 8, r1: 20,c1: 17, r2: 22, c2: 22, doors: [[21,16],[19,18]], secretPassage: 0 },
];

// Center X (envelope placeholder – impassable)
export const CENTER_BOUNDS = { r1: 10, c1: 10, r2: 13, c2: 13 } as const;

// ─── Suspect start positions (corridor cells) ─────────────────────────────────
// Index = suspectId.  Srta. Rosa (0) always plays first.
export const START_POSITIONS: [number, number][] = [
  [6, 16],  // 0 Srta. Rosa
  [7, 22],  // 1 Cel. Mostarda
  [1,  7],  // 2 Dona Violeta
  [1, 16],  // 3 Sr. Marinho
  [19, 7],  // 4 Dona Branca
  [19,16],  // 5 Prof. Black
];

// ─── Tile types ───────────────────────────────────────────────────────────────
export type TileKind = 'wall' | 'corridor' | 'room' | 'center';

export interface Tile {
  kind:    TileKind;
  roomId?: number;
}

// ─── Board construction ───────────────────────────────────────────────────────
function buildBoard(): Tile[][] {
  const grid: Tile[][] = Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, (): Tile => ({ kind: 'wall' }))
  );

  // Center
  const cb = CENTER_BOUNDS;
  for (let r = cb.r1; r <= cb.r2; r++)
    for (let c = cb.c1; c <= cb.c2; c++)
      grid[r][c] = { kind: 'center' };

  // Rooms (overwrite wall/center – no overlap exists)
  for (const rd of ROOM_DEFS)
    for (let r = rd.r1; r <= rd.r2; r++)
      for (let c = rd.c1; c <= rd.c2; c++)
        grid[r][c] = { kind: 'room', roomId: rd.id };

  // Corridors: everything inside borders that is still 'wall'
  for (let r = 1; r < BOARD_ROWS - 1; r++)
    for (let c = 1; c < BOARD_COLS - 1; c++)
      if (grid[r][c].kind === 'wall')
        grid[r][c] = { kind: 'corridor' };

  return grid;
}

export const BOARD: Tile[][] = buildBoard();

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const cellKey = (r: number, c: number) => `${r},${c}`;
export const parseKey = (k: string): [number, number] => {
  const [r, c] = k.split(',').map(Number);
  return [r, c];
};

export function getTile(r: number, c: number): Tile {
  if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return { kind: 'wall' };
  return BOARD[r][c];
}

export function isPassableCorridor(r: number, c: number): boolean {
  return getTile(r, c).kind === 'corridor';
}

export function getRoomIdAt(r: number, c: number): number | null {
  const t = getTile(r, c);
  return t.kind === 'room' ? (t.roomId ?? null) : null;
}

// Map: "r,c" -> roomId for cells that are door-adjacent corridors
const _doorMap = new Map<string, number>();
for (const rd of ROOM_DEFS)
  for (const [dr, dc] of rd.doors)
    _doorMap.set(cellKey(dr, dc), rd.id);

/** If the corridor cell is a valid door for a room, return that roomId; else null. */
export function doorRoomId(r: number, c: number): number | null {
  return _doorMap.get(cellKey(r, c)) ?? null;
}

/** All door corridor cells for a given room. */
export function roomDoors(roomId: number): [number, number][] {
  return ROOM_DEFS[roomId].doors;
}

/** Rooms reachable via secret passage from given room. */
export function secretPassageDest(roomId: number): number | undefined {
  return ROOM_DEFS[roomId].secretPassage;
}

export const DIRS: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];
