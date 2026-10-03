import type Phaser from 'phaser'
import type { WorldObjectId } from '../domain/ids.ts'

export class WorldObjectViewRegistry {
  private readonly views = new Map<WorldObjectId, Phaser.GameObjects.GameObject>()

  bind(id: WorldObjectId, view: Phaser.GameObjects.GameObject): void {
    this.views.set(id, view)
  }

  get(id: WorldObjectId): Phaser.GameObjects.GameObject | undefined {
    return this.views.get(id)
  }

  unbind(id: WorldObjectId): void {
    this.views.delete(id)
  }

  clear(): void {
    this.views.clear()
  }
}
