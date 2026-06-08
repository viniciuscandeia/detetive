import { BotKnowledge } from './knowledge';

/**
 * Choose which card the bot will show to the suggester.
 *
 * Priority:
 *   1. Cards NOT yet shown to this suggester (avoid repeating)
 *   2. Among candidates: room → suspect → weapon
 *   3. If all already shown, fall back to same type priority
 */
export function botChooseDisprove(
  matchingCards: number[],
  kb:            BotKnowledge,
  suggesterIdx:  number,
): number {
  if (matchingCards.length === 1) return matchingCards[0];

  const shownBefore = kb.shownTo[suggesterIdx] ?? [];

  // Prefer cards not yet shown to this suggester
  const notYetShown = matchingCards.filter(c => !shownBefore.includes(c));
  const candidates  = notYetShown.length > 0 ? notYetShown : matchingCards;

  // Among candidates: room → suspect → weapon
  const roomCard    = candidates.find(c => c >= 12);
  if (roomCard    !== undefined) return roomCard;

  const suspectCard = candidates.find(c => c < 6);
  if (suspectCard !== undefined) return suspectCard;

  return candidates[0];
}
