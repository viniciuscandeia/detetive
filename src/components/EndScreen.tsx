import { SUSPECTS, WEAPONS, ROOMS } from '../game/cards'
import type { GameState } from '../game/types'

interface Props { game: GameState; onRestart: () => void }

export default function EndScreen({ game, onRestart }: Props) {
  const winner = game.winner !== null && game.winner >= 0
    ? game.players[game.winner]
    : null
  const { envelope } = game

  // Find human player's wrong accusation entry (if any) for #18
  const humanPlayer  = game.players.find(p => !p.isBot)
  const wrongAccusal = game.log.find(
    e => e.type === 'accusation' && e.playerIdx === humanPlayer?.idx && !e.correct
  ) as (typeof game.log[number] & { type: 'accusation' }) | undefined
  const wf = wrongAccusal?.type === 'accusation' ? wrongAccusal.wrongFields : undefined

  return (
    <div className="end-screen">
      <div className="end-card">
        {winner ? (
          <>
            <div className="end-icon">🏆</div>
            <h1>Caso Resolvido!</h1>
            <p className="end-winner">
              <span className="winner-dot" style={{ background: SUSPECTS[winner.suspectId].color }} />
              <strong>{winner.name}</strong> desvendou o mistério!
            </p>
          </>
        ) : (
          <>
            <div className="end-icon">💀</div>
            <h1>O Crime Permanece sem Solução</h1>
            <p>Todos os detetives foram eliminados.</p>
          </>
        )}

        {/* #18: show which fields the human got wrong */}
        {wf && (
          <div className="wrong-fields">
            <p className="wrong-fields-title">❌ Sua acusação errou em:</p>
            <div className="wrong-fields-list">
              {wf.suspect && <span className="wf-badge">🕵 Suspeito</span>}
              {wf.weapon  && <span className="wf-badge">🔪 Arma</span>}
              {wf.room    && <span className="wf-badge">🏠 Cômodo</span>}
            </div>
          </div>
        )}

        <div className="envelope-reveal">
          <h2>📩 Conteúdo do Envelope</h2>
          <div className="envelope-content">
            <div className="env-item">
              <span className="env-label">Assassino</span>
              <span className="env-value" style={{ color: SUSPECTS[envelope.suspectId].color }}>
                {SUSPECTS[envelope.suspectId].name}
              </span>
            </div>
            <div className="env-item">
              <span className="env-label">Arma</span>
              <span className="env-value">
                {WEAPONS[envelope.weaponId].icon} {WEAPONS[envelope.weaponId].name}
              </span>
            </div>
            <div className="env-item">
              <span className="env-label">Local</span>
              <span className="env-value">{ROOMS[envelope.roomId].name}</span>
            </div>
          </div>
        </div>

        <button className="btn-start" onClick={onRestart}>🔄 Nova Investigação</button>
      </div>
    </div>
  )
}
