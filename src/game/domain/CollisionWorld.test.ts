import { describe, expect, it } from 'vitest'
import { AabbCollisionWorld } from './CollisionWorld.ts'

const world = new AabbCollisionWorld()

describe('gap', () => {
  it('is the edge-to-edge distance between horizontally separated boxes', () => {
    const left = { x: 0, y: 0, width: 10, height: 10 }
    const right = { x: 25, y: 0, width: 10, height: 10 }

    expect(world.gap(left, right)).toBe(15)
  })

  it('is zero when boxes overlap or touch', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }

    expect(world.gap(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(0)
    expect(world.gap(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(0)
  })

  it('is the straight-line distance between nearest corners for diagonal boxes', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    const b = { x: 13, y: 14, width: 10, height: 10 }

    expect(world.gap(a, b)).toBe(5)
  })
})

describe('overlaps', () => {
  it('returns true when boxes overlap internally', () => {
    const a = { x: 50, y: 50, width: 20, height: 20 }
    const b = { x: 60, y: 50, width: 20, height: 20 } // overlap: distance 10 < 20
    expect(world.overlaps(a, b)).toBe(true)
  })

  it('returns false when boxes only touch edge-to-edge', () => {
    const a = { x: 50, y: 50, width: 20, height: 20 }
    const b = { x: 70, y: 50, width: 20, height: 20 } // touching: distance 20 === 20
    expect(world.overlaps(a, b)).toBe(false)
  })

  it('returns false when boxes are separated', () => {
    const a = { x: 50, y: 50, width: 20, height: 20 }
    const b = { x: 100, y: 50, width: 20, height: 20 }
    expect(world.overlaps(a, b)).toBe(false)
  })

  it('returns false when boxes overlap in one axis but not the other', () => {
    const a = { x: 50, y: 50, width: 20, height: 20 }
    const b = { x: 50, y: 100, width: 20, height: 20 }
    expect(world.overlaps(a, b)).toBe(false)
  })
})

describe('resolveMovement', () => {
  const bounds = { left: 0, top: 0, right: 200, bottom: 200 }

  it('moves unhindered when no obstacles exist', () => {
    const current = { x: 50, y: 50, width: 20, height: 20 }
    const target = { x: 80, y: 70, width: 20, height: 20 }
    const resolved = world.resolveMovement(current, target, [], bounds)
    expect(resolved).toEqual({ x: 80, y: 70 })
  })

  it('clamps movement so moving box touches obstacle edge without overlapping', () => {
    const current = { x: 50, y: 50, width: 20, height: 20 }
    const target = { x: 100, y: 50, width: 20, height: 20 }
    const obstacle = { x: 90, y: 50, width: 20, height: 20 } // obstacle left edge = 80
    const resolved = world.resolveMovement(current, target, [obstacle], bounds)
    // Box should stop at x = 70 (so right edge is 80)
    expect(resolved.x).toBe(70)
    expect(resolved.y).toBe(50)
    expect(world.overlaps({ ...current, ...resolved }, obstacle)).toBe(false)
  })

  it('allows sliding along unaffected axis during diagonal collision', () => {
    const current = { x: 50, y: 50, width: 20, height: 20 }
    const target = { x: 100, y: 80, width: 20, height: 20 }
    const obstacle = { x: 90, y: 50, width: 20, height: 20 }
    const resolved = world.resolveMovement(current, target, [obstacle], bounds)
    // Stopped at x = 70 on X, but slides along Y to 80
    expect(resolved.x).toBe(70)
    expect(resolved.y).toBe(80)
    expect(world.overlaps({ ...current, ...resolved }, obstacle)).toBe(false)
  })

  it('clamps to room bounds when moving beyond boundaries', () => {
    const current = { x: 190, y: 50, width: 20, height: 20 }
    const target = { x: 220, y: 50, width: 20, height: 20 }
    const resolved = world.resolveMovement(current, target, [], bounds)
    expect(resolved.x).toBe(190) // bounds.right (200) - width/2 (10)
    expect(resolved.y).toBe(50)
  })
})

describe('clampToBounds', () => {
  const bounds = { left: 0, top: 0, right: 100, bottom: 50 }

  it('keeps a box fully inside the bounds', () => {
    const box = { x: 98, y: -4, width: 10, height: 10 }

    expect(world.clampToBounds(box, bounds)).toEqual({ x: 95, y: 5 })
  })

  it('leaves a box that is already inside unchanged', () => {
    const box = { x: 40, y: 20, width: 10, height: 10 }

    expect(world.clampToBounds(box, bounds)).toEqual({ x: 40, y: 20 })
  })
})

describe('nearestWithin', () => {
  const origin = { x: 0, y: 0, width: 10, height: 10 }
  const candidate = (id: string, x: number) => ({ id, box: { x, y: 0, width: 10, height: 10 } })

  it('returns the candidate with the smallest gap within the maximum gap', () => {
    const far = candidate('far', 30)
    const near = candidate('near', 14)

    expect(world.nearestWithin(origin, [far, near], 5)).toBe(near)
  })

  it('returns undefined when every candidate is beyond the maximum gap', () => {
    expect(world.nearestWithin(origin, [candidate('far', 30)], 5)).toBeUndefined()
  })

  it('accepts a candidate whose gap equals the maximum gap', () => {
    const edge = candidate('edge', 15)

    expect(world.nearestWithin(origin, [edge], 5)).toBe(edge)
  })
})
