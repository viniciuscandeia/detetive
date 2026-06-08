import { useState } from 'react'
import { SUSPECTS, WEAPONS, ROOMS } from '../game/cards'

interface Props {
  roomId:    number
  numPlayers: number
  onConfirm: (suspectId: number, weaponId: number) => void
  onCancel:  () => void
}

// Bug #1 fix: always show all 6 suspects (the murderer can be any of them,
// including suspects whose players are not in the game).
export default function SuggestionModal({ roomId, onConfirm, onCancel }: Props) {
  const [suspect, setSuspect] = useState(0)
  const [weapon,  setWeapon]  = useState(0)

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>🔍 Fazer Suposição</h2>
        <p className="modal-sub">Local: <strong>{ROOMS[roomId].name}</strong></p>

        <label>Suspeito</label>
        <div className="option-grid">
          {SUSPECTS.map(s => (
            <button
              key={s.id}
              className={`opt-btn ${suspect === s.id ? 'active' : ''}`}
              style={{ '--opt-color': s.color } as React.CSSProperties}
              onClick={() => setSuspect(s.id)}
            >
              <div className="opt-token" style={{ background: s.color }}>{s.initials}</div>
              {s.name}
            </button>
          ))}
        </div>

        <label>Arma</label>
        <div className="option-grid">
          {WEAPONS.map(w => (
            <button
              key={w.id}
              className={`opt-btn ${weapon === w.id ? 'active' : ''}`}
              onClick={() => setWeapon(w.id)}
            >
              {w.icon} {w.name}
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="btn-primary"   onClick={() => onConfirm(suspect, weapon)}>
            Confirmar Suposição
          </button>
        </div>
      </div>
    </div>
  )
}
