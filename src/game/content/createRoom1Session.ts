import { GameSession } from '../application/GameSession.ts'
import { JsonWorldStateCodec } from '../persistence/JsonWorldStateCodec.ts'
import { LocalStorageSaveRepository } from '../persistence/LocalStorageSaveRepository.ts'
import { RealtimeSimulationClock } from '../simulation/RealtimeSimulationClock.ts'
import { TickSimulationEngine } from '../simulation/TickSimulationEngine.ts'
import { ROOM1_PROCESSES } from '../simulation/room1/Room1Processes.ts'
import { createRoom1CommandSubmissionService } from './room1Commands.ts'
import { createInitialWorldState } from './room1.ts'

export function createRoom1Session(): GameSession {
  return new GameSession({
    worldState: createInitialWorldState(),
    commandSubmission: createRoom1CommandSubmissionService(),
    simulationClock: new RealtimeSimulationClock(),
    simulationEngine: new TickSimulationEngine(ROOM1_PROCESSES),
    saveRepository: new LocalStorageSaveRepository(),
    worldStateCodec: new JsonWorldStateCodec(),
  })
}
