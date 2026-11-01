import type { MvSpeedConfig } from './mvConstants.ts'

/**
 * Serializes mv speed configuration into valid TypeScript source code
 * suitable for writing directly to src/game/commands/mvConstants.ts.
 */
export function generateMvConstantsSource(speed: number | MvSpeedConfig): string {
  const mvSpeed = typeof speed === 'number' ? speed : speed.mv_speed
  return `/**
 * Constants and configuration for the mv (throw) command.
 * Constant across all rooms in the game world.
 */

export const DEFAULT_MV_SPEED = ${Math.round(mvSpeed)}

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
`
}

