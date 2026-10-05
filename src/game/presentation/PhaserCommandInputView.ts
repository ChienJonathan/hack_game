import type Phaser from 'phaser'
import type { CommandInputView } from './CommandInputView.ts'

export const COMMAND_INPUT_TEXTURE_KEY = 'command-input-textbox'

const TEXTBOX_WIDTH = 1850
const TEXTBOX_HEIGHT = 300
const BOTTOM_MARGIN = 32
const HORIZONTAL_PADDING = 60
const VERTICAL_PADDING = 32
const FONT_FAMILY = '"Press Start 2P", monospace'
const FONT_SIZE = 64
const LINE_SPACING = 8
const LINE_HEIGHT = FONT_SIZE + LINE_SPACING
const TEXT_COLOR = '#d6d6d6'
const PLACEHOLDER_COLOR = '#777777'
const CURSOR_COLOR = 0xd6d6d6
const FIELD_COLOR = '#101010'
const CURSOR_BLINK_MS = 500

export class PhaserCommandInputView implements CommandInputView {
  private scene: Phaser.Scene | undefined
  private onSubmit: ((rawText: string) => void) | undefined
  private background: Phaser.GameObjects.Image | undefined
  private commandText: Phaser.GameObjects.Text | undefined
  private placeholderText: Phaser.GameObjects.Text | undefined
  private cursorBlock: Phaser.GameObjects.Rectangle | undefined
  private cursorGlyph: Phaser.GameObjects.Text | undefined
  private cursorBlinkEvent: Phaser.Time.TimerEvent | undefined
  private value = ''
  private cursorIndex = 0
  private cursorVisible = true
  private characterWidth = FONT_SIZE
  private charactersPerLine = 1
  private visibleLineCount = 1
  private textLeft = 0
  private textTop = 0

