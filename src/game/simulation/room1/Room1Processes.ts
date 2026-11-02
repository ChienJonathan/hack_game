export {
  DAGGER_ATTACK_DISTANCE,
  DAGGER_ATTACK_DURATION_MS,
  computeDaggerAttackTranslation,
  startDaggerAttackAnimation,
  GAME_WEAPON_CONFIG,
} from '../../content/weaponConstants.ts'
import {
  ROOM_IDS,
  ROOM_LAYOUT,
  WORLD_OBJECT_IDS,
  PROCESS_IDS,
} from '../../content/room1Constants.ts'
import {
  computeDaggerAttackTranslation,
  startDaggerAttackAnimation,
  GAME_WEAPON_CONFIG,
} from '../../content/weaponConstants.ts'
import type { PlayerSpeedConfig } from '../../content/room1.ts'
import type { CharacterState } from '../../domain/CharacterState.ts'
import { AabbCollisionWorld, type Box } from '../../domain/CollisionWorld.ts'
import { CombatService } from '../../domain/CombatService.ts'
import { PICKUP_REACH, PickUpService } from '../../domain/PickUpService.ts'
import { applyPlayerDefeat } from '../../domain/PlayerDefeat.ts'
import { solidObstacles } from '../../domain/SolidObstacles.ts'
import { weaponFor } from '../../domain/WeaponDefinition.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import type { ProcessTickContext, WorldObjectProcess } from '../TickSimulationEngine.ts'

interface PlayerState extends CharacterState {
  speed: number | PlayerSpeedConfig
  moveX: number
  moveY: number
  vx: number
  vy: number
}

export interface DaggerState extends MutableWorldObjectState {
  x: number
  y: number
  width: number
  height: number
  equippedBy: string | null
  attackDurationMs: number
  attackElapsedMs: number
  attackOffsetX: number
}



interface GuardState extends CharacterState {
  speed: number
  alerted: boolean
  chasing: boolean
  attacking: boolean
}

const ROOM_BOUNDS = {
  left: ROOM_LAYOUT.left,
  top: ROOM_LAYOUT.top,
  right: ROOM_LAYOUT.right,
  bottom: ROOM_LAYOUT.bottom,
}

const collision = new AabbCollisionWorld()
const combat = new CombatService(collision)
const pickUp = new PickUpService(collision)

function stateOf<T extends MutableWorldObjectState>(
  context: ProcessTickContext,
): T {
  return getMutableWorldObjectState<T>(context.worldObject)
}

function objectState<T extends MutableWorldObjectState>(
  context: ProcessTickContext,
  id: string,
): T | undefined {
  const worldObject = context.state.worldObjects.find((candidate) => candidate.id === id)
  if (!worldObject) {
    return undefined
  }

  return getMutableWorldObjectState<T>(worldObject)
}

function boxOf(entity: { x: number; y: number; width: number; height: number }) {
  return { x: entity.x, y: entity.y, width: entity.width, height: entity.height }
}

function getObstacles(context: ProcessTickContext, excludeId: string): Box[] {
  return solidObstacles(context.state, excludeId).map((obstacle) => obstacle.box)
}

