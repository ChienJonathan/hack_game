import {
  WORLD_OBJECT_IDS,
} from '../content/room1Constants.ts'
import {
  ROOM1_OBJECTS,
  type PlayerSpeedConfig,
  type RoomObjectConfig,
} from '../content/room1.ts'
import {
  DEFAULT_MV_SPEED,
  GAME_MV_SPEED,
  type MvSpeedConfig,
} from '../commands/mvConstants.ts'
import type { MvSpeedSource } from '../commands/executors/mv.ts'
import { createInitialWorldState } from '../content/room1WorldState.ts'
import { createRoom1CommandSubmissionService } from '../content/room1Commands.ts'
import { GameSession } from '../application/GameSession.ts'
import { InputModeController } from '../application/InputModeController.ts'
import { INPUT_BINDINGS } from '../presentation/InputBindings.ts'
import { RealtimeSimulationClock } from '../simulation/RealtimeSimulationClock.ts'
import { TickSimulationEngine } from '../simulation/TickSimulationEngine.ts'
import { PlayerMovementProcess, DaggerPickupProcess } from '../simulation/room1/Room1Processes.ts'
import { BasicWorldObject } from '../domain/BasicWorldObject.ts'
import { CombatService } from '../domain/CombatService.ts'
import { PickUpService } from '../domain/PickUpService.ts'
import { LocalStorageSaveRepository } from '../persistence/LocalStorageSaveRepository.ts'
import { JsonWorldStateCodec } from '../persistence/JsonWorldStateCodec.ts'
import type { WorldState } from '../domain/WorldState.ts'

export const DEFAULT_SPEED_CONFIG: PlayerSpeedConfig = {
  acceleration: 2500,
  frictionAcceleration: 3000,
  turnaroundAcceleration: 1600,
  maxSpeed: 300,
}

export { DEFAULT_MV_SPEED, GAME_MV_SPEED, type MvSpeedConfig }

export function getMvSpeedConfig(speed?: number | Partial<MvSpeedConfig>): MvSpeedConfig {
  if (typeof speed === 'number') {
    return { mv_speed: speed }
  }
  return {
    mv_speed: speed?.mv_speed ?? GAME_MV_SPEED.mv_speed ?? DEFAULT_MV_SPEED,
  }
}

export function getPlayerSpeedFromObjects(objects: RoomObjectConfig[]): PlayerSpeedConfig {
  const player = objects.find((o) => o.role === 'player' || o.id === WORLD_OBJECT_IDS.player)
  if (player && typeof player.speed === 'object' && player.speed !== null) {
    return {
      acceleration: player.speed.acceleration ?? DEFAULT_SPEED_CONFIG.acceleration,
      frictionAcceleration: player.speed.frictionAcceleration ?? DEFAULT_SPEED_CONFIG.frictionAcceleration,
      turnaroundAcceleration: player.speed.turnaroundAcceleration ?? DEFAULT_SPEED_CONFIG.turnaroundAcceleration,
      maxSpeed: player.speed.maxSpeed ?? DEFAULT_SPEED_CONFIG.maxSpeed,
    }
  }
  return { ...DEFAULT_SPEED_CONFIG }
}

export interface SpeedEditorSessionBundle {
  session: GameSession
  worldState: WorldState
}

function getStorage(storage?: Storage): Storage {
  if (storage) return storage
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  const memory = new Map<string, string>()
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    clear: () => {
      memory.clear()
    },
    key: (index: number) => Array.from(memory.keys())[index] ?? null,
    get length() {
      return memory.size
    },
  }
}

export function createSpeedEditorSession(options?: {
  playerSpeed?: PlayerSpeedConfig
  mvSpeed?: MvSpeedSource
  storage?: Storage
  objects?: RoomObjectConfig[]
}): SpeedEditorSessionBundle {
  const sourceObjects = options?.objects ?? ROOM1_OBJECTS
  const worldState = createInitialWorldState(sourceObjects)

  // Disable exits so running into the door doesn't trigger room transition / congratulations
  worldState.rooms = worldState.rooms.map((room) => ({
    ...room,
    exits: [],
  }))

  // Clear behavior rules for guards so they remain static
  // landmarks and do not pursue or attack during speed tuning.
  worldState.worldObjects = worldState.worldObjects.map((obj) => {
    if (obj.id !== WORLD_OBJECT_IDS.player && obj.id !== WORLD_OBJECT_IDS.dagger) {
      return new BasicWorldObject(obj.id, obj.roomId, obj.metadata, [], obj.state)
    }
    return obj
  })

  const speed: PlayerSpeedConfig = options?.playerSpeed ?? getPlayerSpeedFromObjects(sourceObjects)

  // Apply speed configuration to player domain entity
  const player = worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)
  if (player) {
    const state = player.state as Record<string, unknown>
    state.speed = { ...speed }
    state.maxSpeed = speed.maxSpeed
    state.acceleration = speed.acceleration
    state.frictionAcceleration = speed.frictionAcceleration
    state.turnaroundAcceleration = speed.turnaroundAcceleration
    state.vx = 0
    state.vy = 0
  }

  // Simulation engine runs PlayerMovementProcess and DaggerPickupProcess:
  // guards will not pursue or attack, while player movement and thrown weapon physics execute.
  const simulationEngine = new TickSimulationEngine([
    new PlayerMovementProcess(),
    new DaggerPickupProcess(),
  ])
  const session = new GameSession({
    worldState,
    commandSubmission: createRoom1CommandSubmissionService(options?.mvSpeed),
    simulationClock: new RealtimeSimulationClock(),
    simulationEngine,
    saveRepository: new LocalStorageSaveRepository(getStorage(options?.storage), 'hack-game.editor-save'),
    worldStateCodec: new JsonWorldStateCodec(),
    inputMode: new InputModeController(INPUT_BINDINGS.movement),
    combat: new CombatService(),
    pickUpService: new PickUpService(),
    playerId: WORLD_OBJECT_IDS.player,
  })

  return { session, worldState }
}
