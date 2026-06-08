export type CorridorPos = { type: 'corridor'; row: number; col: number };
export type RoomPos    = { type: 'room';     roomId: number };
export type PlayerPosition = CorridorPos | RoomPos;

export type BotDifficulty = 'FACIL' | 'NORMAL' | 'DIFICIL';

export interface Player {
  idx:       number;
  suspectId: number;
  name:      string;
  isBot:     boolean;
  hand:      number[];       // card IDs: suspects 0-5, weapons 6-11, rooms 12-20
  position:  PlayerPosition;
  eliminated: boolean;
}

export interface Suggestion {
  roomId:       number;
  suspectId:    number;
  weaponId:     number;
  suggesterIdx: number;
  disproveOrder: number[]; // player indices in turn-left order
  disproveStep:  number;   // current index into disproveOrder
  disproverIdx:  number | null;
  cardShown:     number | null; // card ID shown (only visible to suggester & disproving player)
}

export type Phase =
  | 'ROLL'
  | 'MOVE'
  | 'ACTION'
  | 'DISPROVE'
  | 'AWAIT_HUMAN_DISPROVE'
  | 'GAME_OVER';

export type LogEntry =
  | { type: 'roll';           playerIdx: number; roll: number; dice?: [number, number] }
  | { type: 'move_room';      playerIdx: number; roomId: number }
  | { type: 'move_corridor';  playerIdx: number }
  | { type: 'secret_passage'; playerIdx: number; fromRoom: number; toRoom: number }
  | { type: 'suggestion';     playerIdx: number; suspectId: number; weaponId: number; roomId: number }
  | { type: 'pass';           playerIdx: number; suggesterIdx: number;
      suspectId: number; weaponId: number; roomId: number }
  | { type: 'disprove';       suggesterIdx: number; disproverIdx: number | null;
      suspectId: number; weaponId: number; roomId: number }
  | { type: 'accusation';     playerIdx: number; correct: boolean;
      suspectId: number; weaponId: number; roomId: number;
      wrongFields?: { suspect: boolean; weapon: boolean; room: boolean } }
  | { type: 'eliminated';     playerIdx: number };

export interface ReachableSet {
  corridorCells: Set<string>; // "row,col"
  rooms:         Set<number>;
}

export interface GameState {
  phase:              Phase;
  players:            Player[];
  currentPlayerIdx:   number;
  envelope:           { suspectId: number; weaponId: number; roomId: number };
  weaponPositions:    Record<number, number | null>; // weaponId -> roomId | null
  diceRoll:           number | null;
  diceValues:         [number, number] | null;
  reachable:          ReachableSet | null;
  currentSuggestion:  Suggestion | null;
  humanDisproveOpts:  number[] | null; // card IDs the human can show
  log:                LogEntry[];
  winner:             number | null;   // playerIdx | -1 (all eliminated)
  debugReveal:        boolean;
  arrivedByTransport: boolean;
  hasSuggestedThisTurn: boolean;
  pendingTransportPlayerIdx: number | null;
  /** Track all passes (couldn't disprove) for Notebook auto-fill. */
  passedHistory: Array<{ playerIdx: number; cards: [number, number, number] }>;
  /** Set when the human's token is teleported by another player's suggestion. */
  lastTransportedTo: number | null;
  /** Difficulty level for all bots in this game. */
  botDifficulty: BotDifficulty;
  /** Increments each time a suggestion is made — used to gate bot-suggestion notification. */
  suggestionSeq: number;
}
