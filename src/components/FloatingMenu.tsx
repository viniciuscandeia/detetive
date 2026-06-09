import { useState } from 'react'
import { SUSPECTS, WEAPONS, ROOMS } from '../game/cards'
import type { GameAPI } from '../state/useGame'

interface Props {
  api:    GameAPI
  onExit: () => void
}

export default function FloatingMenu({ api, onExit }: Props) {
  const [open, setOpen]             = useState(false)
  const [exitConfirm, setExitConfirm] = useState(false)
  const { game } = api

  function close() { setOpen(false); setExitConfirm(false) }

  return (
    <>
      {/* Backdrop — closes menu on outside click */}
      {open && <div className="fm-backdrop" onClick={close} />}

      <div className="fm-root">
        {/* Floating panel */}
        {open && (
          <div className="fm-panel">
            {/* Step mode row */}
            <div className="fm-row">
              <span className="fm-label">🎮 Controle de turno</span>
              <button
                className={`step-toggle ${api.stepMode ? 'step-on' : 'step-off'}`}
                onClick={api.toggleStepMode}
                title={api.stepMode ? 'Desativar' : 'Ativar'}
              >
                {api.stepMode ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Advance turn button (step mode) */}
            {api.waitingForStep && (
              <button className="btn-advance fm-advance" onClick={() => { api.advanceStep(); close() }}>
                ▶ Avançar Turno
              </button>
            )}

            <div className="fm-divider" />

            {/* Debug */}
            <button className="fm-item btn-debug" onClick={api.toggleDebug}>
              {game.debugReveal ? '🙈 Ocultar Envelope' : '👁 Ver Envelope'}
            </button>
            {game.debugReveal && (
              <div className="debug-reveal fm-debug-reveal">
                <strong>Envelope:</strong><br />
                🕵 {SUSPECTS[game.envelope.suspectId].name}<br />
                🔪 {WEAPONS[game.envelope.weaponId].name}<br />
                🏠 {ROOMS[game.envelope.roomId].name}
              </div>
            )}

            <div className="fm-divider" />

            {/* Exit */}
            {!exitConfirm ? (
              <button className="fm-item fm-exit" onClick={() => setExitConfirm(true)}>
                ⬅ Sair para o Menu
              </button>
            ) : (
              <div className="fm-confirm">
                <span>Sair da partida?</span>
                <div className="fm-confirm-btns">
                  <button className="btn-secondary" onClick={() => setExitConfirm(false)}>Não</button>
                  <button className="btn-danger"    onClick={() => { close(); onExit() }}>Sair</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FAB trigger */}
        <button
          className={`fm-fab ${open ? 'fm-fab--open' : ''}`}
          onClick={() => { setOpen(v => !v); if (open) setExitConfirm(false) }}
          title="Opções"
        >
          {open ? '✕' : '⚙'}
        </button>
      </div>
    </>
  )
}
