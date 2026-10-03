import Phaser from 'phaser'
import { GameScene } from './scenes/GameScene.ts'

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    scene: [GameScene],
  })
}
