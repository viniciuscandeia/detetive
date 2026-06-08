import { useState } from 'react'
import { SUSPECTS } from '../game/cards'
import type { GameConfig } from '../game/engine'
import type { BotDifficulty } from '../game/types'

interface Props {
  onStart:  (cfg: GameConfig) => void
  hasSave:  boolean
  onResume: () => void
}

const DIFF_LABELS: Record<BotDifficulty, string> = {
  FACIL:   '😌 Fácil',
  NORMAL:  '🎯 Normal',
  DIFICIL: '🧠 Difícil',
}
const DIFF_DESC: Record<BotDifficulty, string> = {
  FACIL:   'Bots hesitam e escolhem aleatoriamente às vezes.',
  NORMAL:  'Bots deduzem bem mas podem hesitar.',
  DIFICIL: 'Bots acusam assim que deduzem. Sem hesitação.',
}

export default function SetupScreen({ onStart, hasSave, onResume }: Props) {
  const [numPlayers, setNumPlayers]   = useState(4)
  const [humanName, setHumanName]     = useState('Detetive')
  const [suspectId, setSuspectId]     = useState(0)
  const [difficulty, setDifficulty]   = useState<BotDifficulty>('NORMAL')
  const [showRules, setShowRules]     = useState(false)

  function start() {
    onStart({
      numPlayers,
      humanName:      humanName.trim() || 'Detetive',
      humanSuspectId: suspectId,
      botDifficulty:  difficulty,
    })
  }

  return (
    <div className="setup-screen">
      <h1>🔍 Detetive</h1>
      <p className="setup-subtitle">Jogo de dedução e mistério</p>

      {hasSave && (
        <button className="btn-resume" onClick={onResume}>
          ▶ Retomar Partida Salva
        </button>
      )}

      <div className="setup-card">
        <label>
          Seu nome
          <input
            type="text" value={humanName} maxLength={20}
            onChange={e => setHumanName(e.target.value)}
            placeholder="Detetive"
          />
        </label>

        <div className="form-group">
          <span className="form-label">Número de jogadores</span>
          <div className="num-players">
            {[3,4,5,6].map(n => (
              <button
                key={n}
                className={numPlayers === n ? 'active' : ''}
                onClick={() => setNumPlayers(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <label>Dificuldade dos Bots</label>
        <div className="diff-grid">
          {(['FACIL','NORMAL','DIFICIL'] as BotDifficulty[]).map(d => (
            <button
              key={d}
              className={`diff-btn ${difficulty === d ? 'active' : ''}`}
              onClick={() => setDifficulty(d)}
              title={DIFF_DESC[d]}
            >
              {DIFF_LABELS[d]}
            </button>
          ))}
        </div>
        <p className="diff-desc">{DIFF_DESC[difficulty]}</p>

        <label>Seu personagem</label>
        <div className="suspect-grid">
          {SUSPECTS.slice(0, numPlayers).map(s => (
            <div
              key={s.id}
              className={`suspect-card ${suspectId === s.id ? 'selected' : ''}`}
              style={{ '--suspect-color': s.color } as React.CSSProperties}
              onClick={() => setSuspectId(s.id)}
            >
              <div className="suspect-token" style={{ background: s.color }}>{s.initials}</div>
              <span>{s.name}</span>
            </div>
          ))}
        </div>

        <button className="btn-start" onClick={start}>
          Iniciar Investigação
        </button>
      </div>

      <button className="btn-rules-toggle" onClick={() => setShowRules(v => !v)}>
        {showRules ? '▲ Ocultar Regras' : '▼ Como Jogar'}
      </button>

      {showRules && (
        <div className="rules-inline">
          <h3>Como Jogar</h3>
          <ul>
            <li><strong>Objetivo:</strong> descobrir quem matou, com qual arma e em qual cômodo.</li>
            <li><strong>Setup:</strong> um suspeito, uma arma e um cômodo são colocados no envelope confidencial. O resto das cartas é distribuído aos jogadores.</li>
            <li><strong>Seu turno:</strong> role o dado e mova o peão. Ao entrar em um cômodo, faça uma <strong>Suposição</strong>: escolha um suspeito e uma arma. Eles são trazidos ao cômodo.</li>
            <li><strong>Desmentir:</strong> os outros jogadores verificam se têm alguma das 3 cartas. O primeiro que tiver mostra <em>uma carta em segredo</em> para você.</li>
            <li><strong>Anotações:</strong> use o caderno para registrar o que você sabe. Clique nas células para ciclar as marcas.</li>
            <li><strong>Acusação:</strong> quando tiver certeza, faça uma acusação. Você só tem uma chance — se errar, é eliminado!</li>
            <li><strong>Passagens secretas:</strong> Cozinha ↔ Escritório · Jardim de Inverno ↔ Sala de Estar.</li>
          </ul>
        </div>
      )}

      <p className="setup-hint">
        Os demais jogadores serão controlados por bots dedutivos.
      </p>
    </div>
  )
}
