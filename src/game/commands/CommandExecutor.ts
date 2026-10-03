import type { RegisteredCommand } from './CommandRegistry.ts'
import type { ParsedCommand } from './ParsedCommand.ts'
import type { CommandResult } from './CommandResult.ts'
import type { WorldState } from '../domain/WorldState.ts'

export interface CommandExecutor {
  execute(
    registeredCommand: RegisteredCommand,
    command: ParsedCommand,
    state: WorldState,
  ): CommandResult
}
