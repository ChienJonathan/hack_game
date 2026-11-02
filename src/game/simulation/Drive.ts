import type { WorldObject } from '../domain/WorldObject.ts'
import { resolvePhysicsAttr, velocityDecay } from '../domain/PhysicsAttr.ts'
import { applyForce } from './PhysicsWorld.ts'

/** How fast a guard changes its own velocity, in px/s². */
export const GUARD_ACCELERATION = 2500

/** Smallest share of the velocity that drag may leave in a tick, so that a huge drag cannot divide by zero. */
const MIN_DAMPING = 0.05

/** Speed above a drive's top speed (px/s) that still counts as being at it, against rounding error. */
const GATE_TOLERANCE = 0.01

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
 * `maxAcceleration` (px/s²) this tick, on the axes whose target is not null. The Force scales with the object's mass, so mass does not
 * change how fast an object walks, only how hard it is to push.
 */
export function accelerateToward(
  worldObject: WorldObject,
  targetVx: number | null,
  targetVy: number | null,
  maxAcceleration: number,
  tickDurationMs: number,
  gateSpeed = Number.POSITIVE_INFINITY,
): void {
  const dt = tickDurationMs / 1000
  const { vx, vy } = velocityOf(worldObject)
  // A drive only works up to its own top speed: it cannot slow a body that was knocked beyond it.
  if (Math.hypot(vx, vy) > gateSpeed + GATE_TOLERANCE) {
    return
  }

  const attr = resolvePhysicsAttr(worldObject)
  const { mass } = attr
  // Drag and friction are applied after the Force, so aim for a velocity that they leave at the target.
  const damping = Math.max(MIN_DAMPING, 1 - velocityDecay(worldObject, attr) * dt)
  // A null target leaves that axis alone: no Force, not even one that makes up for drag.
  let deltaX = targetVx === null ? 0 : targetVx / damping - vx
  let deltaY = targetVy === null ? 0 : targetVy / damping - vy
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

/** Brakes an object to a standstill, as long as it is not faster than `maxSpeed` (the drive's top speed). */
export function brake(
  worldObject: WorldObject,
  maxSpeed: number,
  acceleration: number,
  tickDurationMs: number,
): void {
  accelerateToward(worldObject, 0, 0, acceleration, tickDurationMs, maxSpeed)
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
  accelerateToward(worldObject, desired.vx, desired.vy, acceleration, tickDurationMs, maxSpeed)
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
  accelerateToward(worldObject, directionX * maxSpeed, directionY * maxSpeed, acceleration, tickDurationMs, maxSpeed)
}
