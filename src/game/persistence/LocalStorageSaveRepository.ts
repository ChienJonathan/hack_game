import type { SaveRepository } from './SaveRepository.ts'
import type { SaveSnapshot } from './SaveSnapshot.ts'

export class LocalStorageSaveRepository implements SaveRepository {
  private readonly storage: Storage
  private readonly key

  constructor(
    storage: Storage = window.localStorage,
    key = 'hack-game.save',
  ) {
    this.storage = storage
    this.key = key
  }

  load(): SaveSnapshot | null {
    const serialized = this.storage.getItem(this.key)
    return serialized === null ? null : (JSON.parse(serialized) as SaveSnapshot)
  }

  save(snapshot: SaveSnapshot): void {
    this.storage.setItem(this.key, JSON.stringify(snapshot))
  }

  clear(): void {
    this.storage.removeItem(this.key)
  }
}
