import { useState, useEffect, Fragment } from 'react'
import { SUSPECTS, cardName } from '../game/cards'
import type { GameState } from '../game/types'

export const MARKS = ['✗', '?', '✓', ''] as const
export type Mark = typeof MARKS[number]
export type MarksState = Record<number, Record<number, Mark>>

interface Props {
  game:      GameState
  marks:     MarksState
  setMarks:  React.Dispatch<React.SetStateAction<MarksState>>
}

interface PendingProp { cardId: number; playerIdx: number }

export default function Notebook({ game, marks, setMarks }: Props) {
  const humanPlayer = game.players.find(p => !p.isBot)
  const n = game.players.length
  const [pendingProp, setPendingProp] = useState<PendingProp | null>(null)

  // Auto-fill from game state
  useEffect(() => {
    if (!humanPlayer) return
    setMarks(prev => {
      const next = { ...prev }

      // Human's own hand → ✓ for self, ✗ for others on same card
      for (const c of humanPlayer.hand) {
        next[c] = { ...next[c], [humanPlayer.idx]: '✓' }
        for (const p of game.players) {
          if (p.idx !== humanPlayer.idx && next[c]?.[p.idx] !== '✓')
            next[c] = { ...next[c], [p.idx]: '✗' }
        }
      }
      // Human's column: ✗ for every card NOT in their hand
      for (let c = 0; c < 21; c++) {
        if (!humanPlayer.hand.includes(c) && next[c]?.[humanPlayer.idx] !== '✓')
          next[c] = { ...next[c], [humanPlayer.idx]: '✗' }
      }

      // Card shown TO the human → ✓ for the shower, ✗ for everyone else
      const sug = game.currentSuggestion
      if (
        sug &&
        sug.cardShown !== null &&
        sug.suggesterIdx === humanPlayer.idx &&
        sug.disproverIdx !== null
      ) {
        const c = sug.cardShown
        next[c] = { ...next[c], [sug.disproverIdx]: '✓' }
        for (const p of game.players) {
          if (p.idx !== sug.disproverIdx && next[c]?.[p.idx] !== '✓')
            next[c] = { ...next[c], [p.idx]: '✗' }
        }
      }

      return next
    })
  }, [
    game.currentSuggestion?.cardShown,
    humanPlayer?.hand.join(','),
  ])

  function cycleMark(cardId: number, playerIdx: number) {
    setMarks(prev => {
      const cur     = prev[cardId]?.[playerIdx] ?? ''
      const nextIdx = MARKS.indexOf(cur as Mark)
      const next    = MARKS[(nextIdx + 1) % MARKS.length]
      const row     = { ...prev[cardId], [playerIdx]: next }
      // Apply ✓ immediately but defer propagation — ask for confirmation
      if (next === '✓') {
        setPendingProp({ cardId, playerIdx })
      }
      return { ...prev, [cardId]: row }
    })
  }

  function confirmProp() {
    if (!pendingProp) return
    const { cardId, playerIdx } = pendingProp
    setMarks(prev => {
      const row = { ...prev[cardId] }
      for (let p = 0; p < n; p++) {
        if (p !== playerIdx && row[p] !== '✓') row[p] = '✗'
      }
      return { ...prev, [cardId]: row }
    })
    setPendingProp(null)
  }

  function cancelProp() {
    setPendingProp(null)
  }

  const categories = [
    { label: '🕵 Suspeitos', ids: [0,1,2,3,4,5] },
    { label: '🔪 Armas',    ids: [6,7,8,9,10,11] },
    { label: '🏠 Cômodos',  ids: [12,13,14,15,16,17,18,19,20] },
  ]

  return (
    <div className="notebook">
      <h3>📓 Caderno de Anotações</h3>
      <div className="notebook-scroll">
        <table className="notebook-table">
          <thead>
            <tr>
              <th className="card-col">Carta</th>
              {game.players.map(p => (
                <th
                  key={p.idx}
                  className="player-col"
                  style={{ color: SUSPECTS[p.suspectId].color }}
                >
                  {p.name.split(' ')[0]}
                  {p.isBot ? ' 🤖' : ' ★'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <Fragment key={cat.label}>
                <tr className="category-row">
                  <td colSpan={n + 1}>{cat.label}</td>
                </tr>
                {cat.ids.map(cid => {
                  const allCross = game.players.every(
                    p => (marks[cid]?.[p.idx] ?? '') === '✗'
                  )
                  return (
                  <tr key={cid} className={`card-row${allCross ? ' row-envelope' : ''}`}>
                    <td className="card-name">{cardName(cid)}</td>
                    {game.players.map(p => {
                      const mark  = marks[cid]?.[p.idx] ?? ''
                      const isOwn = !p.isBot &&
                        humanPlayer?.hand.includes(cid) &&
                        p.idx === humanPlayer.idx
                      const markClass =
                        mark === '✓' ? 'mark-check'   :
                        mark === '✗' ? 'mark-cross'   :
                        mark === '?' ? 'mark-unknown' : 'mark-empty'
                      return (
                        <td
                          key={p.idx}
                          className={`mark-cell ${isOwn ? 'own-card' : ''} ${markClass}`}
                          onClick={() => cycleMark(cid, p.idx)}
                          title="Clique para ciclar a marca"
                        >
                          {mark || '·'}
                        </td>
                      )
                    })}
                  </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {pendingProp && (
        <div className="nb-confirm-banner">
          <span className="nb-confirm-text">
            Marcar <strong>✗</strong> nos outros jogadores para{' '}
            <em>{cardName(pendingProp.cardId)}</em>?
          </span>
          <div className="nb-confirm-btns">
            <button className="nb-confirm-yes" onClick={confirmProp}>Sim</button>
            <button className="nb-confirm-no"  onClick={cancelProp}>Não</button>
          </div>
        </div>
      )}
      <p className="notebook-hint">Clique para ciclar: ✗ → ? → ✓ → ·</p>
    </div>
  )
}
