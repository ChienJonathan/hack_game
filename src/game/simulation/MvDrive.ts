import { GAME_MV_CONFIG, type MvConfig } from '../commands/mvConstants.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { applyForce, type PhysicsWorld } from './PhysicsWorld.ts'

/** Distance from the target centre at which a Throw counts as arrived, at least one tick's step. */
export const ARRIVAL_RADIUS = 10

export interface ThrownState {
  targetX: number
  targetY: number
  targetObjectId?: string | null
  /** Ids of Characters already hurt during this Throw. */
  hitIds: string[]
  /** Set for the tick in which the object reached the target; `settle` then ends the Throw. */
  arrived?: boolean
}

interface DriveState {
  x: number
  y: number
  vx?: number
  vy?: number
  alive?: boolean
  frozen?: boolean
  discovered?: boolean
  thrown?: ThrownState | null
  [key: string]: unknown
}

function driveStateOf(worldObject: WorldObject): DriveState | undefined {
  try {
    return getMutableWorldObjectState(worldObject) as unknown as DriveState
  } catch {
    return undefined
  }
}

/**
 * The pull of an `mv` Throw. Every tick it applies `mv_force` towards the target as a Force; the
 * physics step does the moving. A Throw ends when the object comes within reach of the target
 * (it is placed on it and stopped) or at its first Collision (it keeps its speed and is only
 * handed over to the physics step).
 */
export class MvDrive {
  private readonly config: () => MvConfig

  constructor(config: () => MvConfig = () => GAME_MV_CONFIG) {
    this.config = config
  }

  /** Ends the Throw of any object that collides, and discovers the target if that is what it hit. */
  attach(physics: PhysicsWorld): void {
    physics.onCollision(({ a, b }) => {
      this.endThrowOnCollision(a, b)
      this.endThrowOnCollision(b, a)
    })
  }

  /** Before the physics step: tracks the target, then applies the pull or places an arriving object. */
  drive(state: WorldState, tickDurationMs: number): void {
    const dt = tickDurationMs / 1000
    const mvForce = this.config().mv_force

    for (const { worldObject, body, thrown } of this.thrownObjects(state)) {
      this.trackTarget(state, thrown)

      const step = Math.hypot(body.vx ?? 0, body.vy ?? 0) * dt
      const deltaX = thrown.targetX - body.x
      const deltaY = thrown.targetY - body.y
      const remaining = Math.hypot(deltaX, deltaY)

      if (remaining <= Math.max(step, ARRIVAL_RADIUS)) {
        body.x = thrown.targetX
        body.y = thrown.targetY
        body.frozen = true
        thrown.arrived = true
        continue
      }

      applyForce(worldObject, (mvForce * deltaX) / remaining, (mvForce * deltaY) / remaining)
    }
  }

  /** After the contacts of the tick: stops the objects that arrived and ends their Throw. */
  settle(state: WorldState): void {
    for (const { body, thrown } of this.thrownObjects(state)) {
      if (!thrown.arrived) {
        continue
      }
      body.vx = 0
      body.vy = 0
      body.thrown = null
      this.discover(state, thrown)
    }
  }

  private endThrowOnCollision(worldObject: WorldObject, other: WorldObject): void {
    const body = driveStateOf(worldObject)
    const thrown = body?.thrown
    if (!body || !thrown) {
      return
    }
    body.thrown = null
    if (thrown.targetObjectId === other.id) {
      const otherState = driveStateOf(other)
      if (otherState) {
        otherState.discovered = true
      }
    }
  }

  private thrownObjects(
    state: WorldState,
  ): { worldObject: WorldObject; body: DriveState; thrown: ThrownState }[] {
    const result: { worldObject: WorldObject; body: DriveState; thrown: ThrownState }[] = []
    for (const worldObject of state.worldObjects) {
      if (worldObject.roomId !== state.currentRoomId) {
        continue
      }
      const body = driveStateOf(worldObject)
      if (body?.thrown && body.alive !== false) {
        result.push({ worldObject, body, thrown: body.thrown })
      }
    }
    return result
  }

  private discover(state: WorldState, thrown: ThrownState): void {
    if (!thrown.targetObjectId) {
      return
    }
    const target = state.worldObjects.find((candidate) => candidate.id === thrown.targetObjectId)
    const targetState = target ? driveStateOf(target) : undefined
    if (targetState) {
      targetState.discovered = true
    }
  }

  private trackTarget(state: WorldState, thrown: ThrownState): void {
    if (!thrown.targetObjectId) {
      return
    }
    const target = state.worldObjects.find((candidate) => candidate.id === thrown.targetObjectId)
    const targetState = target ? driveStateOf(target) : undefined
    if (targetState) {
      thrown.targetX = targetState.x
      thrown.targetY = targetState.y
    }
  }
}
