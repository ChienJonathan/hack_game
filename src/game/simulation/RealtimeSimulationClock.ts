import type { SimulationClock } from './SimulationClock.ts'

export class RealtimeSimulationClock implements SimulationClock {
  toGameDelta(realDeltaMs: number): number {
    return Number.isFinite(realDeltaMs) && realDeltaMs > 0 ? realDeltaMs : 0
  }
}
