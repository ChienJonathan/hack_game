import type Phaser from 'phaser'
import type { WorldState } from '../domain/WorldState.ts'

export class PhaserGameOutcomePanel {
  private readonly gameOverPanel: Phaser.GameObjects.Container
  private readonly congratulationsPanel: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene) {
    this.gameOverPanel = this.createPanel(
      scene,
      'GAME OVER',
      'The guard caught you before you reached the exit.',
    )
    this.congratulationsPanel = this.createPanel(
      scene,
      'CONGRATULATIONS',
      'The guard is defeated. You reached room2.',
    )
  }

  update(state: WorldState): void {
    this.gameOverPanel.setVisible(state.outcome === 'game-over')
    this.congratulationsPanel.setVisible(state.outcome === 'congratulations')
  }

  destroy(): void {
    this.gameOverPanel.destroy(true)
    this.congratulationsPanel.destroy(true)
  }

  private createPanel(
    scene: Phaser.Scene,
    titleText: string,
    messageText: string,
  ): Phaser.GameObjects.Container {
    const background = scene.add.rectangle(960, 360, 1000, 300, 0x101010, 0.97)
    background.setStrokeStyle(5, 0x777777, 1)

    const topRule = scene.add.rectangle(960, 253, 880, 3, 0x555555, 1)
    const bottomRule = scene.add.rectangle(960, 467, 880, 3, 0x555555, 1)
    const title = scene.add
      .text(960, 315, titleText, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 48,
        color: '#e2e2e2',
        align: 'center',
      })
      .setOrigin(0.5)
    const message = scene.add
      .text(960, 392, messageText, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 22,
        color: '#bcbcbc',
        align: 'center',
        wordWrap: { width: 820 },
      })
      .setOrigin(0.5)

    return scene.add
      .container(0, 0, [background, topRule, bottomRule, title, message])
      .setDepth(30)
      .setVisible(false)
  }
}
