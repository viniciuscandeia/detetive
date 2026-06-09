import { useState } from 'react'
import { useGame, hasSavedGame } from './state/useGame'
import SetupScreen      from './components/SetupScreen'
import GameScreen       from './components/GameScreen'
import EndScreen        from './components/EndScreen'
import type { GameConfig } from './game/engine'

export default function App() {
  const api = useGame()
  const [started, setStarted] = useState(hasSavedGame)

  function handleStart(cfg: GameConfig) {
    api.newGame(cfg)
    setStarted(true)
  }

  if (!started) return <SetupScreen onStart={handleStart} hasSave={api.hasSave} onResume={() => setStarted(true)} />
  if (api.game.phase === 'GAME_OVER')
    return <EndScreen game={api.game} onRestart={() => setStarted(false)} />
  return <GameScreen api={api} onExit={() => setStarted(false)} />
}
