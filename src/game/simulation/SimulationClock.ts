export interface SimulationClock {
  toGameDelta(realDeltaMs: number): number
}
