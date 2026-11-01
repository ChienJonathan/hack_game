import type { ParsedCommand } from '../ParsedCommand.ts'
import type { CommandResult } from '../CommandResult.ts'
import type { WorldState } from '../../domain/WorldState.ts'
import type { CommandExecutor } from './base.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import type { WorldObject } from '../../domain/WorldObject.ts'
import {
  DEFAULT_MV_SPEED,
  GAME_MV_SPEED,
  type MvSpeedConfig,
} from '../mvConstants.ts'

export type MvSpeedSource = number | MvSpeedConfig | (() => number | MvSpeedConfig)

export function resolveMvSpeed(source?: MvSpeedSource): number {
  if (typeof source === 'function') {
    return resolveMvSpeed(source())
  }
  if (typeof source === 'number') {
    return source
  }
  if (typeof source === 'object' && source !== null) {
    if (typeof source.mv_speed === 'number') return source.mv_speed
    if (typeof (source as Record<string, unknown>).mvSpeed === 'number') {
      return (source as Record<string, unknown>).mvSpeed as number
    }
  }
  return GAME_MV_SPEED.mv_speed ?? DEFAULT_MV_SPEED
}

export function findObjectInRoom(state: WorldState, label: string): WorldObject | undefined {
  const currentRoom = state.rooms.find((room) => room.id === state.currentRoomId)
  if (!currentRoom) {
    return undefined
  }

  const normalized = label.trim().toLowerCase()
  const roomObjects = state.worldObjects.filter(
    (obj) => obj.roomId === state.currentRoomId && currentRoom.objectIds.includes(obj.id),
  )

  // 1. Exact match on metadata.name
  const byExactName = roomObjects.find((obj) => obj.metadata.name === label)
  if (byExactName) return byExactName

  // 2. Case-insensitive match on metadata.name
  const byCaseInsensitiveName = roomObjects.find((obj) => {
    const name = obj.metadata.name
    return typeof name === 'string' && name.toLowerCase() === normalized
  })
  if (byCaseInsensitiveName) return byCaseInsensitiveName

  // 3. Match on id if the object hasn't been renamed to a different name
  const byId = roomObjects.find((obj) => obj.id.toLowerCase() === normalized)
  if (byId) {
    const isRenamed =
      typeof byId.metadata.name === 'string' &&
      byId.metadata.name.toLowerCase() !== byId.id.toLowerCase() &&
      byId.metadata.role !== 'player'
    if (!isRenamed) {
      return byId
    }
  }

  return undefined
}

export class MvCommandExecutor implements CommandExecutor {
  private readonly speedSource?: MvSpeedSource

  constructor(speedSource?: MvSpeedSource) {
    this.speedSource = speedSource
  }

  execute(command: ParsedCommand, state: WorldState): CommandResult {
    if (state.outcome !== 'playing') {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'This game has ended.' } }
    }

    if (command.arguments.length !== 2 || command.options.length > 0) {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'Usage: mv <label1> <label2>' } }
    }

    const currentRoom = state.rooms.find((room) => room.id === state.currentRoomId)
    if (!currentRoom) {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'No room is currently active.' } }
    }

    const label1 = command.arguments[0]
    const label2 = command.arguments[1]

    const sourceObject = findObjectInRoom(state, label1)
    if (!sourceObject) {
      return { status: 'rejected', feedback: { kind: 'popup', text: `Cannot find "${label1}".` } }
    }

    const targetObject = findObjectInRoom(state, label2)
    const norm2 = label2.trim().toLowerCase().replace(/\/$/, '')
    const targetExit = currentRoom.exits.find(
      (exit) => exit.label.toLowerCase() === norm2 || exit.targetRoomId.toLowerCase() === norm2,
    )

    // If target does not exist, rename source as target
    if (!targetObject && !targetExit) {
      const oldName =
        typeof sourceObject.metadata.name === 'string'
          ? sourceObject.metadata.name
          : sourceObject.id
      sourceObject.rename(label2)
      const sourceState = getMutableWorldObjectState<MutableWorldObjectState>(sourceObject)
      sourceState.discovered = true

      return {
        status: 'success',
        feedback: [{ kind: 'popup', text: `Renamed ${oldName} to ${label2}.` }],
      }
    }

    // Target exists: throw source to target with speed
    if (targetObject && targetObject.id === sourceObject.id) {
      return {
        status: 'rejected',
        feedback: { kind: 'popup', text: `"${label1}" and "${label2}" are the same object.` },
      }
    }

    const speed = resolveMvSpeed(this.speedSource)
    const sourceState = getMutableWorldObjectState<MutableWorldObjectState>(sourceObject)

    // Unequip if currently equipped
    if (sourceState.equippedBy) {
      const holder = state.worldObjects.find((o) => o.id === sourceState.equippedBy)
      if (holder) {
        const holderState = getMutableWorldObjectState<{ weaponId?: string | null }>(holder)
        holderState.weaponId = null
      }
      sourceState.equippedBy = null
    }

    sourceState.discovered = true

    let targetX = 0
    let targetY = 0
    let targetObjectId: string | undefined
    let targetName = label2

    if (targetObject) {
      const targetState = getMutableWorldObjectState<{ x: number; y: number }>(targetObject)
      targetX = targetState.x
      targetY = targetState.y
      targetObjectId = targetObject.id
      targetName =
        typeof targetObject.metadata.name === 'string'
          ? targetObject.metadata.name
          : targetObject.id
    } else if (targetExit) {
      targetX = targetExit.x
      targetY = targetExit.y
      targetName = targetExit.label
    }

    const currentX = (sourceState.x as number) ?? 0
    const currentY = (sourceState.y as number) ?? 0
    const deltaX = targetX - currentX
    const deltaY = targetY - currentY
    const distance = Math.hypot(deltaX, deltaY)

    if (distance === 0) {
      sourceState.x = targetX
      sourceState.y = targetY
      sourceState.vx = 0
      sourceState.vy = 0
      sourceState.thrown = null
    } else {
      sourceState.vx = (deltaX / distance) * speed
      sourceState.vy = (deltaY / distance) * speed
      sourceState.thrown = {
        targetX,
        targetY,
        targetObjectId: targetObjectId ?? null,
        speed,
      }
    }

    const sourceName =
      typeof sourceObject.metadata.name === 'string'
        ? sourceObject.metadata.name
        : sourceObject.id

    return {
      status: 'success',
      feedback: [{ kind: 'popup', text: `Threw ${sourceName} to ${targetName}.` }],
    }
  }
}