  mount(scene: Phaser.Scene, onSubmit: (rawText: string) => void): void {
    this.destroy()
    this.scene = scene
    this.onSubmit = onSubmit

    const camera = scene.cameras.main
    const left = (camera.width - TEXTBOX_WIDTH) / 2
    const top = camera.height - BOTTOM_MARGIN - TEXTBOX_HEIGHT
    const centerX = left + TEXTBOX_WIDTH / 2
    const centerY = top + TEXTBOX_HEIGHT / 2
    const contentWidth = TEXTBOX_WIDTH - HORIZONTAL_PADDING * 2
    const contentHeight = TEXTBOX_HEIGHT - VERTICAL_PADDING * 2

    this.textLeft = left + HORIZONTAL_PADDING
    this.textTop = top + VERTICAL_PADDING
    this.characterWidth = this.measureCharacterWidth()
    this.charactersPerLine = Math.max(1, Math.floor(contentWidth / this.characterWidth))
    this.visibleLineCount = Math.max(1, Math.floor(contentHeight / LINE_HEIGHT))

    this.background = scene.add
      .image(centerX, centerY, COMMAND_INPUT_TEXTURE_KEY)
      .setDisplaySize(TEXTBOX_WIDTH, TEXTBOX_HEIGHT)
      .setDepth(10)

    this.commandText = scene.add
      .text(this.textLeft, this.textTop, '', {
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZE,
        color: TEXT_COLOR,
        lineSpacing: LINE_SPACING,
      })
      .setOrigin(0, 0)
      .setDepth(11)

    this.placeholderText = scene.add
      .text(this.textLeft, this.textTop, 'help', {
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZE,
        fontStyle: 'italic',
        color: PLACEHOLDER_COLOR,
        lineSpacing: LINE_SPACING,
      })
      .setOrigin(0, 0)
      .setDepth(11)

    this.cursorBlock = scene.add
      .rectangle(0, 0, this.characterWidth, FONT_SIZE, CURSOR_COLOR)
      .setOrigin(0, 0)
      .setDepth(12)

    this.cursorGlyph = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZE,
        color: FIELD_COLOR,
        lineSpacing: LINE_SPACING,
      })
      .setOrigin(0, 0)
      .setDepth(13)

    const keyboard = scene.input.keyboard
    if (!keyboard) {
      throw new Error('Phaser keyboard input is not enabled for the game scene.')
    }

    keyboard.on('keydown', this.handleKeyboardEvent)
    this.cursorBlinkEvent = scene.time.addEvent({
      delay: CURSOR_BLINK_MS,
      loop: true,
      callback: () => {
        this.cursorVisible = !this.cursorVisible
        this.updateCursorVisibility()
      },
    })

    this.render()
  }

  destroy(): void {
    this.scene?.input.keyboard?.off('keydown', this.handleKeyboardEvent)
    this.cursorBlinkEvent?.remove()
    this.background?.destroy()
    this.commandText?.destroy()
    this.placeholderText?.destroy()
    this.cursorBlock?.destroy()
    this.cursorGlyph?.destroy()

    this.scene = undefined
    this.onSubmit = undefined
    this.background = undefined
    this.commandText = undefined
    this.placeholderText = undefined
    this.cursorBlock = undefined
    this.cursorGlyph = undefined
    this.cursorBlinkEvent = undefined
    this.value = ''
    this.cursorIndex = 0
  }

  private readonly handleKeyboardEvent = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      this.submit()
      return
    }

    const characters = Array.from(this.value)

    if (event.key === 'Backspace') {
      event.preventDefault()
      if (this.cursorIndex > 0) {
        characters.splice(this.cursorIndex - 1, 1)
        this.cursorIndex -= 1
        this.value = characters.join('')
        this.markCursorActive()
        this.render()
      }
      return
    }

    if (event.key === 'Delete') {
      event.preventDefault()
      if (this.cursorIndex < characters.length) {
        characters.splice(this.cursorIndex, 1)
        this.value = characters.join('')
        this.markCursorActive()
        this.render()
      }
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      this.cursorIndex = Math.max(0, this.cursorIndex - 1)
      this.markCursorActive()
      this.render()
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      this.cursorIndex = Math.min(characters.length, this.cursorIndex + 1)
      this.markCursorActive()
      this.render()
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      this.cursorIndex = 0
      this.markCursorActive()
      this.render()
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      this.cursorIndex = characters.length
      this.markCursorActive()
      this.render()
      return
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      return
    }

    if (
      event.key.length === 1 &&
      /^[\x20-\x7e]$/.test(event.key) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault()
      characters.splice(this.cursorIndex, 0, event.key)
      this.cursorIndex += 1
      this.value = characters.join('')
      this.markCursorActive()
      this.render()
    }
  }

  private submit(): void {
    const submittedText = this.value

    try {
      this.onSubmit?.(submittedText)
    } finally {
      this.value = ''
      this.cursorIndex = 0
      this.markCursorActive()
      this.render()
    }
  }

  private markCursorActive(): void {
    this.cursorVisible = true
    this.updateCursorVisibility()
  }

  private updateCursorVisibility(): void {
    this.cursorBlock?.setVisible(this.cursorVisible)
    const hasCharacterUnderCursor = this.cursorIndex < Array.from(this.value).length
    this.cursorGlyph?.setVisible(this.cursorVisible && hasCharacterUnderCursor)
  }

  private render(): void {
    if (!this.commandText || !this.placeholderText || !this.cursorBlock || !this.cursorGlyph) {
      return
    }

    this.placeholderText.setVisible(this.value.length === 0)
    const characters = Array.from(this.value)
    const lines: string[] = []

    for (let index = 0; index < characters.length; index += this.charactersPerLine) {
      lines.push(characters.slice(index, index + this.charactersPerLine).join(''))
    }

    if (lines.length === 0) {
      lines.push('')
    }

    const cursorRow = Math.floor(this.cursorIndex / this.charactersPerLine)
    const cursorColumn = this.cursorIndex % this.charactersPerLine

    while (lines.length <= cursorRow) {
      lines.push('')
    }

    const lastScrollRow = Math.max(0, lines.length - this.visibleLineCount)
    const firstVisibleRow = Math.min(
      Math.max(0, cursorRow - this.visibleLineCount + 1),
      lastScrollRow,
    )

    this.commandText.setText(
      lines.slice(firstVisibleRow, firstVisibleRow + this.visibleLineCount).join('\n'),
    )

    const cursorX = this.textLeft + cursorColumn * this.characterWidth
    const cursorY = this.textTop + (cursorRow - firstVisibleRow) * LINE_HEIGHT
    this.cursorBlock.setPosition(cursorX, cursorY)
    this.cursorGlyph.setPosition(cursorX, cursorY)
    this.cursorGlyph.setText(characters[this.cursorIndex] ?? '')
    this.updateCursorVisibility()
  }

  private measureCharacterWidth(): number {
    const measurementCanvas = document.createElement('canvas')
    const context = measurementCanvas.getContext('2d')

    if (!context) {
      return FONT_SIZE
    }

    context.font = `${FONT_SIZE}px ${FONT_FAMILY}`
    const measuredWidth = context.measureText('M').width

    return measuredWidth > 0 ? measuredWidth : FONT_SIZE
  }
}
