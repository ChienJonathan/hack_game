import type { SaveSnapshot } from './SaveSnapshot.ts'

export interface SaveRepository {
  load(): SaveSnapshot | null
  save(snapshot: SaveSnapshot): void
  clear(): void
}
