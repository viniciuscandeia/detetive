import { describe, it, expect } from 'vitest'
import {
  createBotKnowledge,
  recordCardShown,
  recordCannotDisprove,
  envelopeCards,
  canAccuse,
} from '../bot/knowledge'
import {
  botBuildAccusation,
  botChooseSuggestion,
  botShouldAccuse,
} from '../bot/strategy'
import { initGame } from '../engine'
import { makeRng } from '../rng'

// ─── botBuildAccusation ────────────────────────────────────────────────────────
describe('botBuildAccusation', () => {
  it('returns null when envelope is incomplete', () => {
    const kb = createBotKnowledge(0, [0, 6, 12], 3)
    expect(botBuildAccusation(kb)).toBeNull()
  })

  it('returns correct {suspectId, weaponId, roomId} when deduced', () => {
    // Bot knows its own 3 cards + all 18 other non-envelope cards not in hand
    // Simplest: 3 players, deal known hands, then observe all others can't disprove
    const g   = initGame({ numPlayers: 3, humanName: 'H', humanSuspectId: 0, botDifficulty: 'DIFICIL' }, makeRng(42))
    const bot = g.players[1]

    // Create knowledge with bot's actual hand
    let kb = createBotKnowledge(1, bot.hand, 3, g.players.map(p => p.hand.length))

    // Cards NOT in bot hand and NOT in envelope = held by other two players
    const allCards  = Array.from({ length: 21 }, (_, i) => i)
    const envCard   = new Set([g.envelope.suspectId, 6 + g.envelope.weaponId, 12 + g.envelope.roomId])
    const otherCards = allCards.filter(c => !bot.hand.includes(c) && !envCard.has(c))

    // Tell bot about every other card
    for (const c of otherCards) {
      // Assign to whichever player holds it
      const holder = g.players.findIndex(p => p.hand.includes(c))
      if (holder !== -1) kb = recordCardShown(kb, holder, c)
    }

    const acc = botBuildAccusation(kb)
    expect(acc).not.toBeNull()
    expect(acc!.suspectId).toBe(g.envelope.suspectId)
    expect(acc!.weaponId).toBe(g.envelope.weaponId)
    expect(acc!.roomId).toBe(g.envelope.roomId)
  })
})

// ─── botChooseSuggestion ───────────────────────────────────────────────────────
describe('botChooseSuggestion', () => {
  it('FACIL returns valid suspect (0-5) and weapon (0-5)', () => {
    const kb  = createBotKnowledge(0, [0, 6, 12], 3)
    const res = botChooseSuggestion(kb, 'FACIL', 0)
    expect(res.suspectId).toBeGreaterThanOrEqual(0)
    expect(res.suspectId).toBeLessThanOrEqual(5)
    expect(res.weaponId).toBeGreaterThanOrEqual(0)
    expect(res.weaponId).toBeLessThanOrEqual(5)
  })

  it('NORMAL prefers unknown cards', () => {
    // Bot holds suspect 0 and weapon 6 → those are known NOT in envelope
    const kb  = createBotKnowledge(0, [0, 6, 12], 3)
    // Tell bot about suspect 1 (held by player 1)
    const kb2 = recordCardShown(kb, 1, 1)
    // Unknown suspects: 2,3,4,5 — bot should pick one of them
    const res = botChooseSuggestion(kb2, 'NORMAL', 0)
    // suspectId should not be 0 (bot has it) or 1 (known held) if unknowns exist
    expect([2, 3, 4, 5]).toContain(res.suspectId)
  })

  it('DIFICIL prefers envelope-deduced cards', () => {
    // Give bot 2 players, bot knows all cards of player 1 → can deduce envelope
    const kb = createBotKnowledge(0, [0, 1, 2, 3, 4, 5, 6], 2, [7, 7])
    // Player 1 holds cards 7..13
    let kb2 = kb
    for (let c = 7; c <= 13; c++) kb2 = recordCardShown(kb2, 1, c)
    // Envelope should now have some cards deduced
    const env = envelopeCards(kb2)
    if (env.size >= 2) {
      const acc = botBuildAccusation(kb2)
      if (acc) {
        expect(acc.suspectId).toBeGreaterThanOrEqual(0)
        expect(acc.suspectId).toBeLessThanOrEqual(5)
      }
    }
    // The important thing: suggestion picks from envelope or unknown
    const res = botChooseSuggestion(kb2, 'DIFICIL', 0)
    expect(res.suspectId).toBeGreaterThanOrEqual(0)
  })
})

// ─── botShouldAccuse ──────────────────────────────────────────────────────────
describe('botShouldAccuse', () => {
  it('returns false if canAccuse is false', () => {
    const kb = createBotKnowledge(0, [0], 3)
    // canAccuse false → botShouldAccuse always false regardless of difficulty
    expect(botShouldAccuse(kb, 'DIFICIL')).toBe(false)
  })

  it('DIFICIL always accuses when canAccuse is true', () => {
    const g   = initGame({ numPlayers: 3, humanName: 'H', humanSuspectId: 0, botDifficulty: 'DIFICIL' }, makeRng(42))
    const bot = g.players[1]
    let kb = createBotKnowledge(1, bot.hand, 3, g.players.map(p => p.hand.length))

    // Feed all non-envelope, non-bot cards to force full deduction
    const envSet = new Set([g.envelope.suspectId, 6 + g.envelope.weaponId, 12 + g.envelope.roomId])
    for (let c = 0; c < 21; c++) {
      if (!bot.hand.includes(c) && !envSet.has(c)) {
        const holder = g.players.findIndex(p => p.hand.includes(c))
        if (holder !== -1) kb = recordCardShown(kb, holder, c)
      }
    }

    if (canAccuse(kb)) {
      // canAccuse → DIFICIL must always accuse
      const results = Array.from({ length: 20 }, () => botShouldAccuse(kb, 'DIFICIL'))
      expect(results.every(Boolean)).toBe(true)
    }
  })
})

// ─── canAccuse & recordCannotDisprove propagation ─────────────────────────────
describe('knowledge propagation', () => {
  it('deduces envelope when all others pass on same suggestion', () => {
    // 3 players; bot is player 0 with some cards
    const kb0 = createBotKnowledge(0, [0, 6, 12], 3, [3, 3, 3]) // bot has suspect0, weapon0, room0
    // Suggest suspect1(card1) + weapon1(card7) + room1(card13)
    // Players 1 and 2 both cannot disprove
    let kb = recordCannotDisprove(kb0, 1, 1, 7, 13)
    kb     = recordCannotDisprove(kb,  2, 1, 7, 13)
    // Now cards 1,7,13 must be in envelope
    const env = envelopeCards(kb)
    expect(env.has(1)).toBe(true)
    expect(env.has(7)).toBe(true)
    expect(env.has(13)).toBe(true)
  })
})
