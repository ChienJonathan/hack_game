import { describe, expect, it } from 'vitest'
import { BasicWorldObject } from './BasicWorldObject.ts'
import { collidesPhysically, defaultColliderTags } from './ColliderTag.ts'

function objectWithRole(role: 'player' | 'enemy' | 'weapon' | 'object', alive?: boolean) {
  return new BasicWorldObject(
    role,
    'room1',
    { name: role, role, colliderTags: defaultColliderTags(role) },
    [],
    { x: 0, y: 0, width: 10, height: 10, ...(alive === undefined ? {} : { alive }) },
  )
}

describe('collidesPhysically', () => {
  const player = objectWithRole('player')
  const guard = objectWithRole('enemy')
  const dagger = objectWithRole('weapon')
  const boulder = objectWithRole('object')

  it('makes Characters collide with Characters and Obstacles', () => {
    expect(collidesPhysically(player, guard)).toBe(true)
    expect(collidesPhysically(player, boulder)).toBe(true)
    expect(collidesPhysically(boulder, guard)).toBe(true)
  })

  it('makes Obstacles collide with Obstacles and Weapons', () => {
    expect(collidesPhysically(boulder, objectWithRole('object'))).toBe(true)
    expect(collidesPhysically(dagger, boulder)).toBe(true)
    expect(collidesPhysically(boulder, dagger)).toBe(true)
  })

  it('lets Weapons pass through Characters and other Weapons', () => {
    expect(collidesPhysically(dagger, player)).toBe(false)
    expect(collidesPhysically(guard, dagger)).toBe(false)
    expect(collidesPhysically(dagger, objectWithRole('weapon'))).toBe(false)
  })

  it('does not collide with an object that carries no tag', () => {
    const untagged = new BasicWorldObject('x', 'room1', { name: 'x', role: 'object' }, [], { x: 0, y: 0 })
    expect(collidesPhysically(untagged, player)).toBe(false)
  })
})
