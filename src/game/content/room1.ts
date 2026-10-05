import { BasicWorldObject } from '../domain/BasicWorldObject.ts'
import type { Room } from '../domain/Room.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { ALWAYS_ACTIVE_BEHAVIOR } from '../processes/BehaviorRule.ts'

export const ROOM_IDS = {
  first: 'room1',
  second: 'room2',
} as const

export const ROOM_NAMES: Readonly<Record<string, string>> = {
  [ROOM_IDS.first]: 'room1',
  [ROOM_IDS.second]: 'room2',
}

export const WORLD_OBJECT_IDS = {
  player: 'player',
  dagger: 'dagger',
  guard: 'guard',
} as const

export const PROCESS_IDS = {
  player: 'player-movement',
  dagger: 'dagger-pickup',
  guard: 'guard-response',
} as const

export const ROOM_LAYOUT = {
  width: 1920,
  height: 748,
  left: 96,
  top: 80,
  right: 1824,
  bottom: 700,
  rightHalfStartX: 960,
  exit: { x: 1770, y: 365 },
  playerStart: { x: 250, y: 205 },
  daggerStart: { x: 325, y: 610 },
  guardStart: { x: 1490, y: 365 },
  lurePoint: { x: 1120, y: 365 },
  retreatPoint: { x: 830, y: 365 },
} as const

const alwaysActiveRule = (processDefinitionId: string) => ({
  condition: ALWAYS_ACTIVE_BEHAVIOR,
  processDefinitionId,
})

function createRoomWorldObject(
  id: string,
  metadata: Readonly<Record<string, string | boolean>>,
  behaviorRules: WorldObject['behaviorRules'],
  state: WorldObject['state'],
): WorldObject {
  return new BasicWorldObject(id, ROOM_IDS.first, metadata, behaviorRules, state)
}

export function createInitialWorldState(): WorldState {
  const firstRoom: Room = {
    id: ROOM_IDS.first,
    objectIds: [WORLD_OBJECT_IDS.player, WORLD_OBJECT_IDS.dagger, WORLD_OBJECT_IDS.guard],
    exits: [{ targetRoomId: ROOM_IDS.second, label: ROOM_IDS.second, ...ROOM_LAYOUT.exit }],
    state: { name: ROOM_NAMES[ROOM_IDS.first], width: ROOM_LAYOUT.width, height: ROOM_LAYOUT.height },
  }

  const secondRoom: Room = {
    id: ROOM_IDS.second,
    objectIds: [],
    exits: [],
    state: { name: ROOM_NAMES[ROOM_IDS.second], width: ROOM_LAYOUT.width, height: ROOM_LAYOUT.height },
  }

  const worldObjects: WorldObject[] = [
    createRoomWorldObject(
      WORLD_OBJECT_IDS.player,
      { name: 'player', role: 'player', discoverable: false },
      [alwaysActiveRule(PROCESS_IDS.player)],
      {
        x: ROOM_LAYOUT.playerStart.x,
        y: ROOM_LAYOUT.playerStart.y,
        speed: 240,
        health: 1,
        alive: true,
        discovered: true,
        action: 'idle',
        targetRoomId: null,
        targetExitX: ROOM_LAYOUT.exit.x,
        targetExitY: ROOM_LAYOUT.exit.y,
        weaponId: null,
      },
    ),
    createRoomWorldObject(
      WORLD_OBJECT_IDS.dagger,
      { name: 'dagger', role: 'weapon', discoverable: true },
      [alwaysActiveRule(PROCESS_IDS.dagger)],
      {
        x: ROOM_LAYOUT.daggerStart.x,
        y: ROOM_LAYOUT.daggerStart.y,
        discovered: false,
        equippedBy: null,
      },
    ),
    createRoomWorldObject(
      WORLD_OBJECT_IDS.guard,
      { name: 'guard', role: 'guard', discoverable: true },
      [alwaysActiveRule(PROCESS_IDS.guard)],
      {
        x: ROOM_LAYOUT.guardStart.x,
        y: ROOM_LAYOUT.guardStart.y,
        speed: 210,
        health: 1,
        alive: true,
        discovered: false,
        alerted: false,
        chasing: false,
        attacking: false,
      },
    ),
  ]

  return {
    rooms: [firstRoom, secondRoom],
    worldObjects,
    processInstances: [],
    currentRoomId: ROOM_IDS.first,
    commandHistory: [],
    simulationTick: 0,
    outcome: 'playing',
  }
}
