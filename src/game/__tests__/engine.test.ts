import { describe, it, expect } from 'vitest'
import {
  initGame, doRoll, doMoveToRoom, doMakeSuggestion,
  advanceDisprove, doMakeAccusation, doEndTurn, matchingCards,
} from '../engine'
import { makeRng } from '../rng'
import { isSuspectCard, isWeaponCard, isRoomCard, suspectCard, weaponCard, roomCard } from '../cards'

const cfg3 = { numPlayers: 3, humanName: 'Test', humanSuspectId: 0, botDifficulty: 'NORMAL' as const }

/** Force current player into a specific room (bypasses movement, useful for unit tests). */
function putInRoom(g: ReturnType<typeof initGame>, roomId: number) {
  return {
    ...g,
    phase: 'ACTION' as const,
    players: g.players.map((p, i) =>
      i === g.currentPlayerIdx ? { ...p, position: { type: 'room' as const, roomId } } : p
    ),
  }
}

describe('initGame — dealing', () => {
  it('envelope has exactly 1 suspect, 1 weapon, 1 room', () => {
    const g = initGame(cfg3, makeRng(42))
    expect(isSuspectCard(g.envelope.suspectId)).toBe(true)
    expect(isWeaponCard(weaponCard(g.envelope.weaponId))).toBe(true)
    expect(isRoomCard(roomCard(g.envelope.roomId))).toBe(true)
  })

  it('no card appears in both envelope and any hand', () => {
    const g = initGame(cfg3, makeRng(7))
    const envCards = new Set([
      suspectCard(g.envelope.suspectId),
      weaponCard(g.envelope.weaponId),
      roomCard(g.envelope.roomId),
    ])
    for (const p of g.players)
      for (const c of p.hand)
        expect(envCards.has(c), `card ${c} in both envelope and hand`).toBe(false)
  })

  it('all 21 cards accounted for (envelope + all hands)', () => {
    const g   = initGame(cfg3, makeRng(99))
    const all = new Set<number>()
    all.add(suspectCard(g.envelope.suspectId))
    all.add(weaponCard(g.envelope.weaponId))
    all.add(roomCard(g.envelope.roomId))
    for (const p of g.players) for (const c of p.hand) all.add(c)
    expect(all.size).toBe(21)
  })

  it('Srta. Rosa (suspectId 0) is currentPlayerIdx 0', () => {
    const g = initGame(cfg3, makeRng(1))
    expect(g.players[0].suspectId).toBe(0)
    expect(g.currentPlayerIdx).toBe(0)
  })

  it('starts in ROLL phase', () => {
    expect(initGame(cfg3, makeRng(1)).phase).toBe('ROLL')
  })
})

describe('doRoll', () => {
  it('produces diceRoll in 2-12 (2d6)', () => {
    const g0  = initGame(cfg3, makeRng(1))
    const rng = makeRng(55)
    const g1  = doRoll(g0, rng)
    expect(g1.diceRoll).toBeGreaterThanOrEqual(2)
    expect(g1.diceRoll).toBeLessThanOrEqual(12)
    expect(g1.diceValues).toHaveLength(2)
    expect(g1.diceValues![0]).toBeGreaterThanOrEqual(1)
    expect(g1.diceValues![0]).toBeLessThanOrEqual(6)
    expect(g1.diceValues![1]).toBeGreaterThanOrEqual(1)
    expect(g1.diceValues![1]).toBeLessThanOrEqual(6)
    expect(['MOVE', 'ACTION']).toContain(g1.phase)
  })
})

describe('doMakeSuggestion', () => {
  it('moves to DISPROVE and sets currentSuggestion', () => {
    let g = initGame(cfg3, makeRng(3))
    g = putInRoom(g, 0) // Cozinha
    expect(g.players[g.currentPlayerIdx].position.type).toBe('room')
    g = doMakeSuggestion(g, 1, 2)
    expect(g.phase).toBe('DISPROVE')
    expect(g.currentSuggestion).not.toBeNull()
    expect(g.currentSuggestion!.roomId).toBe(0)
  })

  it('moves the named suspect to the suggestion room', () => {
    let g = initGame(cfg3, makeRng(3))
    g = putInRoom(g, 1) // Salão
    g = doMakeSuggestion(g, 2, 0) // accuse suspect 2 (Dona Violeta)
    const viola = g.players.find(p => p.suspectId === 2)!
    expect(viola.position).toEqual({ type: 'room', roomId: 1 })
  })

  it('moves the weapon to the suggestion room', () => {
    let g = initGame(cfg3, makeRng(3))
    g = putInRoom(g, 1)
    g = doMakeSuggestion(g, 1, 3) // weapon 3 (Corda)
    expect(g.weaponPositions[3]).toBe(1)
  })
})

