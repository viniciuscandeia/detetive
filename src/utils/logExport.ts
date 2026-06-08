import type { GameState } from '../game/types'
import { SUSPECTS, WEAPONS, ROOMS } from '../game/cards'

export interface LogExport {
  data:      string
  jogadores: Array<{ nome: string; isBot: boolean; suspeitoPadrao: string }>
  vencedor:  string | null
  envelope:  { suspeito: string; arma: string; local: string }
  log:       GameState['log']
}

export function buildExport(game: GameState): LogExport {
  const winner =
    game.winner === null   ? null :
    game.winner === -1     ? 'Ninguém (todos eliminados)' :
    game.players[game.winner]?.name ?? `Jogador ${game.winner}`

  return {
    data: new Date().toISOString(),
    jogadores: game.players.map(p => ({
      nome:           p.name,
      isBot:          p.isBot,
      suspeitoPadrao: SUSPECTS[p.suspectId].name,
    })),
    vencedor: winner,
    envelope: {
      suspeito: SUSPECTS[game.envelope.suspectId].name,
      arma:     WEAPONS[game.envelope.weaponId].name,
      local:    ROOMS[game.envelope.roomId].name,
    },
    log: game.log,
  }
}

/**
 * POST to Vite dev-server middleware.
 * archive=false → overwrites ./logs/current_game.json  (live, every action)
 * archive=true  → writes    ./logs/partida_TIMESTAMP.json  (final snapshot)
 */
export async function saveLogToFile(
  game: GameState,
  archive = false,
): Promise<{ ok: boolean; file?: string }> {
  // Dev-server middleware only — skip silently in production build
  if (!import.meta.env.DEV) return { ok: false }
  try {
    const payload = buildExport(game)
    const url     = archive ? '/api/save-log?archive=1' : '/api/save-log'
    const res     = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload, null, 2),
    })
    if (res.ok) return res.json()
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

/** Fallback: trigger browser download */
export function downloadLog(game: GameState): void {
  const payload = buildExport(game)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  a.href     = url
  a.download = `partida_${ts}.json`
  a.click()
  URL.revokeObjectURL(url)
}
