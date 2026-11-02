import type { WorldState } from '../domain/WorldState.ts'
import type { CharacterCombatState } from '../domain/CharacterState.ts'
import { SIMULATION_TICK_MS } from '../simulation/TickSimulationEngine.ts'

export interface BloodBurst {
  x: number
  y: number
  direction: number
  roomId: string
  ageMs: number
}

/** Retains hit feedback across frames; observing a save never replays old hits. */
export class CombatFeedback {
  readonly attacks = new Map<string, number>()
  readonly damage = new Map<string, number>()
  readonly bursts: BloodBurst[] = []
  private readonly seen = new Map<string, { attack: number; damage: number }>()
  private previousTick: number | undefined

  update(state: WorldState, endedDeltaMs = 0): void {
    if (this.previousTick !== undefined && state.simulationTick < this.previousTick) this.clear()
    const delta = this.previousTick === undefined ? 0 : state.outcome === 'playing'
      ? Math.max(0, state.simulationTick - this.previousTick) * SIMULATION_TICK_MS
      : Math.max(0, endedDeltaMs)
    this.previousTick = state.simulationTick
    for (const [id, age] of this.attacks) {
      if (age + delta >= 240) this.attacks.delete(id)
      else this.attacks.set(id, age + delta)
    }
    for (const [id, age] of this.damage) {
      if (age + delta >= 180) this.damage.delete(id)
      else this.damage.set(id, age + delta)
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      this.bursts[i].ageMs += delta
      if (this.bursts[i].ageMs >= 360) this.bursts.splice(i, 1)
    }
    for (const object of state.worldObjects) {
      if (object.metadata.role !== 'player' && object.metadata.role !== 'guard') continue
      const data = object.state as unknown as CharacterCombatState
      const attack = data.attackSequence ?? 0
      const damage = data.damageSequence ?? 0
      const last = this.seen.get(object.id)
      if (last && attack > last.attack) this.attacks.set(object.id, 0)
      if (last && damage > last.damage) {
        this.damage.set(object.id, 0)
        this.bursts.push({ x: data.x, y: data.y + 10, roomId: object.roomId,
          direction: data.x < (data.lastDamageFromX ?? data.x) ? -1 : 1, ageMs: 0 })
      }
      this.seen.set(object.id, { attack, damage })
    }
  }

  clear(): void {
    this.attacks.clear()
    this.damage.clear()
    this.bursts.length = 0
    this.seen.clear()
    this.previousTick = undefined
  }
}
