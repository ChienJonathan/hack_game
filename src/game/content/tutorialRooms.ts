import type { Room, RoomExit } from '../domain/Room.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { ROOM1_OBJECTS, type RoomObjectConfig } from './room1.ts'
import { ROOM_IDS, ROOM_LAYOUT } from './room1Constants.ts'
import { createInitialWorldState, createRoomObjects } from './room1WorldState.ts'

/**
 * Tutorial rooms played before room1, one per mechanic: tutorial1 → tutorial2 → tutorial3 →
 * tutorial4 → room1. Each Exit stays locked until the room's goal is met.
 */
export const TUTORIAL_ROOM_IDS = {
  move: 'tutorial1',
  discover: 'tutorial2',
  throw: 'tutorial3',
  slowTime: 'tutorial4',
} as const

/** Mass for enemies that never walk: a speed of 0 gives them no braking, so only weight keeps a bump from shoving them. */
const STANDS_FIRM = 1000

const BOUNDS = { left: ROOM_LAYOUT.left, top: ROOM_LAYOUT.top, right: ROOM_LAYOUT.right, bottom: ROOM_LAYOUT.bottom }
const ENTRY = { x: 250, y: 420 }

// Shared look of the objects, copied from room1 so the tutorial teaches the same things.
const dagger = (id: string, x: number, y: number): RoomObjectConfig => ({
  id,
  name: 'dagger',
  role: 'weapon',
  x,
  y,
  displayWidth: 72,
  displayHeight: 72,
  scaleX: 1,
  scaleY: 1,
  attackDistance: 30,
  attackDurationMs: 200,
  holdOffsetX: 20,
  holdOffsetY: 26,
})

const boulder = (id: string, x: number, y: number): RoomObjectConfig => ({
  id,
  name: 'boulder',
  role: 'object',
  x,
  y,
  displayWidth: 154,
  displayHeight: 154,
  scaleX: 1.28,
  scaleY: 1.28,
  colliderWidth: 128,
  colliderHeight: 128,
  colliderShape: 'circle',
  mass: 100,
})

const guard = (id: string, x: number, y: number, extra: Partial<RoomObjectConfig>): RoomObjectConfig => ({
  id,
  name: 'guard',
  role: 'enemy',
  x,
  y,
  displayWidth: 176,
  displayHeight: 176,
  scaleX: 1,
  scaleY: 1,
  speed: 210,
  maxHealth: 100,
  colliderWidth: 110,
  colliderHeight: 160,
  ...extra,
})

interface TutorialRoomDefinition {
  readonly id: string
  readonly hint: string
  readonly goal: string
  readonly objects: readonly RoomObjectConfig[]
  readonly exit: Pick<RoomExit, 'targetRoomId' | 'label' | 'requires'>
}

