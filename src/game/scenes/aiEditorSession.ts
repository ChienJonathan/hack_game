import { GameSession } from '../application/GameSession.ts'
import { InputModeController } from '../application/InputModeController.ts'
import { WORLD_OBJECT_IDS, ROOM_LAYOUT } from '../content/room1Constants.ts'
import { createRoom1CommandSubmissionService } from '../content/room1Commands.ts'
import { createInitialWorldState } from '../content/room1WorldState.ts'
import { ROOM1_OBJECTS, type RoomObjectConfig } from '../content/room1.ts'
import { BasicWorldObject } from '../domain/BasicWorldObject.ts'
import { CombatService } from '../domain/CombatService.ts'
import { PickUpService } from '../domain/PickUpService.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { JsonWorldStateCodec } from '../persistence/JsonWorldStateCodec.ts'
import { LocalStorageSaveRepository } from '../persistence/LocalStorageSaveRepository.ts'
import { INPUT_BINDINGS } from '../presentation/InputBindings.ts'
import { RealtimeSimulationClock } from '../simulation/RealtimeSimulationClock.ts'
import { TickSimulationEngine } from '../simulation/TickSimulationEngine.ts'
import { DaggerPickupProcess, GuardResponseProcess, PlayerMovementProcess } from '../simulation/room1/Room1Processes.ts'
import {
  BEHAVIOR_TREE_PROCESS_ID,
  BehaviorTreeProcess,
} from '../ai/behaviorTree/BehaviorTreeProcess.ts'
import {
  BOSS_CYBER_ENFORCER_TREE,
} from '../ai/behaviorTree/BehaviorTreePresets.ts'
import type {
  BehaviorTreeDef,
  BehaviorTreeStatus,
} from '../ai/behaviorTree/BehaviorTreeTypes.ts'

export interface AiEditorSessionBundle {
  session: GameSession
  worldState: WorldState
  btProcess: BehaviorTreeProcess
  targetGuardId: string
  setTree: (tree: BehaviorTreeDef) => void
  getTree: () => BehaviorTreeDef
  getNodeStatuses: () => ReadonlyMap<string, BehaviorTreeStatus>
  resetArena: () => void
  damageBoss: (amount: number) => void
  healBoss: (amount: number) => void
  step: (deltaMs?: number) => void
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

export function createAiEditorSession(options?: {
  tree?: BehaviorTreeDef
  bossMaxHealth?: number
  bossSpeed?: number
  storage?: Storage
  objects?: RoomObjectConfig[]
  targetGuardId?: string
}): AiEditorSessionBundle {
  const sourceObjects = options?.objects ?? ROOM1_OBJECTS
  const targetGuardId = options?.targetGuardId ?? (sourceObjects.find((o) => o.role === 'guard')?.id ?? WORLD_OBJECT_IDS.guard)
  const activeTree = options?.tree ?? BOSS_CYBER_ENFORCER_TREE
  const btProcess = new BehaviorTreeProcess(activeTree)

  // Reuse room1 world state directly from ROOM1_OBJECTS
  const worldState = createInitialWorldState(sourceObjects)

  // Disable exits so running to the door does not trigger congratulations outcome
  worldState.rooms = worldState.rooms.map((room) => ({
    ...room,
    exits: [],
  }))

  // Configure target guard with BehaviorTreeProcess
  const targetGuard = worldState.worldObjects.find((o) => o.id === targetGuardId)
  if (targetGuard) {
    const gState = targetGuard.state as Record<string, unknown>
    const initialGuardCfg = sourceObjects.find((o) => o.id === targetGuardId)
    const initialMaxHp = options?.bossMaxHealth ?? (activeTree.id.includes('boss') ? 150 : (initialGuardCfg?.maxHealth ?? 100))
    gState.maxHealth = initialMaxHp
    gState.health = initialMaxHp
    if (options?.bossSpeed !== undefined) {
      gState.speed = options.bossSpeed
    }
    gState.behaviorTree = activeTree

    // Replace guard's behavior rules with BehaviorTreeProcess rule
    worldState.worldObjects = worldState.worldObjects.map((obj) => {
      if (obj.id === targetGuardId) {
        return new BasicWorldObject(
          obj.id,
          obj.roomId,
          obj.metadata,
          [{ condition: { kind: 'always' }, processDefinitionId: BEHAVIOR_TREE_PROCESS_ID }],
          obj.state,
        )
      }
      return obj
    })
  }

  // Simulation engine reuses existing processes: Player movement + Dagger pickup + Guard response + Behavior Tree process
  const simulationEngine = new TickSimulationEngine([
    new PlayerMovementProcess(),
    new DaggerPickupProcess(),
    new GuardResponseProcess(),
    btProcess,
  ])

  const session = new GameSession({
    worldState,
    commandSubmission: createRoom1CommandSubmissionService(),
    simulationClock: new RealtimeSimulationClock(),
    simulationEngine,
    saveRepository: new LocalStorageSaveRepository(getStorage(options?.storage)),
    worldStateCodec: new JsonWorldStateCodec(),
    inputMode: new InputModeController(INPUT_BINDINGS.movement),
    combat: new CombatService(),
    pickUpService: new PickUpService(),
    playerId: WORLD_OBJECT_IDS.player,
  })

  const resetArena = () => {
    worldState.outcome = 'playing'
    worldState.processInstances = []

    // Reset player
    const playerObj = worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)
    const initialPlayerCfg = sourceObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)
    if (playerObj) {
      const pState = playerObj.state as Record<string, unknown>
      pState.x = initialPlayerCfg?.x ?? ROOM_LAYOUT.playerStart.x
      pState.y = initialPlayerCfg?.y ?? ROOM_LAYOUT.playerStart.y
      pState.vx = 0
      pState.vy = 0
      pState.moveX = 0
      pState.moveY = 0
      pState.health = initialPlayerCfg?.maxHealth ?? 100
      pState.alive = true
    }

