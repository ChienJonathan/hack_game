import { GAME_MV_CONFIG, type MvConfig } from '../commands/mvConstants.ts'
import { AabbCollisionWorld } from '../domain/CollisionWorld.ts'
import type { CollisionWorld } from '../domain/CollisionWorld.ts'
import { resolveMvAttr } from '../domain/MvAttr.ts'
import { isWeapon, solidObstacles } from '../domain/SolidObstacles.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import type { WorldState } from '../domain/WorldState.ts'

/** Distance from the target centre at which a Throw counts as arrived, at least one tick's step. */
export const ARRIVAL_RADIUS = 10

export interface ThrownState {
  targetX: number
  targetY: number
  targetObjectId?: string | null
  /** Ids of Characters already hurt during this Throw. */
  hitIds: string[]
}

interface FlightState {
  x: number
  y: number
  vx?: number
  vy?: number
  width?: number
  height?: number
  alive?: boolean
  thrown?: ThrownState | null
  [key: string]: unknown
}

function flightStateOf(worldObject: WorldObject): FlightState | undefined {
  try {
    return getMutableWorldObjectState(worldObject) as unknown as FlightState
  } catch {
    return undefined
  }
}

/** Gap below which a stopped object counts as touching the object that blocked it. */
const TOUCH_EPSILON = 1e-6

/**
 * Central motion for Thrown objects. A tick runs `move`, then contact resolution, then `accelerate`,
 * so contacts see the speed the object actually moved with.
 *
 * Thrown objects that have a collisionbox are blocked by the other solid objects: they stop where
 * they were blocked. Weapons have no collisionbox and fly through everything.
 */
export class ThrownFlight {
  private readonly config: () => MvConfig
  private readonly collision: CollisionWorld

  constructor(
    config: () => MvConfig = () => GAME_MV_CONFIG,
    collision: CollisionWorld = new AabbCollisionWorld(),
  ) {
    this.config = config
    this.collision = collision
  }

  thrownObjects(state: WorldState): { worldObject: WorldObject; flight: FlightState & { thrown: ThrownState } }[] {
    const result: { worldObject: WorldObject; flight: FlightState & { thrown: ThrownState } }[] = []
    for (const worldObject of state.worldObjects) {
      if (worldObject.roomId !== state.currentRoomId) {
        continue
      }
      const flight = flightStateOf(worldObject)
      if (flight?.thrown && flight.alive !== false) {
        result.push({ worldObject, flight: flight as FlightState & { thrown: ThrownState } })
      }
    }
    return result
  }

  /**
   * Moves every Thrown object by its current velocity; returns the ids of those whose Throw ends
   * this tick, because they arrived or were blocked.
   */
  move(state: WorldState, tickDurationMs: number): Set<string> {
    const dt = tickDurationMs / 1000
    const finished = new Set<string>()

    for (const { worldObject, flight } of this.thrownObjects(state)) {
      const thrown = flight.thrown
      this.trackTarget(state, thrown)

      const vx = flight.vx ?? 0
      const vy = flight.vy ?? 0
      const step = Math.hypot(vx, vy) * dt
      const remaining = Math.hypot(thrown.targetX - flight.x, thrown.targetY - flight.y)
      const arrives = remaining <= Math.max(step, ARRIVAL_RADIUS)
      const nextX = arrives ? thrown.targetX : flight.x + vx * dt
      const nextY = arrives ? thrown.targetY : flight.y + vy * dt

      let x = nextX
      let y = nextY
      let blockedByTarget = false
      let blocked = false
      if (!isWeapon(worldObject) && typeof flight.width === 'number' && typeof flight.height === 'number') {
        const obstacles = solidObstacles(state, worldObject.id)
        const size = { width: flight.width, height: flight.height }
        const resolved = this.collision.resolveMovement(
          { x: flight.x, y: flight.y, ...size },
          { x: nextX, y: nextY, ...size },
          obstacles.map((obstacle) => obstacle.box),
        )
        x = resolved.x
        y = resolved.y
        blocked = x !== nextX || y !== nextY
        if (blocked && thrown.targetObjectId) {
          const target = obstacles.find((obstacle) => obstacle.id === thrown.targetObjectId)
          blockedByTarget =
            target !== undefined && this.collision.gap({ x, y, ...size }, target.box) <= TOUCH_EPSILON
        }
      }

      flight.x = x
      flight.y = y
      if (arrives || blocked) {
        finished.add(worldObject.id)
      }
      if ((arrives && !blocked) || blockedByTarget) {
        this.discoverTarget(state, thrown)
      }
    }

    return finished
  }

  /** Applies drag and the pull towards the target, or stops objects whose Throw ended. */
  accelerate(state: WorldState, tickDurationMs: number, finished: ReadonlySet<string>): void {
    const dt = tickDurationMs / 1000
    const config = this.config()

    for (const { worldObject, flight } of this.thrownObjects(state)) {
      if (finished.has(worldObject.id)) {
        flight.vx = 0
        flight.vy = 0
        ;(flight as FlightState).thrown = null
        continue
      }

      const thrown = flight.thrown
      const attr = resolveMvAttr(worldObject, config)
      const deltaX = thrown.targetX - flight.x
      const deltaY = thrown.targetY - flight.y
      const distance = Math.hypot(deltaX, deltaY)
      const dirX = distance > 0 ? deltaX / distance : 0
      const dirY = distance > 0 ? deltaY / distance : 0

      const damping = Math.max(0, 1 - attr.drag * dt)
      const pull = (config.mv_force / attr.mass) * dt
      let vx = (flight.vx ?? 0) * damping + pull * dirX
      let vy = (flight.vy ?? 0) * damping + pull * dirY

      const speed = Math.hypot(vx, vy)
      const maxVelocity = Math.max(0, attr.max_velocity)
      if (speed > maxVelocity) {
        const scale = speed > 0 ? maxVelocity / speed : 0
        vx *= scale
        vy *= scale
      }

      flight.vx = vx
      flight.vy = vy
    }
  }

  private discoverTarget(state: WorldState, thrown: ThrownState): void {
    if (!thrown.targetObjectId) {
      return
    }
    const target = state.worldObjects.find((candidate) => candidate.id === thrown.targetObjectId)
    const targetState = target ? flightStateOf(target) : undefined
    if (targetState) {
      targetState.discovered = true
    }
  }

  private trackTarget(state: WorldState, thrown: ThrownState): void {
    if (!thrown.targetObjectId) {
      return
    }
    const target = state.worldObjects.find((candidate) => candidate.id === thrown.targetObjectId)
    const targetState = target ? flightStateOf(target) : undefined
    if (targetState) {
      thrown.targetX = targetState.x
      thrown.targetY = targetState.y
    }
  }
}
