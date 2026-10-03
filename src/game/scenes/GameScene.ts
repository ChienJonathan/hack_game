import Phaser from 'phaser'
import textboxImageUrl from '../../assets/game/ui/textbox.png'
import { ConsoleEchoCommandParser } from '../commands/ConsoleEchoCommandParser.ts'
import { COMMAND_INPUT_TEXTURE_KEY, PhaserCommandInputView } from '../presentation/PhaserCommandInputView.ts'

export class GameScene extends Phaser.Scene {
  private readonly parser = new ConsoleEchoCommandParser()
  private commandInputView: PhaserCommandInputView | undefined

  constructor() {
    super({ key: 'game' })
  }

  preload(): void {
    this.load.image(COMMAND_INPUT_TEXTURE_KEY, textboxImageUrl)
  }

  create(): void {
    const commandInputView = new PhaserCommandInputView()
    this.commandInputView = commandInputView
    commandInputView.mount(this, (rawText) => {
      this.parser.parse(rawText)
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      commandInputView.destroy()
      if (this.commandInputView === commandInputView) {
        this.commandInputView = undefined
      }
    })
  }

  update(_time: number, _delta: number): void {
    // TODO: advance the game session.
  }
}
