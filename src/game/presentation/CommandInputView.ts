import type Phaser from 'phaser'

export interface CommandInputView {
  mount(scene: Phaser.Scene, onSubmit: (rawText: string) => void): void
  setPrompt(prompt: string): void
  destroy(): void
}
