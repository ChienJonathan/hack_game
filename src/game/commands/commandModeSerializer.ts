import type { CommandModeConfig } from './commandModeConstants.ts'

/**
 * Serializes command mode configuration into valid TypeScript source code
 * suitable for writing directly to src/game/commands/commandModeConstants.ts.
 */
export function generateCommandModeConstantsSource(
  config: CommandModeConfig | { commandTimeScale: number },
): string {
  return `/**
 * Constants and configuration for Command Mode.
 * Constant across all rooms in the game world.
 */

export const DEFAULT_COMMAND_MODE_TIME_SCALE = ${config.commandTimeScale}

export interface CommandModeConfig {
  commandTimeScale: number
  [key: string]: number
}

/** Shared runtime command mode configuration. */
export const GAME_COMMAND_MODE_CONFIG: CommandModeConfig = {
  commandTimeScale: DEFAULT_COMMAND_MODE_TIME_SCALE,
}
`
}

