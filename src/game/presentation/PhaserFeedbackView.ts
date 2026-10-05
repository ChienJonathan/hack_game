import type Phaser from 'phaser'
import type { CommandFeedback } from '../commands/CommandFeedback.ts'
import type { FeedbackView } from './FeedbackView.ts'

const FEEDBACK_FONT_SIZE = 20
const FEEDBACK_LINE_SPACING = 6
const FEEDBACK_LINE_HEIGHT = FEEDBACK_FONT_SIZE + FEEDBACK_LINE_SPACING
const FEEDBACK_MARGIN = 32

export class PhaserFeedbackView implements FeedbackView {
  private text: Phaser.GameObjects.Text | undefined
  private lines: string[] = []

  mount(scene: Phaser.Scene): void {
    this.destroy()
    this.text = scene.add
      .text(112, 704, '', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: FEEDBACK_FONT_SIZE,
        color: '#d6d6d6',
        lineSpacing: FEEDBACK_LINE_SPACING,
      })
      .setOrigin(0, 1)
      .setDepth(15)
      .setVisible(false)
  }

  present(feedback: CommandFeedback): void {
    if (!this.text) {
      return
    }

    this.lines.push(feedback.text)
    this.render()
  }

  getOutputPadding(): number {
    if (this.lines.length === 0) {
      return 0
    }

    return this.lines.join('\n').split(/\r?\n/).length * FEEDBACK_LINE_HEIGHT + FEEDBACK_MARGIN
  }

  private render(): void {
    if (!this.text) {
      return
    }

    const renderedText = this.lines.join('\n')
    this.text.setText(renderedText)
    this.text.setVisible(renderedText.length > 0)

    const lineCount = Math.max(1, renderedText.split(/\r?\n/).length)
    const outputOffset = lineCount * FEEDBACK_LINE_HEIGHT + FEEDBACK_MARGIN
    this.text.setPosition(112, 704 - outputOffset)
  }

  destroy(): void {
    this.lines = []
    this.text?.destroy()
    this.text = undefined
  }
}
