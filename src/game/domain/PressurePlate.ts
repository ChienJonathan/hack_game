import { colliderTagsOf } from './ColliderTag.ts'
import { ShapeCollisionWorld, boxFromState } from './CollisionWorld.ts'
import type { WorldObject } from './WorldObject.ts'
import type { WorldState } from './WorldState.ts'

const collision = new ShapeCollisionWorld()

interface PositionedState {
  x: number
  y: number
  width: number
  height: number
  shape?: unknown
  alive?: unknown
  equippedBy?: unknown
}

function positioned(worldObject: WorldObject): PositionedState | undefined {
  const state = worldObject.state as Partial<PositionedState> | null
  return state &&
    typeof state.x === 'number' &&
    typeof state.y === 'number' &&
    typeof state.width === 'number' &&
    typeof state.height === 'number'
    ? (state as PositionedState)
    : undefined
}

export function isPressurePlate(worldObject: WorldObject): boolean {
  return worldObject.metadata.kind === 'plate'
}

/**
 * Whether something weighs the plate down: an alive Character or an Obstacle (a crate, a boulder) in the
 * same room whose collider overlaps it. Weapons are too light, and a held object is not on the floor.
 */
export function isPlatePressed(state: WorldState, plate: WorldObject): boolean {
  const plateState = positioned(plate)
  if (!plateState) {
    return false
  }
  const plateBox = boxFromState(plateState)
  return state.worldObjects.some((other) => {
    if (other === plate || other.roomId !== plate.roomId) {
      return false
    }
    const weighs = colliderTagsOf(other).some((tag) => tag.class === 'character' || tag.class === 'obstacle')
    const otherState = positioned(other)
    return (
      weighs &&
      otherState !== undefined &&
      otherState.alive !== false &&
      !otherState.equippedBy &&
      collision.overlaps(boxFromState(otherState), plateBox)
    )
  })
}
