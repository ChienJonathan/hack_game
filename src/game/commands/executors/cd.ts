import { getMutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import type { WorldPathResolver } from '../../domain/WorldPathResolver.ts'
import type { ParsedCommand } from '../ParsedCommand.ts'
import type { CommandResult } from '../CommandResult.ts'
import type { WorldState } from '../../domain/WorldState.ts'
import type { CommandExecutor } from './base.ts'

interface PlayerCommandState extends Record<string, string | number | boolean | null> {
  action: string
  targetRoomId: string | null
  targetExitX: number
  targetExitY: number
}

export class CdCommandExecutor implements CommandExecutor {
  private readonly pathResolver: WorldPathResolver

  constructor(pathResolver: WorldPathResolver) {
    this.pathResolver = pathResolver
  }

  execute(command: ParsedCommand, state: WorldState): CommandResult {
    if (state.outcome !== 'playing') {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'This game has ended.' } }
    }

    if (command.arguments.length !== 1 || command.options.length > 0) {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'Usage: cd <room>' } }
    }

    const target = this.pathResolver.resolve(command.arguments[0], state)
    if (!target || target.kind !== 'room') {
      return {
        status: 'rejected',
        feedback: { kind: 'popup', text: `Room not found: ${command.arguments[0]}` },
      }
    }

    const currentRoom = state.rooms.find((room) => room.id === state.currentRoomId)
    const exit = currentRoom?.exits.find((candidate) => candidate.targetRoomId === target.roomId)
    if (!exit) {
      return {
        status: 'rejected',
        feedback: { kind: 'popup', text: `There is no exit to ${target.roomId} from here.` },
      }
    }

    const player = state.worldObjects.find((worldObject) => worldObject.metadata.role === 'player')
    if (!player) {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'The player character is missing.' } }
    }

    const playerState = getMutableWorldObjectState<PlayerCommandState>(player)
    playerState.targetRoomId = target.roomId
    playerState.targetExitX = exit.x
    playerState.targetExitY = exit.y
    playerState.action = 'travel'

    return {
      status: 'success',
      completion: 'deferred',
      feedback: [
        {
          kind: 'popup',
          text: `Travel goal set: ${target.roomId}.`,
        },
      ],
    }
  }
}
