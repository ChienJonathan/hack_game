import { describe, expect, it } from 'vitest'
import { BasicWorldObject } from '../domain/BasicWorldObject.ts'
import { defaultColliderTags } from '../domain/ColliderTag.ts'
import type { Bounds } from '../domain/CollisionWorld.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { GAME_PHYSICS_CONFIG, type PhysicsConfig } from './physicsConstants.ts'
import { applyForce, PhysicsWorld, type PhysicsCollision } from './PhysicsWorld.ts'

const TICK_MS = 1000 / 60
const DT = TICK_MS / 1000

type Role = 'player' | 'enemy' | 'weapon' | 'object'
type Body = { [key: string]: unknown; x: number; y: number; vx: number; vy: number }

const WIDE_OPEN: Bounds = { left: 0, top: 0, right: 5000, bottom: 5000 }

function createWorld(
  config: Partial<PhysicsConfig> = {},
  bounds: Bounds | undefined = WIDE_OPEN,
) {
  const objects: WorldObject[] = []
  const state: WorldState = {
    rooms: [{ id: 'room1', objectIds: [], exits: [], state: {}, ...(bounds ? { bounds } : {}) }],
    worldObjects: objects,
    processInstances: [],
    currentRoomId: 'room1',
    commandHistory: [],
    simulationTick: 0,
    outcome: 'playing',
  }
  const physics = new PhysicsWorld(() => ({ ...GAME_PHYSICS_CONFIG, ...config }) as PhysicsConfig)
  const add = (id: string, role: Role, fields: Record<string, unknown> = {}) => {
    const object = new BasicWorldObject(
      id,
      'room1',
      { name: id, role, colliderTags: defaultColliderTags(role) },
      [],
      { x: 500, y: 500, width: 100, height: 100, vx: 0, vy: 0, ...fields },
    )
    objects.push(object)
    return { object, body: object.state as unknown as Body }
  }
  const step = (ticks = 1) => {
    for (let i = 0; i < ticks; i++) physics.step(state, TICK_MS)
  }
  return { state, physics, add, step }
}

describe('PhysicsWorld motion', () => {
  it('turns a force into acceleration (force / mass), then moves with the new velocity', () => {
    const { add, step } = createWorld({ drag: 0 })
    const { object, body } = add('guard', 'enemy', { mass: 2 })

    applyForce(object, 1000, 0)
    step()

    expect(body.vx).toBeCloseTo((1000 / 2) * DT, 6)
    expect(body.vy).toBe(0)
    expect(body.x).toBeCloseTo(500 + (1000 / 2) * DT * DT, 6)
  })

  it('adds up several forces and forgets them after the tick', () => {
    const { add, step } = createWorld({ drag: 0 })
    const { object, body } = add('guard', 'enemy')

    applyForce(object, 600, 0)
    applyForce(object, 400, 300)
    step()
    expect(body.vx).toBeCloseTo(1000 * DT, 6)
    expect(body.vy).toBeCloseTo(300 * DT, 6)

    const vx = body.vx
    step()
    expect(body.vx).toBe(vx) // no force this tick, no drag: it keeps coasting
  })

  it('applies drag after the forces and never lets it reverse the velocity', () => {
    const { add, step } = createWorld({ drag: 0.5, min_velocity: 0 })
    const { object, body } = add('guard', 'enemy', { vy: 300 })

    applyForce(object, 0, 6000)
    step()
    expect(body.vy).toBeCloseTo((300 + 6000 * DT) * (1 - 0.5 * DT), 6)

    const huge = createWorld({ drag: 1000, min_velocity: 0 })
    const fast = huge.add('guard', 'enemy', { vx: 100 })
    huge.step()
    expect(fast.body.vx).toBe(0)
  })

  it('caps the speed at max_velocity, preferring the object override', () => {
    const { add, step } = createWorld({ drag: 0, max_velocity: 500 })
    const free = add('a', 'enemy', { y: 100 })
    const capped = add('b', 'enemy', { y: 300, max_velocity: 80 })

    for (let i = 0; i < 10; i++) {
      applyForce(free.object, 100000, 0)
      applyForce(capped.object, 100000, 0)
      step()
    }

    expect(Math.hypot(free.body.vx, free.body.vy)).toBeCloseTo(500, 6)
    expect(Math.hypot(capped.body.vx, capped.body.vy)).toBeCloseTo(80, 6)
  })

  it('brings a slow body without force to rest, but not one that is being pushed', () => {
    const { add, step } = createWorld({ drag: 0, min_velocity: 5 })
    const coasting = add('a', 'enemy', { y: 100, vx: 4 })
    const pushed = add('b', 'enemy', { y: 300, mass: 1000 })

    applyForce(pushed.object, 1000, 0) // 1000 / 1000 * dt is far below min_velocity
    step()

    expect(coasting.body.vx).toBe(0)
    expect(pushed.body.vx).toBeGreaterThan(0)
  })

  it('keeps a body inside the room bounds and drops the speed into the edge', () => {
    const { add, step } = createWorld({ drag: 0 }, { left: 0, top: 0, right: 1000, bottom: 1000 })
    const { body } = add('guard', 'enemy', { x: 948, y: 500, vx: 400, vy: 50 })

    step()

    expect(body.x).toBe(950) // right edge 1000 - half of the width
    expect(body.vx).toBe(0)
    expect(body.vy).toBe(50)
  })

  it('does not move bodies outside the current room, dead bodies or held weapons', () => {
    const { add, step, state } = createWorld({ drag: 0 })
    const elsewhere = add('elsewhere', 'enemy', { vx: 100 })
    ;(elsewhere.object as unknown as { roomId: string }).roomId = 'room2'
    const dead = add('dead', 'enemy', { vx: 100, alive: false })
    const held = add('dagger', 'weapon', { vx: 100, equippedBy: 'player' })

    step()

    expect(state.worldObjects).toHaveLength(3)
    expect(elsewhere.body.x).toBe(500)
    expect(dead.body.x).toBe(500)
    expect(held.body.x).toBe(500)
  })

  it('leaves a frozen body where it is for the tick', () => {
    const { add, step } = createWorld({ drag: 0 })
    const { object, body } = add('guard', 'enemy', { vx: 100, frozen: true })

    applyForce(object, 1000, 0)
    step()

    expect(body.x).toBe(500)
    expect(body.vx).toBe(100)
    expect(body.frozen).toBe(false)
  })
})

