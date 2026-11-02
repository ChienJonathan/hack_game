import { describe, expect, it } from 'vitest'
import { resolveCollision, type CollisionBody } from './CollisionResponse.ts'

const body = (overrides: Partial<CollisionBody> = {}): CollisionBody => ({
  mass: 1,
  restitution: 1,
  vx: 0,
  vy: 0,
  ...overrides,
})

const RIGHT = { x: 1, y: 0 }

describe('resolveCollision', () => {
  it('swaps the velocities of two equal masses that collide head-on with restitution 1', () => {
    const result = resolveCollision(body({ vx: 100 }), body({ vx: -40 }), RIGHT, 50)

    expect(result?.a.vx).toBeCloseTo(-40, 6)
    expect(result?.b.vx).toBeCloseTo(100, 6)
  })

  it('makes both bodies share one velocity when the combined restitution is 0', () => {
    const result = resolveCollision(
      body({ vx: 100, mass: 1, restitution: 0 }),
      body({ vx: -40, mass: 3, restitution: 0 }),
      RIGHT,
      50,
    )

    // momentum 1*100 + 3*(-40) = -20 over a total mass of 4
    expect(result?.a.vx).toBeCloseTo(-5, 6)
    expect(result?.b.vx).toBeCloseTo(-5, 6)
  })

  it('multiplies both restitutions: e = 0.5 * 0.5 = 0.25', () => {
    const result = resolveCollision(
      body({ vx: 100, restitution: 0.5 }),
      body({ vx: 0, restitution: 0.5 }),
      RIGHT,
      0,
    )

    // v1' = (m1v1 + m2v2 + m2 e (v2 - v1)) / (m1 + m2) = (100 + 0.25 * -100) / 2
    expect(result?.a.vx).toBeCloseTo(37.5, 6)
    expect(result?.b.vx).toBeCloseTo(62.5, 6)
  })

  it('leaves the speed across the normal alone and only exchanges motion along it', () => {
    const result = resolveCollision(body({ vx: 100, vy: 30 }), body({ vx: 0, vy: -20 }), RIGHT, 0)

    expect(result?.a.vy).toBe(30)
    expect(result?.b.vy).toBe(-20)
  })

  it('exchanges motion along a diagonal normal', () => {
    const diagonal = { x: Math.SQRT1_2, y: Math.SQRT1_2 }
    const result = resolveCollision(body({ vx: 100, vy: 100 }), body(), diagonal, 0)

    expect(result?.a.vx).toBeCloseTo(0, 6)
    expect(result?.a.vy).toBeCloseTo(0, 6)
    expect(result?.b.vx).toBeCloseTo(100, 6)
    expect(result?.b.vy).toBeCloseTo(100, 6)
  })

  it('does nothing when the bodies are not approaching each other', () => {
    expect(resolveCollision(body({ vx: -10 }), body({ vx: 10 }), RIGHT, 50)).toBeNull()
    expect(resolveCollision(body({ vx: 10 }), body({ vx: 10 }), RIGHT, 50)).toBeNull()
    expect(resolveCollision(body(), body(), RIGHT, 50)).toBeNull()
  })

  describe('a body at rest', () => {
    it('stays put and the mover bounces off when it would gain less than the minimum speed', () => {
      const result = resolveCollision(
        body({ vx: 100, restitution: 0.5 }),
        body({ mass: 100, restitution: 0.5 }),
        RIGHT,
        50,
      )

      // it would only gain about 0.5 px/s, so it counts as infinitely heavy: a' = -e * v
      expect(result?.b.vx).toBe(0)
      expect(result?.a.vx).toBeCloseTo(-25, 6)
    })

    it('is moved normally when it would gain at least the minimum speed', () => {
      const result = resolveCollision(body({ vx: 100 }), body({ mass: 1 }), RIGHT, 50)

      expect(result?.a.vx).toBeCloseTo(0, 6)
      expect(result?.b.vx).toBeCloseTo(100, 6)
    })

    it('does not count as infinitely heavy once both bodies are moving', () => {
      const result = resolveCollision(body({ vx: 100 }), body({ mass: 100, vx: -1 }), RIGHT, 50)

      expect(result?.b.vx).not.toBe(-1)
    })

    it('treats the moving body as infinitely heavy when it is the one that would gain too little', () => {
      const result = resolveCollision(body({ mass: 100 }), body({ vx: -100, restitution: 1 }), RIGHT, 50)

      expect(result?.a.vx).toBe(0)
      expect(result?.b.vx).toBeCloseTo(100, 6)
    })
  })
})
