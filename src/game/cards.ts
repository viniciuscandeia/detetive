export interface SuspectDef { id: number; name: string; color: string; initials: string }
export interface WeaponDef  { id: number; name: string; icon: string }
export interface RoomDef    { id: number; name: string }

// Card IDs: suspects 0-5, weapons 6-11, rooms 12-20
export const SUSPECTS: SuspectDef[] = [
  { id: 0, name: 'Srta. Rosa',        color: '#c0392b', initials: 'SR' },
  { id: 1, name: 'Cel. Mostarda',     color: '#e67e22', initials: 'CM' },
  { id: 2, name: 'Dona Violeta',      color: '#8e44ad', initials: 'DV' },
  { id: 3, name: 'Sr. Marinho',       color: '#27ae60', initials: 'SM' },
  { id: 4, name: 'Dona Branca',       color: '#bdc3c7', initials: 'DB' },
  { id: 5, name: 'Prof. Black',       color: '#2980b9', initials: 'PB' },
];

export const WEAPONS: WeaponDef[] = [
  { id: 0, name: 'Castiçal',       icon: '🕯️' },
  { id: 1, name: 'Punhal',         icon: '🗡️' },
  { id: 2, name: 'Revólver',       icon: '🔫' },
  { id: 3, name: 'Corda',          icon: '🪢' },
  { id: 4, name: 'Cano de Chumbo', icon: '🔩' },
  { id: 5, name: 'Chave Inglesa',  icon: '🔧' },
];

export const ROOMS: RoomDef[] = [
  { id: 0, name: 'Cozinha' },
  { id: 1, name: 'Salão de Baile' },
  { id: 2, name: 'Jardim de Inverno' },
  { id: 3, name: 'Sala de Jantar' },
  { id: 4, name: 'Sala de Bilhar' },
  { id: 5, name: 'Biblioteca' },
  { id: 6, name: 'Sala de Estar' },
  { id: 7, name: 'Hall' },
  { id: 8, name: 'Escritório' },
];

export const suspectCard = (id: number) => id;
export const weaponCard  = (id: number) => 6 + id;
export const roomCard    = (id: number) => 12 + id;

export const isSuspectCard = (c: number) => c >= 0  && c < 6;
export const isWeaponCard  = (c: number) => c >= 6  && c < 12;
export const isRoomCard    = (c: number) => c >= 12 && c < 21;

export const cardCategory = (c: number): 'suspect' | 'weapon' | 'room' =>
  isSuspectCard(c) ? 'suspect' : isWeaponCard(c) ? 'weapon' : 'room';

export const cardName = (c: number): string => {
  if (isSuspectCard(c)) return SUSPECTS[c].name;
  if (isWeaponCard(c))  return WEAPONS[c - 6].name;
  return ROOMS[c - 12].name;
};

export const ALL_CARD_IDS: number[] = Array.from({ length: 21 }, (_, i) => i);

// Suggestion cards from a suggestion triple
export const suggestionCards = (s: number, w: number, r: number) => [
  suspectCard(s), weaponCard(w), roomCard(r),
];