describe('PhysicsWorld collisions', () => {
  it('stops a body flush against an Obstacle and exchanges motion with it', () => {
    const { add, step } = createWorld({ drag: 0, restitution: 0.5 })
    const guard = add('guard', 'enemy', { x: 395, vx: 600 })
    const boulder = add('boulder', 'object', { x: 500 })

    step()

    expect(guard.body.x).toBe(400)
    // e = 0.5 * 0.5, equal masses: the guard keeps 225 px/s and the boulder gets 375 px/s
    expect(guard.body.vx).toBeCloseTo(225, 6)
    expect(boulder.body.vx).toBeCloseTo(375, 6)
  })

  it('tells the listeners which bodies collided, along which normal and how fast', () => {
    const { add, step, physics } = createWorld({ drag: 0 })
    const events: PhysicsCollision[] = []
    physics.onCollision((collision) => events.push(collision))
    const guard = add('guard', 'enemy', { x: 395, vx: 600 })
    const boulder = add('boulder', 'object', { x: 500 })

    step()

    expect(events).toHaveLength(1)
    expect(events[0].a).toBe(guard.object)
    expect(events[0].b).toBe(boulder.object)
    expect(events[0].normal.x).toBeCloseTo(1, 6)
    expect(events[0].normal.y).toBeCloseTo(0, 6)
    expect(events[0].closingSpeed).toBeCloseTo(600, 6)
  })

  it('pushes along the line between the centres, not along the blocked axis', () => {
    const { add, step } = createWorld({ drag: 0 })
    const guard = add('guard', 'enemy', { x: 395, y: 480, vx: 600 })
    const boulder = add('boulder', 'object', { x: 500, y: 500 })

    step()

    expect(guard.body.vy).toBeLessThan(0) // knocked back and up, away from the boulder's centre
    expect(boulder.body.vy).toBeGreaterThan(0)
  })

  it('bounces off a heavy Obstacle that would hardly move', () => {
    const { add, step } = createWorld({ drag: 0, restitution: 0.5 })
    const guard = add('guard', 'enemy', { x: 395, vx: 600 })
    const boulder = add('boulder', 'object', { x: 500, mass: 100 })

    step()

    expect(boulder.body.vx).toBe(0)
    expect(guard.body.vx).toBeCloseTo(-150, 6) // -e * v with e = 0.25
  })

  it('collides a Weapon with an Obstacle', () => {
    const { add, step, physics } = createWorld({ drag: 0 })
    const events: PhysicsCollision[] = []
    physics.onCollision((collision) => events.push(collision))
    const dagger = add('dagger', 'weapon', { x: 395, vx: 600 })
    add('boulder', 'object', { x: 500 })

    step()

    expect(dagger.body.x).toBe(400)
    expect(events).toHaveLength(1)
  })

  it('lets a Weapon fly through a Character: no block and no collision', () => {
    const { add, step, physics } = createWorld({ drag: 0 })
    const events: PhysicsCollision[] = []
    physics.onCollision((collision) => events.push(collision))
    const dagger = add('dagger', 'weapon', { x: 450, vx: 600 })
    add('guard', 'enemy', { x: 500 })

    step()

    expect(dagger.body.x).toBeCloseTo(450 + 600 * DT, 6)
    expect(events).toHaveLength(0)
  })

  it('does not report bodies that are only touching or moving apart', () => {
    const { add, step, physics } = createWorld({ drag: 0 })
    const events: PhysicsCollision[] = []
    physics.onCollision((collision) => events.push(collision))
    add('guard', 'enemy', { x: 400, vx: -100 })
    add('boulder', 'object', { x: 500 })

    step()

    expect(events).toHaveLength(0)
  })

  it('pushes a body out of a body it overlaps at the start, along the shallowest axis', () => {
    const { add, step } = createWorld({ drag: 0 })
    const boulder = add('boulder', 'object', { x: 500, y: 500 })
    const dagger = add('dagger', 'weapon', { x: 540, y: 500 })
    applyForce(dagger.object, 1, 0) // the dagger is the one that is moving

    step()

    expect(dagger.body.x).toBeGreaterThanOrEqual(600)
    expect(dagger.body.y).toBe(500)
    expect(boulder.body.x).toBe(500)
  })

  it('pushes the lighter body out when neither one is moving', () => {
    const { add, step } = createWorld({ drag: 0 })
    const heavy = add('boulder', 'object', { x: 500, y: 500, mass: 10 })
    const light = add('dagger', 'weapon', { x: 540, y: 500 })

    step()

    expect(heavy.body.x).toBe(500)
    expect(light.body.x).toBe(600)
  })
})
