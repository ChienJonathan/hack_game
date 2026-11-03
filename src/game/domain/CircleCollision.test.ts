import { describe, expect, it } from 'vitest'
import { boxFromState, contactOf, ShapeCollisionWorld, type Box } from './CollisionWorld.ts'

const collision = new ShapeCollisionWorld()

const circle = (x: number, y: number, diameter: number): Box => ({ x, y, width: diameter, height: diameter, shape: 'circle' })
const box = (x: number, y: number, width: number, height = width): Box => ({ x, y, width, height })

describe('circle colliders', () => {
  it('measures the gap and overlap between two circles by their radii', () => {
    expect(collision.gap(circle(0, 0, 100), circle(130, 0, 40))).toBeCloseTo(60)
    expect(collision.overlaps(circle(0, 0, 100), circle(130, 0, 40))).toBe(false)
    expect(collision.overlaps(circle(0, 0, 100), circle(60, 0, 40))).toBe(true)
  })

  it('does not collide with a box that only reaches into the corner of its bounding square', () => {
    // The box's corner sits inside the circle's bounding square but outside the circle itself.
    const rock = circle(0, 0, 100)
    const crate = box(60, 60, 40)
    expect(collision.overlaps(box(0, 0, 100), crate)).toBe(true)
    expect(collision.overlaps(rock, crate)).toBe(false)
    expect(collision.gap(rock, crate)).toBeCloseTo(Math.hypot(40, 40) - 50)
  })

  it('pushes along the surface normal: from the circle centre towards the nearest point of the box', () => {
    const normal = collision.contactNormal(circle(0, 0, 100), box(80, 80, 60))
    expect(normal.x).toBeCloseTo(Math.SQRT1_2)
    expect(normal.y).toBeCloseTo(Math.SQRT1_2)
    // The reverse pair points the other way.
    const reverse = collision.contactNormal(box(80, 80, 60), circle(0, 0, 100))
    expect(reverse.x).toBeCloseTo(-Math.SQRT1_2)
  })

  it('still finds a way out when the circle centre is inside a box', () => {
    const contact = contactOf(circle(10, 0, 20), box(0, 0, 100, 40))
    // Nearest edge is the top or bottom (20 px away); the box lies on the other side.
    expect(Math.abs(contact.normal.y)).toBe(1)
    expect(contact.distance).toBeCloseTo(-(10 + 20))
  })

  it('keeps box pairs on the original AABB rules', () => {
    expect(collision.contactNormal(box(0, 0, 10), box(30, 40, 10))).toEqual({ x: 0.6, y: 0.8 })
    expect(collision.gap(box(0, 0, 10), box(30, 0, 10))).toBe(20)
  })

  it('carries the shape through boxFromState, and only for circles', () => {
    expect(boxFromState({ x: 1, y: 2, width: 3, height: 3, shape: 'circle' }).shape).toBe('circle')
    expect(boxFromState({ x: 1, y: 2, width: 3, height: 4, shape: 'whatever' })).toEqual({ x: 1, y: 2, width: 3, height: 4 })
  })
})

describe('moving against circles', () => {
  it('slides a box that walks into the side of a circle around the curve instead of stopping dead', () => {
    const rock = circle(0, 0, 100)
    // Walking right, below the centre line: the box's upper-right corner meets the rock's lower-left curve.
    const current = box(-80, 35, 40)
    const target = { ...current, x: -60 }
    const resolved = collision.resolveMovement(current, target, [rock])

    expect(collision.overlaps({ ...current, ...resolved }, rock)).toBe(false)
    expect(resolved.x).toBeGreaterThan(current.x) // still makes progress
    expect(resolved.y).toBeGreaterThan(current.y) // deflected down, around the curve
  })

  it('lets a circle roll along a flat wall rather than snagging on it', () => {
    const wall = box(0, 100, 400, 20)
    const ball = circle(0, 40, 80) // resting on the wall's top face
    const resolved = collision.resolveMovement(ball, { ...ball, x: 10, y: 50 }, [wall])
    expect(resolved.x).toBeCloseTo(10)
    expect(resolved.y).toBeCloseTo(50) // already touching: a flat wall holds it at the same height
    expect(collision.overlaps({ ...ball, ...resolved }, wall)).toBe(false)
  })

  it('never ends a step inside an obstacle it was clear of', () => {
    let seed = 7
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const obstacles: Box[] = [circle(0, 0, 120), box(150, 0, 60, 200), circle(-140, 90, 70)]
    for (let i = 0; i < 2000; i++) {
      const moverIsCircle = random() < 0.5
      const size = 20 + random() * 60
      const x = -250 + random() * 500
      const y = -250 + random() * 500
      const current = moverIsCircle ? circle(x, y, size) : box(x, y, size)
      if (obstacles.some((obstacle) => collision.overlaps(current, obstacle))) continue
      const target = { ...current, x: x + (random() - 0.5) * 40, y: y + (random() - 0.5) * 40 }
      const resolved = collision.resolveMovement(current, target, obstacles, {
        left: -300,
        top: -300,
        right: 300,
        bottom: 300,
      })
      for (const obstacle of obstacles) {
        expect(collision.overlaps({ ...current, ...resolved }, obstacle)).toBe(false)
      }
    }
  })
})
