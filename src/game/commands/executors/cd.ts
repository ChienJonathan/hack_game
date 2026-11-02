import type { ParsedCommand } from '../ParsedCommand.ts'
import type { CommandResult } from '../CommandResult.ts'
import type { WorldState } from '../../domain/WorldState.ts'
import type { CommandExecutor } from './base.ts'
import { CD_REACH, currentRoomOf, isPlayerAtExit, travelThroughExit } from '../../domain/RoomTravel.ts'

function reject(text: string): CommandResult {
  return { status: 'rejected', feedback: { kind: 'popup', text } }
}

/** `cd <room>`: goes through the Exit to that room, from where the Player Character stands next to it. */
export class CdCommandExecutor implements CommandExecutor {
  private readonly playerId: string

  constructor(playerId = 'player') {
    this.playerId = playerId
  }

  execute(command: ParsedCommand, state: WorldState): CommandResult {
    if (state.outcome !== 'playing') {
      return reject('This game has ended.')
    }
    if (command.arguments.length !== 1 || command.options.length > 0) {
      return reject('Usage: cd <room>')
    }

    const room = currentRoomOf(state)
    if (!room) {
      return reject('No room is currently active.')
    }

    // Tab completion writes exits as `name/`.
    const wanted = command.arguments[0].trim().replace(/\/+$/, '').toLowerCase()
    if (wanted === '' || wanted === '.' || wanted === room.id.toLowerCase()) {
      return { status: 'success', feedback: [{ kind: 'popup', text: `You are already in ${room.id}.` }] }
    }

    const exit = room.exits.find((candidate) => candidate.label.toLowerCase() === wanted)
    if (!exit) {
      const known = state.rooms.some((candidate) => candidate.id.toLowerCase() === wanted)
      return reject(known ? `cd: ${wanted} is not reachable from here.` : `cd: no such room: ${wanted}`)
    }
    if (!isPlayerAtExit(state, exit, CD_REACH, this.playerId)) {
      return reject(`cd: walk up to the ${exit.label} exit first.`)
    }

    const result = travelThroughExit(state, exit, this.playerId)
    switch (result.status) {
      case 'entered':
        return { status: 'success', feedback: [{ kind: 'popup', text: `Entered ${result.roomId}.` }] }
      case 'ended':
        return { status: 'success', feedback: [{ kind: 'popup', text: `Reached ${exit.label}.` }] }
      case 'locked':
        return reject(result.reason)
      case 'missing':
        return reject(`cd: no such room: ${exit.label}`)
    }
  }
}
