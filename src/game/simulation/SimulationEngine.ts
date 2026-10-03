import type { WorldState } from '../domain/WorldState.ts'

export interface SimulationEngine {
  advance(state: WorldState, gameDeltaMs: number): void
}
