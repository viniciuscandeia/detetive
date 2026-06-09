import { useState, useEffect } from 'react'
import Board           from './Board'
import ActionPanel     from './ActionPanel'
import Notebook, { type MarksState, type PendingProp } from './Notebook'
import GameLog         from './GameLog'
import SuggestionModal from './SuggestionModal'
import DisproveModal   from './DisproveModal'
import AccusationModal from './AccusationModal'
import FloatingMenu    from './FloatingMenu'
import { SUSPECTS, WEAPONS, ROOMS } from '../game/cards'
import { saveLogToFile } from '../utils/logExport'
import type { GameAPI } from '../state/useGame'

interface Props { api: GameAPI; onExit: () => void }

type Tab = 'caderno' | 'registro'

// ── Suggestion overlay state ─────────────────────────────────────────────────
type SugStage = 'suggestion' | 'checking' | 'result'
interface SugOverlay {
  forSeq:         number             // game.suggestionSeq this overlay is for
  stage:          SugStage
  suggesterName:  string
  suggesterColor: string
  suspectName:    string
  weaponName:     string
  roomName:       string
  disproveOrder:  number[]           // captured at suggestion time
  disproverIdx:   number | null      // captured at result time (null = nobody)
}

export default function GameScreen({ api, onExit }: Props) {
  const { game, isHumanTurn } = api
  const [modal,      setModal]      = useState<'none' | 'suggest' | 'accuse'>('none')
  const [tab,        setTab]        = useState<Tab>('caderno')
  const [sugOverlay,  setSugOverlay]  = useState<SugOverlay | null>(null)
  const [marks,       setMarks]       = useState<MarksState>({})
  const [pendingProp, setPendingProp] = useState<PendingProp | null>(null)

  const cp     = game.players[game.currentPlayerIdx]
  const canAct = game.phase === 'ACTION' && isHumanTurn
  const inRoom = cp?.position.type === 'room'

  // Close suggestion/accusation modal when phase leaves ACTION
  useEffect(() => {
    if (!canAct && modal !== 'none') setModal('none')
  }, [canAct, modal])

  // Archive final log when game ends → ./logs/partida_TIMESTAMP.json
  // Guard against StrictMode double-fire: track whether archive was already sent.
  useEffect(() => {
    if (game.phase !== 'GAME_OVER') return
    let cancelled = false
    saveLogToFile(game, true)
      .then(r => { if (!cancelled && r.ok) console.info('[log archived]', r.file) })
      .catch(() => { /* dev server not running */ })
    return () => { cancelled = true }
  }, [game.phase, game])

  // ── Overlay effect 1: detect new suggestion (bot OR human) ──────────────
  // Dep: game.suggestionSeq — fires on every new suggestion.
  // Bot  → stage 'suggestion' (waits for user acknowledgement before rotation)
  // Human → stage 'checking' (rotation already running, show live progress)
  useEffect(() => {
    const sug = game.currentSuggestion
    if (!sug) return

    setSugOverlay(prev => {
      if (prev?.forSeq === game.suggestionSeq) return prev  // already open for this seq
      if (prev?.stage === 'result') return prev             // user hasn't dismissed result yet — let Continuar handle chaining

      const botPending = api.botSuggestionPending
      const suggester  = game.players[sug.suggesterIdx]
      if (!suggester) return prev

      if (botPending) {
        // Bot suggested — open at 'suggestion' stage, wait for Verificar click
        return {
          forSeq:         game.suggestionSeq,
          stage:          'suggestion',
          suggesterName:  botPending.playerName,
          suggesterColor: botPending.playerColor,
          suspectName:    botPending.suspectName,
          weaponName:     botPending.weaponName,
          roomName:       botPending.roomName,
          disproveOrder:  [...sug.disproveOrder],
          disproverIdx:   null,
        }
      } else if (!suggester.isBot) {
        // Human suggested — open directly at 'checking' stage (rotation already running)
        return {
          forSeq:         game.suggestionSeq,
          stage:          'checking',
          suggesterName:  suggester.name,
          suggesterColor: SUSPECTS[suggester.suspectId].color,
          suspectName:    SUSPECTS[sug.suspectId].name,
          weaponName:     WEAPONS[sug.weaponId].name,
          roomName:       ROOMS[sug.roomId].name,
          disproveOrder:  [...sug.disproveOrder],
          disproverIdx:   null,
        }
      }
      return prev  // bot suggestion not yet pending (shouldn't happen)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.suggestionSeq])

  // ── Overlay effect 2: detect DISPROVE finishing ───────────────────────────
  useEffect(() => {
    if (!sugOverlay || sugOverlay.stage !== 'checking') return
    if (game.phase === 'DISPROVE' || game.phase === 'AWAIT_HUMAN_DISPROVE') return
    // Phase left DISPROVE — capture result from currentSuggestion (still set)
    const disproverIdx  = game.currentSuggestion?.disproverIdx ?? null
    setSugOverlay(prev =>
      prev && prev.stage === 'checking'
        ? { ...prev, stage: 'result', disproverIdx }
        : prev
    )
  }, [game.phase, sugOverlay?.stage, game.currentSuggestion?.disproverIdx])

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleVerificar() {
    api.acknowledgeBotSuggestion()
    setSugOverlay(prev => prev ? { ...prev, stage: 'checking' } : prev)
  }

  // When dismissing a result overlay, check if a new pending bot suggestion already
  // arrived while the overlay was visible (can happen with back-to-back bot turns).
  // If so, open that overlay immediately instead of closing to null — otherwise the
  // gate would stay blocked forever (isBotSugPending stays true, Effect 1 won't re-fire).
  function handleContinuar() {
    const p   = api.botSuggestionPending
    const sug = game.currentSuggestion
    if (p && sug) {
      // New pending bot suggestion — open it directly
      setSugOverlay({
        forSeq:         game.suggestionSeq,
        stage:          'suggestion',
        suggesterName:  p.playerName,
        suggesterColor: p.playerColor,
        suspectName:    p.suspectName,
        weaponName:     p.weaponName,
        roomName:       p.roomName,
        disproveOrder:  [...sug.disproveOrder],
        disproverIdx:   null,
      })
    } else {
      setSugOverlay(null)
    }
  }

  function handleSuggest(s: number, w: number) {
    api.suggest(s, w); setModal('none')
  }
  function handleAccuse(s: number, w: number, r: number) {
    api.accuse(s, w, r); setModal('none')
  }

  // ── Derive player statuses for overlay (checking / result stages) ─────────
  function getStatuses(overlay: SugOverlay) {
    const { disproveOrder, stage, disproverIdx } = overlay
    const currentStep = game.currentSuggestion?.disproveStep ?? disproveOrder.length

    return disproveOrder.map((pidx, i) => {
      const player = game.players[pidx]
      let status: 'waiting' | 'checking' | 'passed' | 'disproved'

      if (stage === 'checking') {
        // Live: read from game state
        if (i < currentStep)       status = 'passed'
        else if (i === currentStep) status = 'checking'
        else                       status = 'waiting'
      } else {
        // Result captured
        if (disproverIdx === null) {
          // Nobody disproved — everyone passed
          status = 'passed'
        } else {
          const disproverStep = disproveOrder.indexOf(disproverIdx)
          if (i < disproverStep)      status = 'passed'
          else if (i === disproverStep) status = 'disproved'
          else                        status = 'waiting'
        }
      }
      return { player, status }
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="game-screen">
      {/* ── Left: board ─────────────────────────────────────────────────── */}
      <div className="game-left">
        <div className="board-wrap">
          <Board api={api} />
        </div>
      </div>

      {/* ── Right: action panel + tabbed side panel ──────────────────────── */}
      <div className="game-right">
        <ActionPanel
          api={api}
          onSuggest={() => setModal('suggest')}
          onAccuse={() => setModal('accuse')}
        />

        <div className="side-tabs">
          <button
            className={`side-tab ${tab === 'caderno'  ? 'active' : ''}`}
            onClick={() => setTab('caderno')}
          >📓 Caderno</button>
          <button
            className={`side-tab ${tab === 'registro' ? 'active' : ''}`}
            onClick={() => setTab('registro')}
          >📋 Registro</button>
        </div>

        <div className="side-panel side-panel--anim" key={tab}>
          {tab === 'caderno'  && <Notebook game={game} marks={marks} setMarks={setMarks} pendingProp={pendingProp} onSetPendingProp={setPendingProp} />}
          {tab === 'registro' && <GameLog log={game.log} players={game.players} game={game} />}
        </div>
      </div>

      {/* ── Suggestion / Accusation modals ───────────────────────────────── */}
      {modal === 'suggest' && canAct && inRoom && cp.position.type === 'room' && (
        <SuggestionModal
          roomId={cp.position.roomId}
          numPlayers={game.players.length}
          onConfirm={handleSuggest}
          onCancel={() => setModal('none')}
        />
      )}
      {modal === 'accuse' && (
        <AccusationModal
          onConfirm={handleAccuse}
          onCancel={() => setModal('none')}
        />
      )}

      {/* ── Human disprove ───────────────────────────────────────────────── */}
      {game.phase === 'AWAIT_HUMAN_DISPROVE' && game.humanDisproveOpts && game.currentSuggestion && (
        <DisproveModal
          opts={game.humanDisproveOpts}
          suggestion={game.currentSuggestion}
          onShow={cardId => api.showCard(cardId)}
        />
      )}

      {/* ── Floating menu ────────────────────────────────────────────────── */}
      <FloatingMenu api={api} onExit={onExit} />

      {/* ── Bot suggestion overlay (3 stages, two-column with Notebook) ────── */}
      {sugOverlay && game.phase !== 'AWAIT_HUMAN_DISPROVE' && (
        <div className="modal-backdrop">
          <div className="modal sug-notification sug-notification--wide">

            {/* Left column — suggestion info + disprove list */}
            <div className="sug-left-col">

              {/* Scrollable body — header + cards + disprove list + verdict */}
              <div className="sug-left-body">

                {/* Header */}
                <div className="sug-notif-header">
                  <span className="sug-notif-eyebrow">Suposição registrada</span>
                  <div className="sug-notif-header-row">
                    <div className="sug-notif-dot" style={{ background: sugOverlay.suggesterColor }} />
                    <span className="sug-notif-title">{sugOverlay.suggesterName}</span>
                  </div>
                </div>

                {/* Suggestion cards */}
                <div className="sug-notif-rows">
                  <div className="sug-notif-row">
                    <span className="sug-label">🕵 Suspeito</span>
                    <span className="sug-val">{sugOverlay.suspectName}</span>
                  </div>
                  <div className="sug-notif-row">
                    <span className="sug-label">🔪 Arma</span>
                    <span className="sug-val">{sugOverlay.weaponName}</span>
                  </div>
                  <div className="sug-notif-row">
                    <span className="sug-label">🏠 Local</span>
                    <span className="sug-val">{sugOverlay.roomName}</span>
                  </div>
                </div>

                {/* Stage: suggestion — info note */}
                {sugOverlay.stage === 'suggestion' && (
                  <p className="modal-note">Os demais jogadores verificarão se têm cartas para desmentir.</p>
                )}

                {/* Stage: checking / result — player statuses */}
                {(sugOverlay.stage === 'checking' || sugOverlay.stage === 'result') && (
                  <>
                    <p className="sug-section-label">Verificação</p>
                    <div className="sug-disprove-list">
                      {getStatuses(sugOverlay).map(({ player, status }, i) => (
                        <div key={player?.idx ?? i} className={`sug-disprove-row sug-ds-${status}`}>
                          <div
                            className="player-dot sm"
                            style={{ background: player ? SUSPECTS[player.suspectId].color : '#666' }}
                          />
                          <span className="sug-disprove-name">{player?.name ?? '?'}</span>
                          <span className="sug-disprove-icon">
                            {status === 'waiting'   && <span className="sdi-waiting">·</span>}
                            {status === 'checking'  && <span className="sdi-checking">🤔</span>}
                            {status === 'passed'    && <span className="sdi-passed">✗</span>}
                            {status === 'disproved' && <span className="sdi-disproved">✓</span>}
                          </span>
                        </div>
                      ))}
                    </div>

                    {sugOverlay.stage === 'result' && (
                      <p className="modal-note sug-result-note">
                        {sugOverlay.disproverIdx !== null
                          ? `✓ ${game.players[sugOverlay.disproverIdx]?.name ?? 'Alguém'} desmentiu a suposição.`
                          : '✗ Ninguém pôde desmentir a suposição.'}
                      </p>
                    )}
                  </>
                )}

              </div>{/* end sug-left-body */}

              {/* Footer — action button always visible at bottom */}
              <div className="sug-left-footer">
                {sugOverlay.stage === 'suggestion' && (
                  <button className="sug-btn-verificar" onClick={handleVerificar}>
                    Verificar <span className="sug-btn-arrow">→</span>
                  </button>
                )}
                {sugOverlay.stage === 'result' && (
                  <button className="sug-btn-continuar" onClick={handleContinuar}>
                    Continuar <span className="sug-btn-arrow">→</span>
                  </button>
                )}
              </div>

            </div>{/* end sug-left-col */}

            {/* Right column — Notebook (always interactive) */}
            <div className="sug-right-col">
              <p className="sug-notebook-hint">Caderno de campo</p>
              <div className="sug-notebook-wrap">
                <Notebook game={game} marks={marks} setMarks={setMarks} pendingProp={pendingProp} onSetPendingProp={setPendingProp} />
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
