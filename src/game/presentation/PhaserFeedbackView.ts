import type Phaser from 'phaser'
import type { CommandFeedback } from '../commands/CommandFeedback.ts'
import type { FeedbackView } from './FeedbackView.ts'

export class PhaserFeedbackView implements FeedbackView {
  private text: Phaser.GameObjects.Text | undefined

  mount(scene: Phaser.Scene): void {
    this.destroy()
    this.text = scene.add
      .text(112, 704, '', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 20,
        color: '#d6d6d6',
        lineSpacing: 6,
      })
      .setOrigin(0, 1)
      .setDepth(15)
      .setVisible(false)
  }

  present(feedback: CommandFeedback): void {
    if (!this.text) {
      return
    }

    this.text.setText(feedback.text)
    this.text.setVisible(true)
  }

  destroy(): void {
    this.text?.destroy()
    this.text = undefined
  }
}
