import { cardName, SUSPECTS, WEAPONS, ROOMS } from '../game/cards'
import type { Suggestion } from '../game/types'

interface Props {
  opts:       number[]
  suggestion: Suggestion
  onShow:     (cardId: number) => void
}

export default function DisproveModal({ opts, suggestion, onShow }: Props) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>⚠️ Desmentir Suposição</h2>
        <p className="modal-sub">
          Você foi chamado a responder a suposição:<br />
          <strong>{SUSPECTS[suggestion.suspectId].name}</strong> com{' '}
          <strong>{WEAPONS[suggestion.weaponId].name}</strong> no{' '}
          <strong>{ROOMS[suggestion.roomId].name}</strong>
        </p>
        <p>Escolha <strong>uma carta</strong> para mostrar em segredo:</p>

        <div className="disprove-opts">
          {opts.map(cid => (
            <button key={cid} className="btn-disprove" onClick={() => onShow(cid)}>
              <span className="card-badge">{cardName(cid)}</span>
              <span className="card-hint">
                {cid < 6 ? '🕵 Suspeito' : cid < 12 ? '🔪 Arma' : '🏠 Cômodo'}
              </span>
            </button>
          ))}
        </div>

        <p className="modal-note">
          Os outros jogadores verão apenas que você desmentiu, mas não qual carta mostrou.
        </p>
      </div>
    </div>
  )
}
