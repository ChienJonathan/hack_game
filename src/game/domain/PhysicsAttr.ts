import { GAME_PHYSICS_CONFIG, MIN_MASS, type PhysicsConfig } from '../simulation/physicsConstants.ts'
import type { WorldObject } from './WorldObject.ts'

export interface PhysicsAttr {
  drag: number
  mass: number
  max_velocity: number
  restitution: number
}

/** Per-object physics values; unset fields fall back to the global defaults. */
export type PhysicsAttrOverride = Partial<PhysicsAttr>

export const PHYSICS_ATTR_KEYS: readonly (keyof PhysicsAttr)[] = ['drag', 'mass', 'max_velocity', 'restitution']

export function readPhysicsAttrOverride(state: unknown): PhysicsAttrOverride {
  if (typeof state !== 'object' || state === null) {
    return {}
  }
  const record = state as Record<string, unknown>
  const override: PhysicsAttrOverride = {}
  for (const key of PHYSICS_ATTR_KEYS) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      override[key] = value
    }
  }
  return override
}

/** The object's own physics values, falling back to the global defaults for unset fields. */
export function resolvePhysicsAttr(
  worldObject: WorldObject,
  config: PhysicsConfig = GAME_PHYSICS_CONFIG,
): PhysicsAttr {
  const override = readPhysicsAttrOverride(worldObject.state)
  return {
    drag: override.drag ?? config.drag,
    mass: Math.max(MIN_MASS, override.mass ?? config.mass),
    max_velocity: override.max_velocity ?? config.max_velocity,
    restitution: override.restitution ?? config.restitution,
  }
}
