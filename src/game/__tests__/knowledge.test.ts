import { describe, it, expect } from 'vitest'
import {
  createBotKnowledge, recordCannotDisprove, recordCardShown,
  recordSuggestionResult, envelopeCards, canAccuse,
} from '../bot/knowledge'
import { suspectCard, weaponCard, roomCard } from '../cards'

// Envelope = suspect 2, weapon 2, room 2  →  card IDs: 2, 8, 14
// Remaining 18 card IDs for 3 players (6 each):
const ENV_S = suspectCard(2) // 2
const ENV_W = weaponCard(2)  // 8
const ENV_R = roomCard(2)    // 14
// All 21 IDs except envelope:
const HAND0 = [0, 1, 3, 4, 5, 6]
const HAND1 = [7, 9, 10, 11, 12, 13]
const HAND2 = [15, 16, 17, 18, 19, 20]

function buildFullKb() {
  // Bot 0 knows its own hand; learns player 1 and 2 via shown cards
  let kb = createBotKnowledge(0, HAND0, 3)
  for (const c of HAND1) kb = recordCardShown(kb, 1, c)
  for (const c of HAND2) kb = recordCardShown(kb, 2, c)
  return kb
}

describe('createBotKnowledge', () => {
  it('marks own hand as HAS, others as NOT_HAS', () => {
    const kb = createBotKnowledge(0, [0, 6, 12], 3)
    expect(kb.matrix[0][0]).toBe('HAS')
    expect(kb.matrix[1][0]).toBe('NOT_HAS')
    expect(kb.matrix[2][0]).toBe('NOT_HAS')
    expect(kb.matrix[0][6]).toBe('HAS')
    expect(kb.matrix[0][12]).toBe('HAS')
    expect(kb.matrix[0][1]).toBe('NOT_HAS') // not in hand
  })
})

describe('recordCannotDisprove', () => {
  it('marks all three suggestion cards as NOT_HAS for that player', () => {
    const kb0 = createBotKnowledge(0, [0, 6, 12], 3)
    const kb1 = recordCannotDisprove(kb0, 1, suspectCard(1), weaponCard(1), roomCard(1))
    expect(kb1.matrix[1][suspectCard(1)]).toBe('NOT_HAS')
    expect(kb1.matrix[1][weaponCard(1)]).toBe('NOT_HAS')
    expect(kb1.matrix[1][roomCard(1)]).toBe('NOT_HAS')
  })
})

describe('recordCardShown', () => {
  it('marks the card as HAS for the shower and NOT_HAS for others', () => {
    const kb0 = createBotKnowledge(0, [0], 3)
    const kb1 = recordCardShown(kb0, 2, 7) // player 2 showed card 7
    expect(kb1.matrix[2][7]).toBe('HAS')
    expect(kb1.matrix[0][7]).toBe('NOT_HAS')
    expect(kb1.matrix[1][7]).toBe('NOT_HAS')
  })
})

describe('envelopeCards', () => {
  it('identifies cards held by no one as envelope candidates', () => {
    const kb  = buildFullKb()
    const env = envelopeCards(kb)
    expect(env.has(ENV_S)).toBe(true)
    expect(env.has(ENV_W)).toBe(true)
    expect(env.has(ENV_R)).toBe(true)
    // Known cards should NOT appear
    expect(env.has(0)).toBe(false)
    expect(env.has(7)).toBe(false)
  })
})

describe('canAccuse', () => {
  it('returns true when one suspect, one weapon, one room are deduced as envelope', () => {
    const kb = buildFullKb()
    expect(canAccuse(kb)).toBe(true)
  })

  it('returns false when not all envelope cards known', () => {
    const kb = createBotKnowledge(0, [0, 6, 12], 3)
    expect(canAccuse(kb)).toBe(false)
  })
})

describe('constraint propagation', () => {
  it('resolves single-card constraint to HAS', () => {
    // Bot 0 has suspect1 and weapon1 in hand.
    // Player 1 disproves suggestion {suspect1, weapon1, room1}.
    // Since player 1 cannot have suspect1 or weapon1 (bot holds them),
    // constraint reduces to: player 1 HAS room1.
    let kb = createBotKnowledge(0, [suspectCard(1), weaponCard(1)], 3)
    kb = recordSuggestionResult(kb, 1, suspectCard(1), weaponCard(1), roomCard(1))
    expect(kb.matrix[1][roomCard(1)]).toBe('HAS')
  })
})
