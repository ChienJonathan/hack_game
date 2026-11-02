/**
 * Constants and configuration for the mv (throw) command.
 * Constant across all rooms in the game world.
 */

export const DEFAULT_MV_FORCE = 5000

export interface MvConfig {
  mv_force: number
  [key: string]: number
}

/** Shared runtime mv configuration, constant across all rooms. */
export const GAME_MV_CONFIG: MvConfig = {
  mv_force: DEFAULT_MV_FORCE,
}
