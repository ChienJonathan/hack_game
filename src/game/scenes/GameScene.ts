import Phaser from 'phaser'

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'game' })
  }

  create(): void {
    // TODO: compose the game session and in-canvas views.
  }

  update(_time: number, _delta: number): void {
    // TODO: advance the game session.
  }
}
