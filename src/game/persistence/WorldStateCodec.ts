import type { WorldState } from '../domain/WorldState.ts'
import type { WorldStateSnapshot } from './SaveSnapshot.ts'

export interface WorldStateCodec {
  serialize(state: WorldState): WorldStateSnapshot
  hydrate(snapshot: WorldStateSnapshot): WorldState
}
