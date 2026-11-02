import type { Box } from './CollisionWorld.ts'
import type { WorldObject } from './WorldObject.ts'
import type { WorldState } from './WorldState.ts'

export interface SolidObstacle {
  readonly id: string
  readonly box: Box
}

/**
 * The alive objects in the current room that block movement: every object with a collisionbox,
 * which excludes weapons.
 */
export function solidObstacles(state: WorldState, excludeId: string): SolidObstacle[] {
  const obstacles: SolidObstacle[] = []
  for (const obj of state.worldObjects) {
    if (obj.id === excludeId || obj.roomId !== state.currentRoomId || isWeapon(obj)) continue
    const s = obj.state as Record<string, unknown>
    if (s.alive === false) continue
    if (typeof s.x !== 'number' || typeof s.y !== 'number') continue
    if (typeof s.width !== 'number' || typeof s.height !== 'number') continue
    obstacles.push({ id: obj.id, box: { x: s.x, y: s.y, width: s.width, height: s.height } })
  }
  return obstacles
}

export function isWeapon(worldObject: WorldObject): boolean {
  return worldObject.metadata.role === 'weapon'
}