export class PlayerMovementProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.player
  readonly definitionId = PROCESS_IDS.player

  tick(context: ProcessTickContext): void {
    if (context.state.currentRoomId !== ROOM_IDS.first || context.state.outcome !== 'playing') {
      return
    }

    // The player process runs once per tick, so it also counts down every character's attack cooldown.
    combat.advanceCooldowns(context.state, context.tickDurationMs)

    const player = stateOf<PlayerState>(context)
    if (!player.alive) {
      return
    }

    if ((player as unknown as Record<string, unknown>).thrown) {
      Object.assign(player, collision.clampToBounds(boxOf(player), ROOM_BOUNDS))

      const exit = context.state.rooms
        .find((room) => room.id === ROOM_IDS.first)
        ?.exits.find((candidate) => candidate.x === ROOM_LAYOUT.exit.x && candidate.y === ROOM_LAYOUT.exit.y)
      if (exit && collision.gap(boxOf(player), ROOM_LAYOUT.exitZone) === 0) {
        context.state.currentRoomId = exit.targetRoomId
        context.state.outcome = 'congratulations'
      }
      return
    }

    const dt = context.tickDurationMs / 1000

    if (typeof player.speed === 'object' && player.speed !== null) {
      const speedConfig = player.speed as PlayerSpeedConfig
      const maxSpeed = speedConfig.maxSpeed
      const accel = speedConfig.acceleration
      const friction = speedConfig.frictionAcceleration ?? accel
      const turnaround = speedConfig.turnaroundAcceleration ?? (accel * 2)

      let vx = (player.vx as number) ?? 0
      let vy = (player.vy as number) ?? 0

      // X axis
      const inputX = player.moveX
      if (inputX !== 0) {
        player.facing = inputX < 0 ? 'left' : 'right'
        const targetVx = inputX * maxSpeed
        const isOpposing = (inputX > 0 && vx < 0) || (inputX < 0 && vx > 0)
        const currentAccel = isOpposing ? turnaround : accel
        if (inputX > 0) {
          vx = Math.min(targetVx, vx + currentAccel * dt)
        } else {
          vx = Math.max(targetVx, vx - currentAccel * dt)
        }
      } else {
        if (vx > 0) {
          vx = Math.max(0, vx - friction * dt)
        } else if (vx < 0) {
          vx = Math.min(0, vx + friction * dt)
        }
      }

      // Y axis
      const inputY = player.moveY
      if (inputY !== 0) {
        const targetVy = inputY * maxSpeed
        const isOpposing = (inputY > 0 && vy < 0) || (inputY < 0 && vy > 0)
        const currentAccel = isOpposing ? turnaround : accel
        if (inputY > 0) {
          vy = Math.min(targetVy, vy + currentAccel * dt)
        } else {
          vy = Math.max(targetVy, vy - currentAccel * dt)
        }
      } else {
        if (vy > 0) {
          vy = Math.max(0, vy - friction * dt)
        } else if (vy < 0) {
          vy = Math.min(0, vy + friction * dt)
        }
      }

      const currentBox = {
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height,
      }
      const nextBox = {
        x: player.x + vx * dt,
        y: player.y + vy * dt,
        width: player.width,
        height: player.height,
      }
      const obstacles = getObstacles(context, context.worldObject.id)
      const clamped = collision.resolveMovement(currentBox, nextBox, obstacles, ROOM_BOUNDS)
      if (clamped.x !== nextBox.x) {
        vx = 0
      }
      if (clamped.y !== nextBox.y) {
        vy = 0
      }

      player.x = clamped.x
      player.y = clamped.y
      player.vx = vx
      player.vy = vy
    } else {
      if (player.moveX !== 0) {
        player.facing = player.moveX < 0 ? 'left' : 'right'
      }
      const speed = typeof player.speed === 'number' ? player.speed : 240
      const distance = (speed * context.tickDurationMs) / 1000
      const currentBox = {
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height,
      }
      const nextBox = {
        x: player.x + player.moveX * distance,
        y: player.y + player.moveY * distance,
        width: player.width,
        height: player.height,
      }
      const obstacles = getObstacles(context, context.worldObject.id)
      const resolved = collision.resolveMovement(currentBox, nextBox, obstacles, ROOM_BOUNDS)
      player.x = resolved.x
      player.y = resolved.y
    }

    if (player.alive && player.weaponId === null) {
      pickUp.pickUp(context.state, context.worldObject.id)
    }

    const exit = context.state.rooms
      .find((room) => room.id === ROOM_IDS.first)
      ?.exits.find((candidate) => candidate.x === ROOM_LAYOUT.exit.x && candidate.y === ROOM_LAYOUT.exit.y)
    if (exit && collision.gap(boxOf(player), ROOM_LAYOUT.exitZone) === 0) {
      context.state.currentRoomId = exit.targetRoomId
      context.state.outcome = 'congratulations'
    }
  }
}