describe('advanceDisprove', () => {
  it('showing a card resolves disprove and returns to ACTION', () => {
    let g = initGame(cfg3, makeRng(3))
    g = putInRoom(g, 0)
    g = doMakeSuggestion(g, 1, 2)
    expect(g.phase).toBe('DISPROVE')
    g = advanceDisprove(g, suspectCard(1))
    expect(g.phase).toBe('ACTION')
    expect(g.currentSuggestion!.disproverIdx).not.toBeNull()
  })

  it('null shownCard advances disprove step', () => {
    let g = initGame(cfg3, makeRng(3))
    g = putInRoom(g, 0)
    g = doMakeSuggestion(g, 1, 2)
    const stepBefore = g.currentSuggestion!.disproveStep
    g = advanceDisprove(g, null)
    expect(
      g.currentSuggestion!.disproveStep > stepBefore || g.phase === 'ACTION'
    ).toBe(true)
  })

  it('after all players pass, moves to ACTION with disproverIdx null', () => {
    let g = initGame(cfg3, makeRng(3))
    g = putInRoom(g, 0)
    g = doMakeSuggestion(g, 1, 2)
    // Pass all disprove steps
    for (let i = 0; i < 10; i++) {
      if (g.phase !== 'DISPROVE') break
      g = advanceDisprove(g, null)
    }
    expect(g.phase).toBe('ACTION')
    expect(g.currentSuggestion!.disproverIdx).toBeNull()
  })
})

describe('doMakeAccusation', () => {
  it('correct accusation wins the game', () => {
    let g = initGame(cfg3, makeRng(5))
    g = putInRoom(g, 0)
    const { suspectId, weaponId, roomId } = g.envelope
    g = doMakeAccusation(g, suspectId, weaponId, roomId)
    expect(g.phase).toBe('GAME_OVER')
    expect(g.winner).toBe(0)
  })

  it('wrong accusation eliminates the player', () => {
    let g = initGame(cfg3, makeRng(5))
    g = putInRoom(g, 0)
    // Wrong: use envelope+1 mod for one card
    const wrongSuspect = (g.envelope.suspectId + 1) % 3
    g = doMakeAccusation(g, wrongSuspect, g.envelope.weaponId, g.envelope.roomId)
    // Either the game ended (all eliminated) or player 0 is eliminated
    const p0Elim = g.players[0].eliminated
    expect(p0Elim || g.phase === 'GAME_OVER').toBe(true)
  })
})

describe('matchingCards', () => {
  it('returns hand cards that match suggestion', () => {
    const g   = initGame(cfg3, makeRng(77))
    const p0  = g.players[0]
    if (p0.hand.length === 0) return
    const cardInHand = p0.hand[0]
    let suspId = 0, wepId = 0, romId = 0
    if (cardInHand < 6)       suspId = cardInHand
    else if (cardInHand < 12) wepId  = cardInHand - 6
    else                       romId  = cardInHand - 12

    const g2 = {
      ...g,
      currentSuggestion: {
        roomId: romId, suspectId: suspId, weaponId: wepId,
        suggesterIdx: 1, disproveOrder: [0], disproveStep: 0,
        disproverIdx: null, cardShown: null,
      },
    }
    expect(matchingCards(g2, 0)).toContain(cardInHand)
  })
})

describe('doEndTurn', () => {
  it('moves to the next player and resets phase to ROLL', () => {
    let g = initGame(cfg3, makeRng(1))
    g = putInRoom(g, 0)
    const after = doEndTurn(g)
    expect(after.currentPlayerIdx).toBe(1)
    expect(after.phase).toBe('ROLL')
    expect(after.hasSuggestedThisTurn).toBe(false)
  })
})
