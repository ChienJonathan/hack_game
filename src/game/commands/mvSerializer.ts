import type { MvConfig } from './mvConstants.ts'

/**
 * Serializes mv configuration into valid TypeScript source code
 * suitable for writing directly to src/game/commands/mvConstants.ts.
 */
export function generateMvConstantsSource(config: MvConfig): string {
  return `/**
 * Constants and configuration for the mv (throw) command.
 * Constant across all rooms in the game world.
 */

export const DEFAULT_MV_FORCE = ${config.mv_force}

export interface MvConfig {
  mv_force: number
  [key: string]: number
}

/** Shared runtime mv configuration, constant across all rooms. */
export const GAME_MV_CONFIG: MvConfig = {
  mv_force: DEFAULT_MV_FORCE,
}
`
}
