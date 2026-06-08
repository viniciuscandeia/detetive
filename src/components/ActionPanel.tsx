import { useState } from 'react'
import { SUSPECTS, ROOMS } from '../game/cards'
import { secretPassageDest } from '../game/board'
import type { GameAPI } from '../state/useGame'

interface Props {
  api:       GameAPI
  onSuggest: () => void
  onAccuse:  () => void
}

export default function ActionPanel({ api, onSuggest, onAccuse }: Props) {
  const [playersOpen, setPlayersOpen]   = useState(false)
  const { game, isHumanTurn, canSuggestNow, canUsePassage, botThinking } = api
  const cp    = game.players[game.currentPlayerIdx]
  const phase = game.phase
  const inRoom = cp?.position.type === 'room'
  const roomId = inRoom ? (cp.position as { type: 'room'; roomId: number }).roomId : -1
  const secretDest = inRoom ? secretPassageDest(roomId) : undefined
  const secretName = secretDest !== undefined ? ROOMS[secretDest].name : null

  return (
    <div className="action-panel">
      {/* Current player */}
      <div className="current-player">
        <div className="player-dot" style={{ background: SUSPECTS[cp?.suspectId ?? 0].color }} />
        <div>
          <div className="player-name">{cp?.name ?? '—'}</div>
          <div className="player-pos">
            {inRoom ? `📍 ${ROOMS[roomId].name}` : '📍 Corredor'}
            {cp?.isBot && ' 🤖'}
          </div>
        </div>
        {game.diceValues && (
          <div className="dice-row">
            <span className="dice-pip">🎲 {game.diceValues[0]}</span>
            <span className="dice-plus">+</span>
            <span className="dice-pip">🎲 {game.diceValues[1]}</span>
            <span className="dice-sum">= {game.diceRoll}</span>
          </div>
        )}
      </div>

      {/* Transport toast */}
      {game.lastTransportedTo !== null && isHumanTurn && (
        <div className="transport-toast">
          ⚡ Você foi trazido para <strong>{ROOMS[game.lastTransportedTo].name}</strong>!
          {!game.hasSuggestedThisTurn && game.arrivedByTransport &&
            ' Você pode sugerir aqui sem rolar.'}
        </div>
      )}

      {/* Phase label */}
      <div className="phase-label" key={`${phase}-${game.currentPlayerIdx}`}>
        {phase === 'ROLL' && !botThinking && (isHumanTurn
          ? (game.arrivedByTransport ? '⚡ Você foi transportado. Escolha sua ação.' : 'Sua vez de rolar')
          : `${cp?.name} está pensando…`)}
        {phase === 'ROLL' && botThinking && `${cp?.name} está pensando… 🤔`}
        {phase === 'MOVE' && (isHumanTurn ? 'Escolha o destino no tabuleiro' : 'Movendo…')}
        {phase === 'ACTION' && (isHumanTurn ? 'Escolha uma ação' : (botThinking ? `${cp?.name} agindo… 🤔` : 'Agindo…'))}
        {phase === 'DISPROVE' && (() => {
          const sug = game.currentSuggestion
          if (!sug || !sug.disproveOrder) return 'Desmentindo…'
          const disp = sug.disproveOrder[sug.disproveStep]
          return `${game.players[disp]?.name ?? '?'} verifica cartas… ${botThinking ? '🤔' : ''}`
        })()}
        {phase === 'AWAIT_HUMAN_DISPROVE' && '⚠️ Você foi chamado a desmentir!'}
      </div>

      {/* Action buttons — human turn only */}
      {isHumanTurn && (
        <div className="action-buttons">
          {phase === 'ROLL' && (
            <>
              {game.arrivedByTransport && inRoom ? (
                <>
                  <button className="btn-primary" onClick={api.useTransportSuggest}>
                    🔍 Sugerir aqui (sem rolar)
                  </button>
                  <button className="btn-secondary" onClick={api.roll}>
                    🎲 Ignorar e Rolar
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-primary" onClick={api.roll}>🎲 Rolar Dado</button>
                  {canUsePassage && secretName && (
                    <button className="btn-secondary" onClick={api.useSecret}>
                      🚪 Passagem Secreta → {secretName}
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {phase === 'ACTION' && (
            <>
              {canSuggestNow && (
                <button className="btn-primary" onClick={onSuggest}>
                  🔍 Fazer Suposição
                </button>
              )}
              <button className="btn-danger" onClick={onAccuse}>
                ⚖️ Fazer Acusação
              </button>
              <button className="btn-secondary" onClick={api.endTurn}>
                ⏩ Encerrar Turno
              </button>
            </>
          )}
        </div>
      )}

      {/* Players list — collapsible */}
      <div className="players-list">
        {/* Header: always visible, shows current player */}
        <button
          className="players-list-header"
          onClick={() => setPlayersOpen(v => !v)}
          title={playersOpen ? 'Recolher lista' : 'Expandir lista de jogadores'}
        >
          <div className="player-dot sm" style={{ background: SUSPECTS[cp?.suspectId ?? 0].color }} />
          <span className="players-header-name">{cp?.name ?? '—'}</span>
          <span className="players-chevron">{playersOpen ? '▲' : '▼'}</span>
        </button>

        {/* Expanded list */}
        {playersOpen && game.players.map(p => (
          <div
            key={p.idx}
            className={`player-row ${p.idx === game.currentPlayerIdx ? 'active' : ''} ${p.eliminated ? 'eliminated' : ''}`}
          >
            <div className="player-dot sm" style={{ background: SUSPECTS[p.suspectId].color }} />
            <span>{p.name}</span>
            {p.isBot && <span className="bot-tag">Bot</span>}
            {p.eliminated && <span className="elim-tag">❌</span>}
            {!p.isBot && <span className="human-tag">★</span>}
          </div>
        ))}
      </div>

    </div>
  )
}