export class DaggerPickupProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.dagger
  readonly definitionId = PROCESS_IDS.dagger

  tick(context: ProcessTickContext): void {
    if (context.state.currentRoomId !== ROOM_IDS.first || context.state.outcome !== 'playing') {
      return
    }

    const dagger = stateOf<DaggerState>(context)
    if (!dagger.equippedBy) {
      const playerObj = context.state.worldObjects.find((candidate) => candidate.id === WORLD_OBJECT_IDS.player)
      if (playerObj) {
        const player = getMutableWorldObjectState<PlayerState>(playerObj)
        if (player.alive && player.weaponId === null) {
          if (collision.gap(boxOf(player), boxOf(dagger)) <= PICKUP_REACH) {
            pickUp.pickUp(context.state, WORLD_OBJECT_IDS.player)
          }
        }
      }
    }

    if (!dagger.equippedBy) {
      const daggerRecord = dagger as unknown as Record<string, unknown>
      daggerRecord.attackDurationMs = 0
      daggerRecord.attackElapsedMs = 0
      daggerRecord.attackOffsetX = 0
      return
    }

    const equippedRecord = dagger as unknown as Record<string, unknown>
    equippedRecord.thrown = null
    equippedRecord.vx = 0
    equippedRecord.vy = 0
    const holder = objectState<CharacterState>(context, dagger.equippedBy)
    if (holder) {
      const daggerRecord = dagger as unknown as Record<string, unknown>
      const duration = typeof daggerRecord.attackDurationMs === 'number' ? daggerRecord.attackDurationMs : 0
      let attackOffsetX = 0

      if (duration > 0) {
        const elapsed = ((daggerRecord.attackElapsedMs as number) ?? 0) + context.tickDurationMs
        if (elapsed >= duration) {
          daggerRecord.attackDurationMs = 0
          daggerRecord.attackElapsedMs = 0
          daggerRecord.attackOffsetX = 0
        } else {
          daggerRecord.attackElapsedMs = elapsed
          const maxDist =
            typeof daggerRecord.weaponAttackDistance === 'number'
              ? daggerRecord.weaponAttackDistance
              : typeof daggerRecord.attackDistance === 'number'
                ? daggerRecord.attackDistance
                : GAME_WEAPON_CONFIG.attackDistance
          const translation = computeDaggerAttackTranslation(elapsed, duration, maxDist)
          const isHolderFacingLeft = holder.facing === 'left'
          attackOffsetX = isHolderFacingLeft ? -translation : translation
          daggerRecord.attackOffsetX = attackOffsetX
        }
      } else {
        daggerRecord.attackOffsetX = 0
      }

      dagger.x = holder.x + attackOffsetX
      dagger.y = holder.y
    }
  }
}

export class GuardResponseProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.guard
  readonly definitionId = PROCESS_IDS.guard

  tick(context: ProcessTickContext): void {
    if (context.state.currentRoomId !== ROOM_IDS.first || context.state.outcome !== 'playing') {
      return
    }

    const guard = stateOf<GuardState>(context)
    const player = objectState<PlayerState>(context, WORLD_OBJECT_IDS.player)
    if (!guard.alive || !player || !player.alive) {
      return
    }

    if ((guard as unknown as Record<string, unknown>).thrown) {
      return
    }

    if (player.x < ROOM_LAYOUT.rightHalfStartX) {
      guard.chasing = false
      guard.attacking = false
      return
    }

    guard.alerted = true
    guard.chasing = true

    const reach = weaponFor(guard.weaponId).reach
    if (collision.gap(boxOf(guard), boxOf(player)) > reach) {
      const deltaX = player.x - guard.x
      const deltaY = player.y - guard.y
      const remainingDistance = Math.hypot(deltaX, deltaY)
      const maxDistance = (guard.speed * context.tickDurationMs) / 1000

      let targetX = player.x
      let targetY = player.y
      if (remainingDistance > maxDistance && remainingDistance !== 0) {
        targetX = guard.x + (deltaX / remainingDistance) * maxDistance
        targetY = guard.y + (deltaY / remainingDistance) * maxDistance
      }
      const currentBox = boxOf(guard)
      const nextBox = { x: targetX, y: targetY, width: guard.width, height: guard.height }
      const obstacles = getObstacles(context, context.worldObject.id)
      const resolved = collision.resolveMovement(currentBox, nextBox, obstacles, ROOM_BOUNDS)
      guard.x = resolved.x
      guard.y = resolved.y
    }

    const attack = combat.attack(context.state, context.worldObject.id)
    guard.attacking = attack.status === 'hit'
    if (guard.attacking && guard.weaponId === 'dagger') {
      const daggerObj = context.state.worldObjects.find(
        (o) =>
          (o.id === WORLD_OBJECT_IDS.dagger || o.metadata.role === 'weapon') &&
          (o.state as Record<string, unknown>).equippedBy === context.worldObject.id,
      )
      if (daggerObj) {
        startDaggerAttackAnimation(getMutableWorldObjectState<DaggerState>(daggerObj))
      }
    }

    applyPlayerDefeat(context.state)
  }
}

/** Thrown flight is owned by the engine's `ThrownFlight`; the boulder has no behavior of its own yet. */
export class BoulderProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.boulder
  readonly definitionId = PROCESS_IDS.boulder

  canRun(context: ProcessTickContext): boolean {
    return context.worldObject.roomId === context.state.currentRoomId
  }

  tick(): void {}
}

export const ROOM1_PROCESSES: readonly WorldObjectProcess[] = [
  new PlayerMovementProcess(),
  new DaggerPickupProcess(),
  new GuardResponseProcess(),
  new BoulderProcess(),
]