    // Reset target guard
    const guardObj = worldState.worldObjects.find((o) => o.id === targetGuardId)
    const initialGuardCfg = sourceObjects.find((o) => o.id === targetGuardId)
    if (guardObj) {
      const gState = guardObj.state as Record<string, unknown>
      gState.x = initialGuardCfg?.x ?? ROOM_LAYOUT.guardStart.x
      gState.y = initialGuardCfg?.y ?? ROOM_LAYOUT.guardStart.y
      const maxHp = options?.bossMaxHealth ?? initialGuardCfg?.maxHealth ?? 100
      gState.health = maxHp
      gState.maxHealth = maxHp
      gState.alive = true
      gState.alerted = false
      gState.chasing = false
      gState.attacking = false
      gState.attackCooldownMs = 0
      gState.behaviorTree = btProcess.getTree()
    }
  }

  const damageBoss = (amount: number) => {
    const guardObj = worldState.worldObjects.find((o) => o.id === targetGuardId)
    if (guardObj) {
      const gState = guardObj.state as { health: number; maxHealth: number; alive: boolean }
      gState.health = Math.max(1, gState.health - amount)
    }
  }

  const healBoss = (amount: number) => {
    const guardObj = worldState.worldObjects.find((o) => o.id === targetGuardId)
    if (guardObj) {
      const gState = guardObj.state as { health: number; maxHealth: number; alive: boolean }
      gState.health = Math.min(gState.maxHealth, gState.health + amount)
    }
  }

  const step = (deltaMs = 20) => {
    worldState.outcome = 'playing'
    session.update(deltaMs)
  }

  return {
    session,
    worldState,
    btProcess,
    targetGuardId,
    setTree: (tree: BehaviorTreeDef) => {
      btProcess.setTree(tree)
      const guardObj = worldState.worldObjects.find((o) => o.id === targetGuardId)
      if (guardObj) {
        ;(guardObj.state as Record<string, unknown>).behaviorTree = tree
      }
    },
    getTree: () => btProcess.getTree(),
    getNodeStatuses: () => btProcess.getNodeStatuses(),
    resetArena,
    damageBoss,
    healBoss,
    step,
  }
}
