import Phaser from 'phaser'
import textboxImageUrl from '../../assets/game/ui/textbox.png'
import type { GameSession } from '../application/GameSession.ts'
import { createRoom1Session } from '../content/createRoom1Session.ts'
import { ROOM_IDS, ROOM_NAMES } from '../content/room1.ts'
import { PhaserFeedbackView } from '../presentation/PhaserFeedbackView.ts'
import { PhaserGameOutcomePanel } from '../presentation/PhaserGameOutcomePanel.ts'
import { PhaserRoomView, WORLD_OBJECT_TEXTURE_URLS } from '../presentation/PhaserRoomView.ts'
import { COMMAND_INPUT_TEXTURE_KEY, PhaserCommandInputView } from '../presentation/PhaserCommandInputView.ts'

export class GameScene extends Phaser.Scene {
  private session!: GameSession
  private commandInputView: PhaserCommandInputView | undefined
  private readonly roomView = new PhaserRoomView()
  private readonly feedbackView = new PhaserFeedbackView()
  private outcomePanel: PhaserGameOutcomePanel | undefined

  constructor() {
    super({ key: 'game' })
  }

  preload(): void {
    this.load.image(COMMAND_INPUT_TEXTURE_KEY, textboxImageUrl)
    for (const [textureKey, imageUrl] of Object.entries(WORLD_OBJECT_TEXTURE_URLS)) {
      this.load.image(textureKey, imageUrl)
    }
  }

  create(): void {
    this.session = createRoom1Session()
    const worldState = this.session.getWorldState()
    this.roomView.mount(this, worldState)
    this.feedbackView.mount(this)
    this.outcomePanel = new PhaserGameOutcomePanel(this)

    const commandInputView = new PhaserCommandInputView()
    this.commandInputView = commandInputView
    commandInputView.setPrompt(this.promptForRoom(worldState.currentRoomId))
    commandInputView.mount(this, (rawText) => {
      const result = this.session.submitCommand(rawText)
      const feedback = result.status === 'success'
        ? result.feedback[result.feedback.length - 1]
        : result.feedback

      if (feedback) {
        this.feedbackView.present(feedback)
      }
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      commandInputView.destroy()
      this.roomView.destroy()
      this.feedbackView.destroy()
      this.outcomePanel?.destroy()
      this.outcomePanel = undefined
      if (this.commandInputView === commandInputView) {
        this.commandInputView = undefined
      }
    })
  }

  update(_time: number, delta: number): void {
    this.session.update(delta)
    const worldState = this.session.getWorldState()
    this.commandInputView?.setPrompt(this.promptForRoom(worldState.currentRoomId))
    this.roomView.update(worldState)
    this.outcomePanel?.update(worldState)
  }

  private promptForRoom(roomId: string | null): string {
    if (!roomId) {
      return '~$ '
    }

    const rootRoomName = ROOM_NAMES[ROOM_IDS.first]
    const roomName = ROOM_NAMES[roomId] ?? roomId
    const path = roomId === ROOM_IDS.first
      ? `~/${rootRoomName}`
      : `~/${rootRoomName}/${roomName}`

    return `${path}$ `
  }
}
