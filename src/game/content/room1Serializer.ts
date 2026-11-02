import { PHYSICS_ATTR_KEYS } from '../domain/PhysicsAttr.ts'
import type { RoomObjectConfig } from './room1.ts'

/**
 * Serializes an array of RoomObjectConfig items into valid TypeScript source code
 * suitable for writing directly to src/game/content/room1.ts.
 */
export function generateRoom1Source(objects: RoomObjectConfig[]): string {
  const serializedObjects = objects.map((obj) => {
    const lines = [
      `    id: ${JSON.stringify(obj.id)},`,
      `    role: ${JSON.stringify(obj.role)},`,
      `    x: ${Math.round(obj.x)},`,
      `    y: ${Math.round(obj.y)},`,
      `    displayWidth: ${Math.round(obj.displayWidth)},`,
      `    displayHeight: ${Math.round(obj.displayHeight)},`,
    ]
    if (obj.scaleX !== undefined) {
      lines.push(`    scaleX: ${obj.scaleX},`)
    }
    if (obj.scaleY !== undefined) {
      lines.push(`    scaleY: ${obj.scaleY},`)
    }
    if (obj.speed !== undefined) {
      if (typeof obj.speed === 'number') {
        lines.push(`    speed: ${obj.speed},`)
      } else {
        const speed = obj.speed
        lines.push('    speed: {')
        lines.push(`      acceleration: ${speed.acceleration},`)
        lines.push(`      frictionAcceleration: ${speed.frictionAcceleration},`)
        lines.push(`      turnaroundAcceleration: ${speed.turnaroundAcceleration},`)
        lines.push(`      maxSpeed: ${speed.maxSpeed},`)
        lines.push('    },')
      }
    }
    if (obj.maxHealth !== undefined) {
      lines.push(`    maxHealth: ${obj.maxHealth},`)
    }
    if (obj.attackDistance !== undefined) {
      lines.push(`    attackDistance: ${obj.attackDistance},`)
    }
    if (obj.attackDurationMs !== undefined) {
      lines.push(`    attackDurationMs: ${obj.attackDurationMs},`)
    }
    if (obj.holdOffsetX !== undefined) {
      lines.push(`    holdOffsetX: ${obj.holdOffsetX},`)
    }
    if (obj.holdOffsetY !== undefined) {
      lines.push(`    holdOffsetY: ${obj.holdOffsetY},`)
    }
    if (obj.colliderWidth !== undefined) {
      lines.push(`    colliderWidth: ${Math.round(obj.colliderWidth)},`)
    }
    if (obj.colliderHeight !== undefined) {
      lines.push(`    colliderHeight: ${Math.round(obj.colliderHeight)},`)
    }
    for (const key of PHYSICS_ATTR_KEYS) {
      if (obj[key] !== undefined) {
        lines.push(`    ${key}: ${obj[key]},`)
      }
    }
    return `  {\n${lines.join('\n')}\n  },`
  })

  return `export interface PlayerSpeedConfig {
  acceleration: number
  frictionAcceleration: number
  turnaroundAcceleration: number
  maxSpeed: number
  [key: string]: number
}

/** Per-object physics values; unset fields fall back to the global defaults. */
export interface PhysicsAttrConfig {
  drag?: number
  mass?: number
  max_velocity?: number
  restitution?: number
  friction?: number
}

export type WorldObjectRole = 'player' | 'enemy' | 'weapon' | 'object' | 'guard'

export interface RoomObjectConfig extends PhysicsAttrConfig {
  id: string
  role: WorldObjectRole
  x: number
  y: number
  displayWidth: number
  displayHeight: number
  scaleX?: number
  scaleY?: number
  speed?: number | PlayerSpeedConfig
  maxHealth?: number
  attackDistance?: number
  attackDurationMs?: number
  holdOffsetX?: number
  holdOffsetY?: number
  colliderWidth?: number
  colliderHeight?: number
}

export const ROOM1_OBJECTS: RoomObjectConfig[] = [
${serializedObjects.join('\n')}
]
`
}
