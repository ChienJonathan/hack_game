import type Phaser from 'phaser'
import type { WorldState } from '../domain/WorldState.ts'
import type { InputMode } from '../application/InputModeController.ts'

/** Main-game chrome. World coordinates and editor layouts remain independent. */
export class PhaserGameHud {
  private readonly root: Phaser.GameObjects.Container
  private readonly health: Phaser.GameObjects.Rectangle
  private readonly healthText: Phaser.GameObjects.Text
  private readonly modeText: Phaser.GameObjects.Text
  private readonly roomText: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(8)
    const label = (x: number, y: number, text: string, size = 20, color = '#a1b7c1') =>
      scene.add.text(x, y, text, { fontFamily: 'Consolas, monospace', fontSize: size, color })
    const panel = scene.add.rectangle(32, 760, 1016, 288, 0x101d26, 0.96)
      .setOrigin(0).setStrokeStyle(2, 0x314854)
    this.roomText = label(96, 38, '', 22, '#b7d9d1')
    const navigation = label(1824, 38, 'F2 Layout   F3 Speed   F4 AI', 18).setOrigin(1, 0)
    const name = label(64, 786, 'HACKER', 26, '#e7eee4')
    this.modeText = label(1016, 790, '', 18, '#8fd6c5').setOrigin(1, 0)
    const track = scene.add.rectangle(64, 840, 360, 14, 0x293c44).setOrigin(0)
    this.health = scene.add.rectangle(64, 840, 360, 14, 0xb97869).setOrigin(0)
    this.healthText = label(64, 866, '', 18)
    const divider = scene.add.rectangle(480, 830, 2, 166, 0x314854).setOrigin(0)
    const controls = label(516, 840, 'ARROWS       Move\nSPACE / CLICK Attack\nA–Z          Enter command\nESC          Return to movement', 20)
      .setLineSpacing(12)
    const hint = label(64, 980, 'Discover with ls. Reach the exit.', 19, '#d3c49e')
    this.root.add([panel, this.roomText, navigation, name, this.modeText, track,
      this.health, this.healthText, divider, controls, hint])
  }

  update(state: WorldState, mode: InputMode): void {
    const player = state.worldObjects.find(object => object.metadata.role === 'player')
    const data = player?.state as { health?: number; maxHealth?: number } | undefined
    const current = data?.health ?? 0
    const maximum = data?.maxHealth ?? 100
    this.health.width = 360 * Math.max(0, Math.min(1, maximum > 0 ? current / maximum : 0))
    this.healthText.setText(`HEALTH  ${Math.ceil(current)} / ${maximum}`)
    this.modeText.setText(mode === 'command' ? 'CASTING  /  ×0.25' : 'MOVEMENT  /  ×1.00')
    this.roomText.setText(`ROOM  /  ${state.currentRoomId ?? 'unknown'}`)
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
