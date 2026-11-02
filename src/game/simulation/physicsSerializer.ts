import type { PhysicsConfig } from './physicsConstants.ts'

/**
 * Serializes the physics configuration into valid TypeScript source code
 * suitable for writing directly to src/game/simulation/physicsConstants.ts.
 */
export function generatePhysicsConstantsSource(config: PhysicsConfig): string {
  return `/**
 * Constants and configuration for the physics step.
 * Constant across all rooms in the game world.
 */

export const DEFAULT_DRAG = ${config.drag}
export const DEFAULT_MASS = ${config.mass}
export const DEFAULT_MAX_VELOCITY = ${config.max_velocity}
export const DEFAULT_RESTITUTION = ${config.restitution}
export const DEFAULT_FRICTION = ${config.friction}
export const DEFAULT_MIN_VELOCITY = ${config.min_velocity}
export const DEFAULT_MIN_COLLIDE_MOVE_VELOCITY = ${config.min_collide_move_velocity}
export const MIN_MASS = 0.001

export interface PhysicsConfig {
  drag: number
  mass: number
  max_velocity: number
  restitution: number
  friction: number
  min_velocity: number
  min_collide_move_velocity: number
  [key: string]: number
}

/**
 * Shared runtime physics configuration, constant across all rooms.
 * \`drag\`, \`mass\`, \`max_velocity\`, \`restitution\` and \`friction\` are the defaults for objects that do not set their own.
 */
export const GAME_PHYSICS_CONFIG: PhysicsConfig = {
  drag: DEFAULT_DRAG,
  mass: DEFAULT_MASS,
  max_velocity: DEFAULT_MAX_VELOCITY,
  restitution: DEFAULT_RESTITUTION,
  friction: DEFAULT_FRICTION,
  min_velocity: DEFAULT_MIN_VELOCITY,
  min_collide_move_velocity: DEFAULT_MIN_COLLIDE_MOVE_VELOCITY,
}
`
}
