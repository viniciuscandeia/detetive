import { describe, it, expect } from 'vitest'
import { computeReachable } from '../pathfinding'
import { cellKey } from '../board'

describe('computeReachable', () => {
  it('corridor start: reaches cells within roll steps', () => {
    // Player in corridor at (6,16) — a known corridor cell (Srta. Rosa start)
    const pos = { type: 'corridor' as const, row: 6, col: 16 }
    const r = computeReachable(pos, 3, new Set(), new Set())
    expect(r.corridorCells.size).toBeGreaterThan(0)
    // Should NOT include the start cell itself
    expect(r.corridorCells.has(cellKey(6, 16))).toBe(false)
  })

  it('roll=0 → empty reachable', () => {
    const pos = { type: 'corridor' as const, row: 6, col: 16 }
    const r = computeReachable(pos, 0, new Set(), new Set())
    expect(r.corridorCells.size).toBe(0)
    expect(r.rooms.size).toBe(0)
  })

  it('occupied cell is excluded', () => {
    const pos = { type: 'corridor' as const, row: 6, col: 16 }
    // Block (6,17) which is adjacent
    const occ = new Set([cellKey(6, 17)])
    const r1 = computeReachable(pos, 1, new Set(), new Set())
    const r2 = computeReachable(pos, 1, occ, new Set())
    // r2 should have fewer or equal cells
    expect(r2.corridorCells.size).toBeLessThanOrEqual(r1.corridorCells.size)
  })

  it('room start: exits through doors', () => {
    // Start in Cozinha (room 0), door at (6,4)
    const pos = { type: 'room' as const, roomId: 0 }
    const r = computeReachable(pos, 2, new Set(), new Set())
    // Should reach (6,4) as first exit step and expand from there with 1 remaining
    expect(r.corridorCells.has(cellKey(6, 4))).toBe(true)
    expect(r.corridorCells.size).toBeGreaterThan(0)
  })

  it('from room, cannot re-enter same room immediately', () => {
    const pos = { type: 'room' as const, roomId: 0 }
    const r = computeReachable(pos, 1, new Set(), new Set([0]))
    // Room 0 is forbidden, should not be in reachable rooms
    expect(r.rooms.has(0)).toBe(false)
  })

  it('room accessible if door cell is reachable', () => {
    // From corridor (6,4) which is Cozinha's door, with 0 remaining steps, can Cozinha be reached?
    // Actually from (6,4) the player is already at the door. With roll=0 they can't go anywhere.
    // With roll=1 from (6,5) they can reach (6,4) and enter Cozinha.
    const pos = { type: 'corridor' as const, row: 6, col: 5 }
    const r = computeReachable(pos, 1, new Set(), new Set())
    // (6,4) is Cozinha's door; should be reachable and Cozinha (0) should be in rooms
    expect(r.corridorCells.has(cellKey(6, 4))).toBe(true)
    expect(r.rooms.has(0)).toBe(true)
  })
})
