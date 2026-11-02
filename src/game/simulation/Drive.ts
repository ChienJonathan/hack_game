import type { WorldObject } from '../domain/WorldObject.ts'
import { resolvePhysicsAttr } from '../domain/PhysicsAttr.ts'
import { applyForce } from './PhysicsWorld.ts'

/** How fast a guard changes its own velocity, in px/s². */
export const GUARD_ACCELERATION = 2500

/** Smallest share of the velocity that drag may leave in a tick, so that a huge drag cannot divide by zero. */
const MIN_DAMPING = 0.05

interface Velocity {
  vx: number
  vy: number
}

function velocityOf(worldObject: WorldObject): Velocity {
  const state = worldObject.state as Record<string, unknown>
  return {
    vx: typeof state.vx === 'number' ? state.vx : 0,
    vy: typeof state.vy === 'number' ? state.vy : 0,
  }
}

/**
 * Applies the Force that changes the object's velocity towards `targetVx/targetVy`, by at most
 * `maxAcceleration` (px/s²) this tick. The Force scales with the object's mass, so mass does not
 * change how fast an object walks, only how hard it is to push.
 */
export function accelerateToward(
  worldObject: WorldObject,
  targetVx: number,
  targetVy: number,
  maxAcceleration: number,
  tickDurationMs: number,
): void {
  const dt = tickDurationMs / 1000
  const { vx, vy } = velocityOf(worldObject)
  const { mass, drag } = resolvePhysicsAttr(worldObject)
  // Drag is applied after the Force, so aim for a velocity that drag leaves at the target.
  const damping = Math.max(MIN_DAMPING, 1 - drag * dt)
  let deltaX = targetVx / damping - vx
  let deltaY = targetVy / damping - vy
  const maxChange = maxAcceleration * dt
  const change = Math.hypot(deltaX, deltaY)
  if (change > maxChange) {
    deltaX = (deltaX / change) * maxChange
    deltaY = (deltaY / change) * maxChange
  }

  applyForce(worldObject, (mass * deltaX) / dt, (mass * deltaY) / dt)
}

/**
 * The velocity that takes an object from `from` to `to` at `maxSpeed`, slowing down in time to stop
 * `stopDistance` short of the target. Within that distance it wants to stand still.
 */
export function desiredApproachVelocity(
  from: { x: number; y: number },
  to: { x: number; y: number },
  maxSpeed: number,
  acceleration: number,
  stopDistance = 0,
): Velocity {
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  const distance = Math.hypot(deltaX, deltaY)
  const remaining = distance - stopDistance
  if (distance === 0 || remaining <= 0) {
    return { vx: 0, vy: 0 }
  }

  const speed = Math.min(maxSpeed, Math.sqrt(2 * acceleration * remaining))
  return { vx: (deltaX / distance) * speed, vy: (deltaY / distance) * speed }
}

/** Drives an object towards a point, stopping on it (or `stopDistance` short of it). */
export function steerToward(
  worldObject: WorldObject,
  target: { x: number; y: number },
  maxSpeed: number,
  acceleration: number,
  tickDurationMs: number,
  stopDistance = 0,
): void {
  const state = worldObject.state as { x: number; y: number }
  const desired = desiredApproachVelocity(state, target, maxSpeed, acceleration, stopDistance)
  accelerateToward(worldObject, desired.vx, desired.vy, acceleration, tickDurationMs)
}

/** Drives an object directly away from a point at `maxSpeed`. */
export function steerAway(
  worldObject: WorldObject,
  from: { x: number; y: number },
  maxSpeed: number,
  acceleration: number,
  tickDurationMs: number,
): void {
  const state = worldObject.state as { x: number; y: number }
  const deltaX = state.x - from.x
  const deltaY = state.y - from.y
  const distance = Math.hypot(deltaX, deltaY)
  const directionX = distance === 0 ? 1 : deltaX / distance
  const directionY = distance === 0 ? 0 : deltaY / distance
  accelerateToward(worldObject, directionX * maxSpeed, directionY * maxSpeed, acceleration, tickDurationMs)
}
