import React, { useMemo } from 'react'
import { BOARD, BOARD_ROWS, BOARD_COLS, ROOM_DEFS, doorRoomId, cellKey } from '../game/board'
import { SUSPECTS, WEAPONS, ROOMS } from '../game/cards'
import type { GameAPI } from '../state/useGame'
import type { Player } from '../game/types'

const CS = 26 // cell size px

const ROOM_BG = [
  '#2e1405',  // Cozinha          — dark burnt sienna
  '#051526',  // Salão de Baile   — deep navy
  '#082e18',  // Jardim de Inverno— deep forest
  '#2e0808',  // Sala de Jantar   — deep crimson
  '#100830',  // Sala de Bilhar   — midnight indigo
  '#1c1005',  // Biblioteca       — dark leather
  '#1c1200',  // Sala de Estar    — dark amber
  '#031420',  // Hall             — dark teal
  '#101800',  // Escritório       — dark olive
]

interface Props { api: GameAPI }

export default function Board({ api }: Props) {
  const { game, moveToRoom, moveToCorridor, isHumanTurn } = api
  const isMoving = game.phase === 'MOVE' && isHumanTurn
  const reach    = game.reachable

  // Token positions for overlay — keyed by p.idx so tokens persist across moves
  const tokenPositions = useMemo(() => {
    // Group non-eliminated players by position key
    const groups = new Map<string, Player[]>()
    for (const p of game.players) {
      if (p.eliminated) continue
      const posKey = p.position.type === 'corridor'
        ? cellKey(p.position.row, p.position.col)
        : `room-${p.position.roomId}`
      if (!groups.has(posKey)) groups.set(posKey, [])
      groups.get(posKey)!.push(p)
    }
    // Sort each group by idx for stable per-cell ordering
    groups.forEach(g => g.sort((a, b) => a.idx - b.idx))

    const result = new Map<number, { left: number; top: number }>()
    groups.forEach(group => {
      const first = group[0]
      let baseRow: number, baseCol: number
      if (first.position.type === 'corridor') {
        baseRow = first.position.row
        baseCol = first.position.col
      } else {
        const rd = ROOM_DEFS[first.position.roomId]
        baseRow = Math.floor((rd.r1 + rd.r2) / 2)
        baseCol = Math.floor((rd.c1 + rd.c2) / 2)
      }
      group.forEach((p, i) => {
        result.set(p.idx, {
          left: baseCol * CS + 2 + (i % 3) * 7,
          top:  baseRow * CS + 3 + Math.floor(i / 3) * 6,
        })
      })
    })
    return result
  }, [game.players])

  // Map room ID → weapon IDs inside it
  const roomWeapons = useMemo(() => {
    const m = new Map<number, number[]>()
    for (const [ws, rid] of Object.entries(game.weaponPositions)) {
      if (rid === null) continue
      if (!m.has(rid)) m.set(rid, [])
      m.get(rid)!.push(Number(ws))
    }
    return m
  }, [game.weaponPositions])

  // Room label centres
  const labelCenters = useMemo(() => {
    const m = new Map<string, number>()
    for (const rd of ROOM_DEFS) {
      const r = Math.floor((rd.r1 + rd.r2) / 2)
      const c = Math.floor((rd.c1 + rd.c2) / 2)
      m.set(cellKey(r, c), rd.id)
    }
    return m
  }, [])

  const cells = useMemo(() => {
    const out: JSX.Element[] = []
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const tile    = BOARD[r][c]
        const k       = cellKey(r, c)
        const labelId = labelCenters.get(k)
        const doorId  = doorRoomId(r, c)
        const isRCor  = isMoving && !!reach?.corridorCells.has(k)
        const isRRoom = isMoving && doorId !== null && !!reach?.rooms.has(doorId)
        const isHigh  = isRCor || isRRoom

        let bg = '#0a0a0a'
        if (tile.kind === 'corridor') bg = '#1e1e1e'
        else if (tile.kind === 'room') bg = ROOM_BG[tile.roomId!]
        else if (tile.kind === 'center') bg = '#111133'
        if (isHigh) bg = '#5a4a10'

        const style: React.CSSProperties = {
          gridRow: r + 1, gridColumn: c + 1,
          background: bg,
          border:    isHigh ? '1px solid #c9a84c' : '1px solid #111',
          cursor:    isRCor ? 'pointer' : 'default',
          position:  'relative',
          overflow:  'visible',
        }

        out.push(
          <div key={k} style={style} className={isHigh ? 'board-cell--reachable' : undefined} onClick={() => isRCor && moveToCorridor(r, c)}>
            {labelId !== undefined && tile.kind === 'room' && (
              <span className="room-label">
                {ROOMS[labelId].name.split(' ').join('\n')}
              </span>
            )}
            {tile.kind === 'center' && r === 11 && c === 11 && (
              <span style={{ position:'absolute', left:'50%', top:'50%',
                transform:'translate(-50%,-50%)', fontSize:14, color:'#c9a84c' }}>✉</span>
            )}
          </div>
        )
      }
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMoving, reach])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div className="board-grid">{cells}</div>

      {/* Token overlay — tokens persist across moves; CSS transition animates position */}
      {game.players.filter(p => !p.eliminated).map(p => {
        const pos = tokenPositions.get(p.idx)
        if (!pos) return null
        return (
          <div
            key={p.idx}
            className="token"
            style={{
              background: SUSPECTS[p.suspectId].color,
              border:     !p.isBot ? '2px solid #fff' : '1px solid rgba(255,255,255,0.4)',
              left:       pos.left,
              top:        pos.top,
              zIndex:     10 + p.idx,
              transition: 'top 0.45s cubic-bezier(0.34,1.1,0.64,1), left 0.45s cubic-bezier(0.34,1.1,0.64,1)',
            }}
            title={SUSPECTS[p.suspectId].name}
          >
            {SUSPECTS[p.suspectId].initials[0]}
          </div>
        )
      })}

      {/* Room weapon indicators (overlaid on room, not in cell grid) */}
      {ROOM_DEFS.map(rd => {
        const weps = roomWeapons.get(rd.id) ?? []
        if (weps.length === 0) return null
        return (
          <div key={rd.id} className="room-weapons" style={{
            top:    rd.r1 * CS + 2,
            left:   rd.c1 * CS + 2,
          }}>
            {weps.map(wid => (
              <span key={wid} className="wep-icon" title={WEAPONS[wid].name}>
                {WEAPONS[wid].icon}
              </span>
            ))}
          </div>
        )
      })}

      {/* Clickable room overlays (Bug #16 partial — larger hit target) */}
      {isMoving && ROOM_DEFS.map(rd => {
        if (!reach?.rooms.has(rd.id)) return null
        return (
          <div key={rd.id} className="room-overlay" style={{
            top:    rd.r1 * CS,
            left:   rd.c1 * CS,
            width:  (rd.c2 - rd.c1 + 1) * CS,
            height: (rd.r2 - rd.r1 + 1) * CS,
          }} onClick={() => moveToRoom(rd.id)}>
            <span className="room-overlay-label">{ROOMS[rd.id].name}</span>
          </div>
        )
      })}
    </div>
  )
}
