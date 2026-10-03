import type { WorldPath, WorldPathTarget } from './WorldPath.ts'
import type { WorldState } from './WorldState.ts'

export interface WorldPathResolver {
  resolve(path: WorldPath, state: WorldState): WorldPathTarget | undefined
}
