/**
 * Constants and configuration for the mv (throw) command.
 * Constant across all rooms in the game world.
 */

export const DEFAULT_MV_SPEED = 300

export interface MvSpeedConfig {
  mv_speed: number
  [key: string]: number
}

/**
 * Shared runtime mv speed configuration, constant across all rooms.
 */
export const GAME_MV_SPEED: MvSpeedConfig = {
  mv_speed: DEFAULT_MV_SPEED,
}
