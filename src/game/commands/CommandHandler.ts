import type { ParsedCommand } from './ParsedCommand.ts'
import type { CommandResult } from './CommandResult.ts'
import type { WorldState } from '../domain/WorldState.ts'

export interface CommandHandler {
  execute(command: ParsedCommand, state: WorldState): CommandResult
}
