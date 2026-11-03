/**
 * Constants and configuration for Command Mode.
 * Constant across all rooms in the game world.
 */

export const DEFAULT_COMMAND_MODE_TIME_SCALE = 0.25

export interface CommandModeConfig {
  commandTimeScale: number
  [key: string]: number
}

/** Shared runtime command mode configuration. */
export const GAME_COMMAND_MODE_CONFIG: CommandModeConfig = {
  commandTimeScale: DEFAULT_COMMAND_MODE_TIME_SCALE,
}
