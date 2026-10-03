import type Phaser from 'phaser'
import type { CommandFeedback } from '../commands/CommandFeedback.ts'

export interface FeedbackView {
  mount(scene: Phaser.Scene): void
  present(feedback: CommandFeedback): void
  destroy(): void
}
