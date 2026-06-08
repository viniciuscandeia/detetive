import { useState } from 'react'
import { SUSPECTS, WEAPONS, ROOMS } from '../game/cards'

interface Props {
  onConfirm: (suspectId: number, weaponId: number, roomId: number) => void
  onCancel:  () => void
}

export default function AccusationModal({ onConfirm, onCancel }: Props) {
  const [suspect, setSuspect] = useState(0)
  const [weapon,  setWeapon]  = useState(0)
  const [room,    setRoom]    = useState(0)
  const [confirm, setConfirm] = useState(false)

  if (confirm) {
    return (
      <div className="modal-backdrop">
        <div className="modal modal-danger">
          <h2>⚖️ Confirmar Acusação</h2>
          <p className="modal-warn">
            ⚠️ <strong>Atenção!</strong> Você só pode fazer <u>uma acusação</u> por partida.<br />
            Se errar, você será eliminado (mas continua desmentindo suposições).
          </p>
          <div className="accusation-summary">
            <div><span>Suspeito:</span> <strong style={{ color: SUSPECTS[suspect].color }}>{SUSPECTS[suspect].name}</strong></div>
            <div><span>Arma:</span>     <strong>{WEAPONS[weapon].icon} {WEAPONS[weapon].name}</strong></div>
            <div><span>Local:</span>    <strong>{ROOMS[room].name}</strong></div>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setConfirm(false)}>Voltar</button>
            <button className="btn-danger"    onClick={() => onConfirm(suspect, weapon, room)}>
              Confirmar — Abrir Envelope!
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>⚖️ Fazer Acusação</h2>
        <p className="modal-sub">Qual é a solução do crime?</p>

        <label>Suspeito</label>
        <div className="option-grid">
          {SUSPECTS.map(s => (
            <button key={s.id} className={`opt-btn ${suspect === s.id ? 'active' : ''}`}
              style={{ '--opt-color': s.color } as React.CSSProperties}
              onClick={() => setSuspect(s.id)}>
              <div className="opt-token" style={{ background: s.color }}>{s.initials}</div>
              {s.name}
            </button>
          ))}
        </div>

        <label>Arma</label>
        <div className="option-grid">
          {WEAPONS.map(w => (
            <button key={w.id} className={`opt-btn ${weapon === w.id ? 'active' : ''}`}
              onClick={() => setWeapon(w.id)}>
              {w.icon} {w.name}
            </button>
          ))}
        </div>

        <label>Local do Crime</label>
        <div className="option-grid">
          {ROOMS.map(r => (
            <button key={r.id} className={`opt-btn ${room === r.id ? 'active' : ''}`}
              onClick={() => setRoom(r.id)}>
              {r.name}
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="btn-danger"    onClick={() => setConfirm(true)}>
            Acusar →
          </button>
        </div>
      </div>
    </div>
  )
}