export const TUTORIAL_ROOMS: readonly TutorialRoomDefinition[] = [
  {
    id: TUTORIAL_ROOM_IDS.move,
    hint:
      'Move with the ARROW KEYS. Walk over the dagger to pick it up, then attack with SPACE or LEFT-CLICK. ' +
      'Defeat the training dummy to open the exit, then walk into it.',
    goal: 'Defeat the dummy, then walk into the exit.',
    objects: [
      dagger('tutorial1dagger', 640, 560),
      guard('dummy', 1250, 420, { name: 'dummy', speed: 0, maxHealth: 60, passive: true, mass: STANDS_FIRM }),
    ],
    exit: {
      targetRoomId: TUTORIAL_ROOM_IDS.discover,
      label: TUTORIAL_ROOM_IDS.discover,
      requires: { kind: 'defeat', objectIds: ['dummy'] },
    },
  },
  {
    id: TUTORIAL_ROOM_IDS.discover,
    hint:
      'Things you have not identified are marked ?. Press any letter key to open the command line, type ls and ' +
      'press ENTER: it lists everything here and reveals names. TAB completes names, ESC goes back to moving.',
    goal: 'Reveal everything in this room (ls).',
    objects: [
      boulder('tutorial2boulder', 900, 330),
      dagger('tutorial2dagger', 1150, 600),
      guard('tutorial2guard', 1450, 420, { speed: 0, passive: true, mass: STANDS_FIRM }),
    ],
    exit: {
      targetRoomId: TUTORIAL_ROOM_IDS.throw,
      label: TUTORIAL_ROOM_IDS.throw,
      requires: { kind: 'discover-all' },
    },
  },
  {
    id: TUTORIAL_ROOM_IDS.throw,
    hint:
      'mv <thing> <target> throws a thing at a target. This guard hits hard up close, so pick up the dagger and ' +
      'throw it from a distance: mv dagger guard. mv boulder hacker pulls the boulder over to you.',
    goal: 'Defeat the guard. Try throwing the dagger with mv.',
    objects: [
      dagger('tutorial3dagger', 420, 600),
      boulder('tutorial3boulder', 760, 300),
      guard('sentry', 1500, 420, { speed: 0, maxHealth: 40, mass: STANDS_FIRM }),
    ],
    exit: {
      targetRoomId: TUTORIAL_ROOM_IDS.slowTime,
      label: TUTORIAL_ROOM_IDS.slowTime,
      requires: { kind: 'defeat', objectIds: ['sentry'] },
    },
  },
  {
    id: TUTORIAL_ROOM_IDS.slowTime,
    hint:
      'Typing a command slows time to x0.25, but it never stops. This guard is faster than you and charges once ' +
      'you cross the middle of the room. Grab the dagger, and when the guard comes, type mv dagger guard.',
    goal: 'Defeat the fast guard.',
    objects: [
      dagger('tutorial4dagger', 430, 600),
      guard('runner', 1550, 420, { speed: 380, maxHealth: 40 }),
    ],
    exit: {
      targetRoomId: ROOM_IDS.first,
      label: ROOM_IDS.first,
      requires: { kind: 'defeat', objectIds: ['runner'] },
    },
  },
]

const ROOM1_HINT =
  'The real thing: guards rush you once you cross the middle of the room. Use ls, mv and your dagger to reach room2.'

/**
 * The whole game: the tutorial rooms, then room1 (and the room2 ending). The Player Character starts in
 * tutorial1 with the stats configured for room1's player.
 */
export function createGameWorldState(room1Objects: readonly RoomObjectConfig[] = ROOM1_OBJECTS): WorldState {
  const room1 = createInitialWorldState([...room1Objects])
  const playerConfig = room1Objects.find((obj) => obj.role === 'player')
  const playerId = playerConfig?.id ?? 'player'

  const tutorialObjects = TUTORIAL_ROOMS.flatMap((definition, index) =>
    createRoomObjects(
      index === 0 && playerConfig ? [{ ...playerConfig, ...ENTRY }, ...definition.objects] : definition.objects,
      definition.id,
    ),
  )
  const tutorialRooms: Room[] = TUTORIAL_ROOMS.map((definition) => ({
    id: definition.id,
    objectIds: tutorialObjects.filter((worldObject) => worldObject.roomId === definition.id).map((worldObject) => worldObject.id),
    exits: [{ ...definition.exit, ...ROOM_LAYOUT.exit }],
    state: { name: definition.id, width: ROOM_LAYOUT.width, height: ROOM_LAYOUT.height },
    bounds: BOUNDS,
    entry: ENTRY,
    hint: definition.hint,
    goal: definition.goal,
    restoresHealth: true,
  }))

  const room1Rooms = room1.rooms.map((room) =>
    room.id === ROOM_IDS.first
      ? {
          ...room,
          objectIds: room.objectIds.filter((id) => id !== playerId),
          entry: playerConfig ? { x: playerConfig.x, y: playerConfig.y } : ENTRY,
          hint: ROOM1_HINT,
          goal: 'Reach the exit to room2.',
          restoresHealth: true,
        }
      : room,
  )

  return {
    ...room1,
    rooms: [...tutorialRooms, ...room1Rooms],
    worldObjects: [...tutorialObjects, ...room1.worldObjects.filter((worldObject) => worldObject.id !== playerId)],
    currentRoomId: TUTORIAL_ROOM_IDS.move,
  }
}
