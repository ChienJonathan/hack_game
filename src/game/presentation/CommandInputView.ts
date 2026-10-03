import type Phaser from 'phaser'

export interface CommandInputView {
  mount(scene: Phaser.Scene, onSubmit: (rawText: string) => void): void
  destroy(): void
}
