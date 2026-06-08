import { useRef, useEffect } from 'react'
import { SUSPECTS, WEAPONS, ROOMS } from '../game/cards'
import { saveLogToFile, downloadLog } from '../utils/logExport'
import type { LogEntry, Player, GameState } from '../game/types'

interface Props { log: LogEntry[]; players: Player[]; game?: GameState }

function playerName(players: Player[], idx: number) {
  return players[idx]?.name ?? `Jogador ${idx}`
}

function formatEntry(e: LogEntry, players: Player[]): { icon: string; text: string } {
  switch (e.type) {
    case 'roll':
      return {
        icon: '🎲',
        text: e.dice
          ? `${playerName(players, e.playerIdx)} rolou 🎲${e.dice[0]} + 🎲${e.dice[1]} = ${e.roll}`
          : `${playerName(players, e.playerIdx)} rolou ${e.roll}`,
      }
    case 'move_room':
      return {
        icon: '🚪',
        text: `${playerName(players, e.playerIdx)} entrou na ${ROOMS[e.roomId].name}`,
      }
    case 'move_corridor':
      return {
        icon: '👣',
        text: `${playerName(players, e.playerIdx)} se moveu pelo corredor`,
      }
    case 'secret_passage':
      return {
        icon: '🔐',
        text: `${playerName(players, e.playerIdx)} usou passagem secreta: ${ROOMS[e.fromRoom].name} → ${ROOMS[e.toRoom].name}`,
      }
    case 'suggestion':
      return {
        icon: '🔍',
        text: `${playerName(players, e.playerIdx)} sugeriu: ${SUSPECTS[e.suspectId].name} com ${WEAPONS[e.weaponId].name} na ${ROOMS[e.roomId].name}`,
      }
    case 'pass':
      return {
        icon: '🤷',
        text: `${playerName(players, e.playerIdx)} não pôde refutar a suposição de ${playerName(players, e.suggesterIdx)}`,
      }
    case 'disprove':
      return e.disproverIdx !== null
        ? {
            icon: '🃏',
            text: `${playerName(players, e.disproverIdx)} mostrou uma carta para ${playerName(players, e.suggesterIdx)} e refutou a suposição`,
          }
        : {
            icon: '❓',
            text: `Ninguém pôde refutar a suposição de ${playerName(players, e.suggesterIdx)} (${SUSPECTS[e.suspectId].name} / ${WEAPONS[e.weaponId].name} / ${ROOMS[e.roomId].name})`,
          }
    case 'accusation':
      return e.correct
        ? {
            icon: '🏆',
            text: `${playerName(players, e.playerIdx)} acusou corretamente! ${SUSPECTS[e.suspectId].name} com ${WEAPONS[e.weaponId].name} na ${ROOMS[e.roomId].name} — VITÓRIA!`,
          }
        : {
            icon: '❌',
            text: `${playerName(players, e.playerIdx)} acusou errado (${SUSPECTS[e.suspectId].name} / ${WEAPONS[e.weaponId].name} / ${ROOMS[e.roomId].name}) e foi eliminado`,
          }
    case 'eliminated':
      return {
        icon: '💀',
        text: `${playerName(players, e.playerIdx)} foi eliminado da investigação`,
      }
  }
}

export default function GameLog({ log, players, game }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log.length])

  async function handleExport() {
    if (!game) return
    const r = await saveLogToFile(game, true)   // archive snapshot with timestamp
    if (!r.ok) downloadLog(game)                // fallback to browser download
  }

  return (
    <div className="game-log">
      <div className="log-header">
        <h3>📋 Registro</h3>
        {game && (
          <button className="btn-export-log" onClick={handleExport} title="Salvar log em ./logs/">
            💾 Salvar
          </button>
        )}
      </div>
      <div className="log-scroll">
        {log.map((e, i) => {
          const { icon, text } = formatEntry(e, players)
          return (
            <div key={i} className={`log-entry log-${e.type}`}>
              <span className="log-num">#{i + 1}</span>
              <span className="log-icon">{icon}</span>
              <span className="log-text">{text}</span>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
    </div>
  )
}
