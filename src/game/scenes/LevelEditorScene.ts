import Phaser from 'phaser'
import textboxImageUrl from '../../assets/game/ui/textbox.png'
import {
  ROOM_LAYOUT,
  WORLD_OBJECT_IDS,
  ROOM_NAMES,
  ROOM_IDS,
  CHARACTER_BASE_SIZE,
  BOULDER_BASE_SIZE,
  DAGGER_SIZE,
  GAME_WEAPON_CONFIG,
  computeDaggerAttackTranslation,
} from '../content/room1Constants.ts'
import { createInitialWorldState, computeCollisionSize } from '../content/room1WorldState.ts'
import { ROOM1_OBJECTS, type PlayerSpeedConfig, type RoomObjectConfig, type WorldObjectRole } from '../content/room1.ts'
import { generateRoom1Source } from '../content/room1Serializer.ts'
import {
  WORLD_OBJECT_TEXTURE_URLS,
  PLAYER_TEXTURE_KEY,
  GUARD_TEXTURE_KEY,
  DAGGER_TEXTURE_KEY,
  BOULDER_TEXTURE_KEY,
} from '../presentation/PhaserRoomView.ts'
import { COMMAND_INPUT_TEXTURE_KEY } from '../presentation/PhaserCommandInputView.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import {
  EditorHistory,
  computeEditorCollisionBox,
  wouldOverlapAnyEditorObject,
  type ScalableMovableObject,
  type CharacterProperty,
} from './levelEditorHistory.ts'
import { SceneManager } from './SceneManager.ts'

const FONT_FAMILY = '"Press Start 2P", monospace'
const TEXT_COLOR = '#d6d6d6'
const DIM_COLOR = '#777777'
const ACCENT_COLOR = '#4fc3f7'
const PANEL_BG = 0x1a1a1a
const SELECTED_OUTLINE = 0x4fc3f7
const HANDLE_COLOR = 0xffcc00
const HANDLE_SIZE = 16
const GRID_SNAP = 1
const PANEL_X = 96
const PANEL_Y = 720
const PANEL_WIDTH = 1728
const PANEL_HEIGHT = 290

export interface SpawnObjectConfig {
  id?: string
  x?: number
  y?: number
  displayWidth?: number
  displayHeight?: number
  scaleX?: number
  scaleY?: number
  speed?: number | PlayerSpeedConfig
  maxHealth?: number
  attackDistance?: number
  attackDurationMs?: number
  holdOffsetX?: number
  holdOffsetY?: number
}

export interface EditorObject extends ScalableMovableObject {
  role: WorldObjectRole
  sprite: Phaser.GameObjects.Image
  outline: Phaser.GameObjects.Rectangle
  collisionBox?: Phaser.GameObjects.Rectangle
  scaleHandle: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
}

export class LevelEditorScene extends Phaser.Scene {
  private editorObjects: EditorObject[] = []
  private selectedId: string | null = null
  private roomFrame!: Phaser.GameObjects.Graphics
  private roomDivider!: Phaser.GameObjects.Graphics
  private doorFrame!: Phaser.GameObjects.Graphics
  private doorLabel: Phaser.GameObjects.Text | undefined
  private panelContainer: Phaser.GameObjects.Container | undefined
  private panelFields: Map<string, Phaser.GameObjects.Text> = new Map()
  private objectListButtons: Phaser.GameObjects.Text[] = []
  private objectListTitle: Phaser.GameObjects.Text | undefined
  private deleteButton: Phaser.GameObjects.Text | undefined
  private statsElements: Phaser.GameObjects.Text[] = []
  private guardStatsElements: Phaser.GameObjects.Text[] = []
  private playerStatsElements: Phaser.GameObjects.Text[] = []
  private weaponStatsElements: Phaser.GameObjects.Text[] = []
  private testEquipBtn: Phaser.GameObjects.Text | undefined
  private testAttackBtn: Phaser.GameObjects.Text | undefined
  private testEquippedWeaponId: string | null = null
  private savedWeaponPositions: Map<string, { x: number; y: number }> = new Map()
  private testAttackAnimation: {
    weaponId: string
    elapsedMs: number
    durationMs: number
    attackDistance: number
  } | null = null
  private section3Title: Phaser.GameObjects.Text | undefined
  private naStatsText: Phaser.GameObjects.Text | undefined
  private headerText: Phaser.GameObjects.Text | undefined
  private isDraggingObject = false
  private isDraggingScaleHandle = false
  private history = new EditorHistory()
  private dragStartX = 0
  private dragStartY = 0
  private dragObjStartX = 0
  private dragObjStartY = 0
  private scaleStartWidth = 0
  private scaleStartHeight = 0
  private scaleStartScaleX = 0
  private scaleStartScaleY = 0
  private scaleStartPointerX = 0
  private scaleStartPointerY = 0
  private exportButton!: Phaser.GameObjects.Container
  private instructionText: Phaser.GameObjects.Text | undefined

  constructor() {
    super({ key: 'level-editor' })
  }

  preload(): void {
    if (!this.textures.exists(COMMAND_INPUT_TEXTURE_KEY)) {
      this.load.image(COMMAND_INPUT_TEXTURE_KEY, textboxImageUrl)
    }
    for (const [textureKey, imageUrl] of Object.entries(WORLD_OBJECT_TEXTURE_URLS)) {
      if (!this.textures.exists(textureKey)) {
        this.load.image(textureKey, imageUrl)
      }
    }
  }

  create(): void {
    this.editorObjects = []
    this.selectedId = null
    this.panelFields.clear()
    this.statsElements = []
    this.guardStatsElements = []
    this.playerStatsElements = []
    this.weaponStatsElements = []
    this.testEquipBtn = undefined
    this.testAttackBtn = undefined
    this.testEquippedWeaponId = null
    this.savedWeaponPositions.clear()
    this.testAttackAnimation = null
    this.section3Title = undefined
    this.naStatsText = undefined
    this.objectListButtons = []
    this.objectListTitle = undefined
    this.deleteButton = undefined
    this.history.clear()

    // Title
    this.headerText = this.add
      .text(ROOM_LAYOUT.left, 24, 'LEVEL EDITOR — room1', {
        fontFamily: FONT_FAMILY,
        fontSize: 20,
        color: ACCENT_COLOR,
      })
      .setOrigin(0, 0)
      .setDepth(50)

    // Draw room frame (same as PhaserRoomView)
    this.roomFrame = this.add.graphics().setDepth(0)
    this.roomFrame
      .lineStyle(4, 0x595959, 1)
      .strokeRect(
        ROOM_LAYOUT.left,
        ROOM_LAYOUT.top,
        ROOM_LAYOUT.right - ROOM_LAYOUT.left,
        ROOM_LAYOUT.bottom - ROOM_LAYOUT.top,
      )
    this.roomFrame.lineStyle(2, 0x282828, 1)
    for (let y = ROOM_LAYOUT.top + 36; y < ROOM_LAYOUT.bottom; y += 48) {
      this.roomFrame.lineBetween(ROOM_LAYOUT.left + 4, y, ROOM_LAYOUT.right - 4, y)
    }

    // Room divider
    this.roomDivider = this.add.graphics().setDepth(0)
    this.roomDivider.lineStyle(2, 0x3c3c3c, 0.8)
    for (let y = ROOM_LAYOUT.top + 8; y < ROOM_LAYOUT.bottom; y += 24) {
      this.roomDivider.lineBetween(
        ROOM_LAYOUT.rightHalfStartX,
        y,
        ROOM_LAYOUT.rightHalfStartX,
        Math.min(y + 10, ROOM_LAYOUT.bottom),
      )
    }

    // Door
    this.doorFrame = this.add.graphics().setDepth(1)
    this.doorFrame
      .fillStyle(0x101010, 1)
      .fillRect(ROOM_LAYOUT.exit.x - 42, ROOM_LAYOUT.exit.y - 84, 84, 168)
    this.doorFrame
      .lineStyle(4, 0x9a9a9a, 1)
      .strokeRect(ROOM_LAYOUT.exit.x - 42, ROOM_LAYOUT.exit.y - 84, 84, 168)
    this.doorLabel = this.add
      .text(ROOM_LAYOUT.exit.x, ROOM_LAYOUT.exit.y + 100, ROOM_NAMES[ROOM_IDS.second], {
        fontFamily: FONT_FAMILY,
        fontSize: 20,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(2)

    // Create world objects from initial state
    const worldState = createInitialWorldState()
    for (const worldObject of worldState.worldObjects) {
      this.createEditorObject(worldObject)
    }

    // Build property panel
    this.buildPropertyPanel()

    // Build export button
    this.buildExportButton()

    // Instructions
    this.instructionText = this.add
      .text(960, 1045, 'Click to select · Drag to move · Shift+Drag: Scale · Arrows: Nudge · Ctrl+Z: Undo · Del: Remove', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(50)

    // Input handlers
    this.input.on('pointerdown', this.onPointerDown, this)
    this.input.on('pointermove', this.onPointerMove, this)
    this.input.on('pointerup', this.onPointerUp, this)
    this.input.keyboard?.on('keydown', this.onKeyDown, this)

    // Back-to-game key hint
    this.add
      .text(ROOM_LAYOUT.right, 26, 'P: Panel · F3: Speed · F4: AI Editor · F2 / ESC: Game', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: DIM_COLOR,
      })
      .setOrigin(1, 0)
      .setDepth(50)

    // Select the first object by default
    if (this.editorObjects.length > 0) {
      this.selectObject(this.editorObjects[0].id)
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.onPointerDown, this)
      this.input.off('pointermove', this.onPointerMove, this)
      this.input.off('pointerup', this.onPointerUp, this)
      this.input.keyboard?.off('keydown', this.onKeyDown, this)
      this.headerText?.destroy()
      this.doorLabel?.destroy()
      this.instructionText?.destroy()
      this.panelContainer?.destroy(true)
      this.exportButton?.destroy(true)
      for (const obj of this.editorObjects) {
        obj.sprite.destroy()
        obj.outline.destroy()
        obj.scaleHandle.destroy()
        obj.label.destroy()
      }
      this.editorObjects = []
      this.panelFields.clear()
      this.statsElements = []
      this.guardStatsElements = []
      this.playerStatsElements = []
      this.weaponStatsElements = []
      if (this.testEquippedWeaponId) {
        this.testUnequip(this.testEquippedWeaponId)
      }
      this.testEquippedWeaponId = null
      this.savedWeaponPositions.clear()
      this.testAttackAnimation = null
      this.testEquipBtn = undefined
      this.testAttackBtn = undefined
      this.section3Title = undefined
      this.naStatsText = undefined
      this.objectListButtons = []
      this.objectListTitle = undefined
      this.deleteButton = undefined
    })
  }

  update(_time: number, delta: number): void {
    if (this.testAttackAnimation) {
      this.testAttackAnimation.elapsedMs += delta
      const { weaponId, elapsedMs, durationMs, attackDistance } = this.testAttackAnimation
      const weapon = this.editorObjects.find((o) => o.id === weaponId)
      if (weapon) {
        if (elapsedMs >= durationMs) {
          this.testAttackAnimation = null
          if (this.testEquippedWeaponId === weapon.id) {
            this.updateEquippedWeaponPosition(weapon)
          } else {
            this.updateObjectVisuals(weapon)
          }
        } else {
          const translation = computeDaggerAttackTranslation(elapsedMs, durationMs, attackDistance)
          if (this.testEquippedWeaponId === weapon.id) {
            this.updateEquippedWeaponPosition(weapon, undefined, translation)
          } else {
            weapon.sprite.setPosition(weapon.x + translation, weapon.y)
            weapon.outline.setPosition(weapon.x + translation, weapon.y)
            weapon.scaleHandle.setPosition(
              weapon.x + translation + weapon.displayWidth / 2,
              weapon.y + weapon.displayHeight / 2,
            )
            weapon.label.setPosition(weapon.x + translation, weapon.y - weapon.displayHeight / 2 - 20)
          }
        }
      } else {
        this.testAttackAnimation = null
      }
    }
  }

  private createEditorObject(worldObject: WorldObject): void {
    const state = worldObject.state as Record<string, unknown>
    const x = typeof state.x === 'number' ? state.x : 0
    const y = typeof state.y === 'number' ? state.y : 0
    const textureKey = this.textureKeyFor(worldObject)
    if (!textureKey) return

    const rawRole = worldObject.metadata.role
    const role: WorldObjectRole =
      rawRole === 'weapon'
        ? 'weapon'
        : rawRole === 'guard' || rawRole === 'enemy'
          ? 'enemy'
          : rawRole === 'object'
            ? 'object'
            : 'player'

    const isWeapon = role === 'weapon'
    const isCharacter = role === 'player' || role === 'enemy'
    const maxHealth = isCharacter && typeof state.maxHealth === 'number' ? state.maxHealth : (isCharacter ? 100 : undefined)
    const speed = isCharacter
      ? (typeof state.speed === 'number' || (typeof state.speed === 'object' && state.speed !== null))
        ? (state.speed as number | PlayerSpeedConfig)
        : (role === 'player'
            ? { acceleration: 800, frictionAcceleration: 1200, turnaroundAcceleration: 1600, maxSpeed: 240 }
            : 210)
      : undefined
    const speedConfig = typeof speed === 'object' && speed !== null ? speed : undefined
    const maxSpeed = speedConfig?.maxSpeed ?? (typeof speed === 'number' ? speed : undefined)
    const acceleration = speedConfig?.acceleration
    const frictionAcceleration = speedConfig?.frictionAcceleration
    const turnaroundAcceleration = speedConfig?.turnaroundAcceleration
    const roomObj = ROOM1_OBJECTS.find((o) => o.id === worldObject.id)
    const attackDistance = isWeapon
      ? typeof state.weaponAttackDistance === 'number'
        ? state.weaponAttackDistance
        : typeof state.attackDistance === 'number'
          ? state.attackDistance
          : (roomObj?.attackDistance ?? GAME_WEAPON_CONFIG.attackDistance)
      : undefined
    const attackDurationMs = isWeapon
      ? typeof state.weaponAttackDurationMs === 'number'
        ? state.weaponAttackDurationMs
        : typeof state.attackDurationMs === 'number'
          ? state.attackDurationMs
          : (roomObj?.attackDurationMs ?? GAME_WEAPON_CONFIG.attackDurationMs)
      : undefined
    const holdOffsetX = isWeapon
      ? typeof state.holdOffsetX === 'number'
        ? state.holdOffsetX
        : (roomObj?.holdOffsetX ?? GAME_WEAPON_CONFIG.holdOffsetX)
      : undefined
    const holdOffsetY = isWeapon
      ? typeof state.holdOffsetY === 'number'
        ? state.holdOffsetY
        : (roomObj?.holdOffsetY ?? GAME_WEAPON_CONFIG.holdOffsetY)
      : undefined
    const defaultBaseWidth = isWeapon
      ? DAGGER_SIZE.width
      : (role === 'object' ? BOULDER_BASE_SIZE.width : CHARACTER_BASE_SIZE.width)
    const defaultBaseHeight = isWeapon
      ? DAGGER_SIZE.height
      : (role === 'object' ? BOULDER_BASE_SIZE.height : CHARACTER_BASE_SIZE.height)

    const displayWidth = typeof state.displayWidth === 'number'
      ? state.displayWidth
      : defaultBaseWidth
    const displayHeight = typeof state.displayHeight === 'number'
      ? state.displayHeight
      : defaultBaseHeight

    const scaleX = typeof state.scaleX === 'number'
      ? state.scaleX
      : displayWidth / defaultBaseWidth
    const scaleY = typeof state.scaleY === 'number'
      ? state.scaleY
      : displayHeight / defaultBaseHeight

    const baseWidth = scaleX !== 0 ? displayWidth / scaleX : defaultBaseWidth
    const baseHeight = scaleY !== 0 ? displayHeight / scaleY : defaultBaseHeight

    const sprite = this.add.image(x, y, textureKey).setDepth(3)
    sprite.setDisplaySize(displayWidth, displayHeight)
    sprite.setAlpha(0.9)

    // Selection outline
    const outline = this.add
      .rectangle(x, y, displayWidth + 8, displayHeight + 8)
      .setStrokeStyle(3, SELECTED_OUTLINE, 1)
      .setFillStyle(SELECTED_OUTLINE, 0.08)
      .setDepth(2)
      .setVisible(false)

    // Collision box (added for all world objects besides weapon)
    let collisionBox: Phaser.GameObjects.Rectangle | undefined
    if (role !== 'weapon') {
      const collSize = computeCollisionSize(role, scaleX, scaleY)
      collisionBox = this.add
        .rectangle(x, y, collSize.width, collSize.height)
        .setStrokeStyle(2, 0x00e676, 0.9)
        .setFillStyle(0x00e676, 0.12)
        .setDepth(2)
    }

    // Scale handle (bottom-right corner)
    const scaleHandle = this.add
      .rectangle(
        x + displayWidth / 2,
        y + displayHeight / 2,
        HANDLE_SIZE,
        HANDLE_SIZE,
        HANDLE_COLOR,
        1,
      )
      .setDepth(5)
      .setVisible(false)

    // Object label
    const label = this.add
      .text(x, y - displayHeight / 2 - 20, worldObject.id, {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5, 1)
      .setDepth(4)

    const editorObject: EditorObject = {
      id: worldObject.id,
      role,
      sprite,
      outline,
      collisionBox,
      scaleHandle,
      label,
      x,
      y,
      displayWidth,
      displayHeight,
      baseWidth,
      baseHeight,
      scaleX,
      scaleY,
      maxHealth,
      speed,
      maxSpeed,
      acceleration,
      frictionAcceleration,
      turnaroundAcceleration,
      attackDistance,
      attackDurationMs,
      holdOffsetX,
      holdOffsetY,
    }

    this.editorObjects.push(editorObject)
  }

  private buildPropertyPanel(): void {
    const bg = this.add
      .rectangle(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, PANEL_BG, 0.92)
      .setStrokeStyle(2, 0x444444, 1)

    const items: Phaser.GameObjects.GameObject[] = [bg]

    // Vertical dividers between 5 sections
    const dividerGraphics = this.add.graphics()
    dividerGraphics.lineStyle(2, 0x333333, 1)
    dividerGraphics.lineBetween(280, 20, 280, PANEL_HEIGHT - 20)
    dividerGraphics.lineBetween(680, 20, 680, PANEL_HEIGHT - 20)
    dividerGraphics.lineBetween(1100, 20, 1100, PANEL_HEIGHT - 20)
    dividerGraphics.lineBetween(1420, 20, 1420, PANEL_HEIGHT - 20)
    items.push(dividerGraphics)

    // ─── Section 1: Object Selector & Spawning ───
    this.objectListTitle = this.add
      .text(140, 16, 'OBJECTS', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(this.objectListTitle)

    // Spawn buttons
    const spawnGuardBtn = this.add
      .text(75, 42, '+ GUARD', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: '#ffffff',
        backgroundColor: '#1b5e20',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    spawnGuardBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.spawnWorldObject('enemy')
    })
    items.push(spawnGuardBtn)

    const spawnDaggerBtn = this.add
      .text(205, 42, '+ DAGGER', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: '#ffffff',
        backgroundColor: '#0d47a1',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    spawnDaggerBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.spawnWorldObject('weapon')
    })
    items.push(spawnDaggerBtn)

    // Remove selected object button
    this.deleteButton = this.add
      .text(140, 248, 'REMOVE SELECTED', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: '#ffcdd2',
        backgroundColor: '#b71c1c',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .setVisible(false)
    this.deleteButton.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      if (this.selectedId) {
        this.despawnWorldObject(this.selectedId)
      }
    })
    items.push(this.deleteButton)

    // ─── Section 2: Transform Readout ───
    const section2Title = this.add
      .text(480, 24, 'TRANSFORM', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(section2Title)

    const leftFields = ['x', 'y', 'width']
    const rightFields = ['scaleX', 'scaleY', 'height']

    for (let i = 0; i < leftFields.length; i++) {
      const field = leftFields[i]
      const fY = 75 + i * 56

      const label = this.add
        .text(310, fY, `${field}:`, {
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          color: DIM_COLOR,
        })
        .setOrigin(0, 0)

      const val = this.add
        .text(460, fY, '--', {
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          color: TEXT_COLOR,
        })
        .setOrigin(1, 0)

      items.push(label, val)
      this.panelFields.set(`val_${field}`, val)
    }

    for (let i = 0; i < rightFields.length; i++) {
      const field = rightFields[i]
      const fY = 75 + i * 56

      const label = this.add
        .text(490, fY, `${field}:`, {
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          color: DIM_COLOR,
        })
        .setOrigin(0, 0)

      const val = this.add
        .text(650, fY, '--', {
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          color: TEXT_COLOR,
        })
        .setOrigin(1, 0)

      items.push(label, val)
      this.panelFields.set(`val_${field}`, val)
    }

    // ─── Section 3: Stats (Editable for player, guard & weapon) ───
    this.section3Title = this.add
      .text(890, 24, 'CHARACTER STATS', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(this.section3Title)

    this.naStatsText = this.add
      .text(890, 115, '(No editable stats)', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
      .setVisible(false)
    items.push(this.naStatsText)

    this.statsElements = []
    this.guardStatsElements = []
    this.playerStatsElements = []
    this.weaponStatsElements = []

    const createStatRow = (
      labelName: string,
      fieldKey: string,
      property: CharacterProperty,
      y: number,
      targetArray: Phaser.GameObjects.Text[],
    ) => {
      const label = this.add
        .text(705, y + 2, `${labelName}:`, {
          fontFamily: FONT_FAMILY,
          fontSize: 13,
          color: DIM_COLOR,
        })
        .setOrigin(0, 0)

      const val = this.add
        .text(910, y + 2, '--', {
          fontFamily: FONT_FAMILY,
          fontSize: 13,
          color: ACCENT_COLOR,
          backgroundColor: '#2a2a2a',
          padding: { x: 8, y: 3 },
        })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true })
      val.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.()
        this.promptProperty(property)
      })

      const minusBtn = this.createPanelButton(945, y, '−', (pointer) => {
        this.adjustProperty(property, pointer.event?.shiftKey ? -50 : -10)
      })
      const plusBtn = this.createPanelButton(995, y, '+', (pointer) => {
        this.adjustProperty(property, pointer.event?.shiftKey ? 50 : 10)
      })

      this.panelFields.set(`val_${fieldKey}`, val)
      targetArray.push(label, val, minusBtn, plusBtn)
      items.push(label, val, minusBtn, plusBtn)
    }

    createStatRow('max_health', 'maxHealth', 'maxHealth', 50, this.statsElements)
    createStatRow('speed', 'speed', 'speed', 86, this.guardStatsElements)

    const openAiEditorBtn = this.add
      .text(890, 134, 'AI EDITOR (F4)', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: '#ffffff',
        backgroundColor: '#4a148c',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    openAiEditorBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.openAiEditor()
    })

    const guardAiHint = this.add
      .text(890, 184, 'Edit & simulate behavior tree', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
        align: 'center',
      })
      .setOrigin(0.5, 0)

    this.guardStatsElements.push(openAiEditorBtn, guardAiHint)
    items.push(openAiEditorBtn, guardAiHint)

    // Player speed summary & Speed Editor launcher (speed adjust panel moved to SpeedEditor)
    const playerSpeedLabel = this.add
      .text(705, 90, 'speed:', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    const playerSpeedVal = this.add
      .text(1075, 90, '--', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: ACCENT_COLOR,
      })
      .setOrigin(1, 0)
    this.panelFields.set('val_player_speed_summary', playerSpeedVal)

    const openSpeedEditorBtn = this.add
      .text(890, 134, 'OPEN SPEED EDITOR (F3)', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: '#ffffff',
        backgroundColor: '#00695c',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    openSpeedEditorBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.openSpeedEditor()
    })

    const playerSpeedHint = this.add
      .text(890, 184, 'Tune physics & test live movement', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
        align: 'center',
      })
      .setOrigin(0.5, 0)

    this.playerStatsElements.push(playerSpeedLabel, playerSpeedVal, openSpeedEditorBtn, playerSpeedHint)
    items.push(playerSpeedLabel, playerSpeedVal, openSpeedEditorBtn, playerSpeedHint)

    // Stats hints
    const statHint1 = this.add
      .text(890, 238, 'Click +/- (10) · Shift (50)', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
    const statHint2 = this.add
      .text(890, 260, 'Click number to set exact', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
    this.statsElements.push(statHint1, statHint2)
    items.push(statHint1, statHint2)

    // Weapon stats rows
    createStatRow('attack_dist', 'attackDistance', 'attackDistance', 50, this.weaponStatsElements)
    createStatRow('attack_dur', 'attackDurationMs', 'attackDurationMs', 86, this.weaponStatsElements)
    createStatRow('hold_offset_x', 'holdOffsetX', 'holdOffsetX', 122, this.weaponStatsElements)
    createStatRow('hold_offset_y', 'holdOffsetY', 'holdOffsetY', 158, this.weaponStatsElements)

    this.testEquipBtn = this.add
      .text(795, 196, 'TEST EQUIP', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: '#ffffff',
        backgroundColor: '#00695c',
        padding: { x: 10, y: 7 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    this.testEquipBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.toggleTestEquip()
    })

    this.testAttackBtn = this.add
      .text(985, 196, 'TEST ATTACK', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: '#ffffff',
        backgroundColor: '#c62828',
        padding: { x: 10, y: 7 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    this.testAttackBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.testAttack()
    })

    const weaponHint1 = this.add
      .text(890, 238, 'Click +/- (10) · Shift (50)', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
    const weaponHint2 = this.add
      .text(890, 258, 'Click number to set exact', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)

    this.panelFields.set('btn_test_equip', this.testEquipBtn)
    this.panelFields.set('btn_test_attack', this.testAttackBtn)

    this.weaponStatsElements.push(this.testEquipBtn, this.testAttackBtn, weaponHint1, weaponHint2)
    items.push(this.testEquipBtn, this.testAttackBtn, weaponHint1, weaponHint2)
    this.weaponStatsElements.forEach((el) => el.setVisible(false))

    // ─── Section 4: Scale & Nudge ───
    const section4Title = this.add
      .text(1260, 24, 'SCALE & NUDGE', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(section4Title)

    const scalePlusBtn = this.createPanelButton(1200, 72, 'SCALE +', () =>
      this.scaleSelected(1.1),
    )
    const scaleMinusBtn = this.createPanelButton(1320, 72, 'SCALE -', () =>
      this.scaleSelected(1 / 1.1),
    )
    items.push(scalePlusBtn, scaleMinusBtn)

    const hints = [
      'Nudge: Arrow keys',
      'Shift: 10px step',
    ]
    for (let i = 0; i < hints.length; i++) {
      const hint = this.add
        .text(1260, 138 + i * 34, hints[i], {
          fontFamily: FONT_FAMILY,
          fontSize: 13,
          color: DIM_COLOR,
        })
        .setOrigin(0.5, 0)
      items.push(hint)
    }

    // ─── Section 5: Save ───
    const section5Title = this.add
      .text(1574, 24, 'SAVE', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    const exportDesc = this.add
      .text(1574, 75, 'Overwrite room1.ts directly:', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(section5Title, exportDesc)

    this.panelContainer = this.add.container(PANEL_X, PANEL_Y, items).setDepth(40)
    this.refreshObjectList()
  }

  private createPanelButton(
    x: number,
    y: number,
    text: string,
    onClick: (pointer: Phaser.Input.Pointer) => void,
  ): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: TEXT_COLOR,
        backgroundColor: '#333333',
        padding: { x: 12, y: 7 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      onClick(pointer)
    })
    return btn
  }

  private buildExportButton(): void {
    const btnX = PANEL_X + 1574
    const btnY = PANEL_Y + 140
    const bg = this.add
      .rectangle(0, 0, 260, 48, 0x2e7d32, 1)
      .setStrokeStyle(2, 0x66bb6a, 1)
    const label = this.add
      .text(0, 0, 'SAVE TO ROOM1.TS', {
        fontFamily: FONT_FAMILY,
        fontSize: 15,
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)

    this.exportButton = this.add
      .container(btnX, btnY, [bg, label])
      .setDepth(50)
      .setSize(260, 48)
      .setInteractive({ useHandCursor: true })
    this.exportButton.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.saveLayout()
    })
  }

  private selectObject(id: string): void {
    this.selectedId = id
    for (const obj of this.editorObjects) {
      const isSelected = obj.id === id
      obj.outline.setVisible(isSelected)
      obj.scaleHandle.setVisible(isSelected)
      obj.sprite.setAlpha(isSelected ? 1 : 0.7)

      // Highlight the panel button
      const btn = this.panelFields.get(`btn_${obj.id}`)
      if (btn) {
        btn.setColor(isSelected ? ACCENT_COLOR : TEXT_COLOR)
      }
    }
    this.updateDeleteButtonVisibility()
    this.updatePropertyPanel()
  }

  private updatePropertyPanel(): void {
    const selected = this.getSelected()
    const setField = (key: string, value: string) => {
      const text = this.panelFields.get(`val_${key}`)
      if (text) text.setText(value)
    }

    if (!selected) {
      for (const field of [
        'x',
        'y',
        'width',
        'height',
        'scaleX',
        'scaleY',
        'maxHealth',
        'speed',
        'player_speed_summary',
        'attackDistance',
        'attackDurationMs',
        'holdOffsetX',
        'holdOffsetY',
      ]) {
        setField(field, '--')
      }
      this.section3Title?.setText('CHARACTER STATS')
      this.statsElements.forEach((el) => el.setVisible(false))
      this.guardStatsElements.forEach((el) => el.setVisible(false))
      this.playerStatsElements.forEach((el) => el.setVisible(false))
      this.weaponStatsElements.forEach((el) => el.setVisible(false))
      this.naStatsText?.setVisible(false)
      return
    }

    const savedPos = this.savedWeaponPositions.get(selected.id)
    const displayX = savedPos ? savedPos.x : selected.x
    const displayY = savedPos ? savedPos.y : selected.y
    setField('x', Math.round(displayX).toString())
    setField('y', Math.round(displayY).toString())
    setField('width', Math.round(selected.displayWidth).toString())
    setField('height', Math.round(selected.displayHeight).toString())
    setField('scaleX', selected.scaleX.toFixed(2))
    setField('scaleY', selected.scaleY.toFixed(2))

    const isCharacter =
      selected.maxHealth !== undefined &&
      (selected.speed !== undefined || selected.maxSpeed !== undefined)

    if (isCharacter) {
      this.section3Title?.setText('CHARACTER STATS')
      setField('maxHealth', selected.maxHealth!.toString())
      setField('attackDistance', '--')
      setField('attackDurationMs', '--')
      setField('holdOffsetX', '--')
      setField('holdOffsetY', '--')
      this.statsElements.forEach((el) => el.setVisible(true))
      this.weaponStatsElements.forEach((el) => el.setVisible(false))
      this.naStatsText?.setVisible(false)

      if (selected.role === 'player') {
        this.guardStatsElements.forEach((el) => el.setVisible(false))
        this.playerStatsElements.forEach((el) => el.setVisible(true))
        const maxSpd =
          selected.maxSpeed ??
          (typeof selected.speed === 'object' && selected.speed !== null
            ? selected.speed.maxSpeed
            : typeof selected.speed === 'number'
              ? selected.speed
              : 300)
        const accel =
          selected.acceleration ??
          (typeof selected.speed === 'object' && selected.speed !== null
            ? selected.speed.acceleration
            : 2500)
        setField('player_speed_summary', `max:${maxSpd} acc:${accel}`)
      } else {
        this.guardStatsElements.forEach((el) => el.setVisible(true))
        this.playerStatsElements.forEach((el) => el.setVisible(false))
        const spd = typeof selected.speed === 'number' ? selected.speed : (selected.maxSpeed ?? 210)
        setField('speed', spd.toString())
      }
    } else if (selected.role === 'weapon') {
      this.section3Title?.setText('WEAPON STATS')
      setField('maxHealth', '--')
      setField('speed', '--')
      setField('player_speed_summary', '--')
      this.statsElements.forEach((el) => el.setVisible(false))
      this.guardStatsElements.forEach((el) => el.setVisible(false))
      this.playerStatsElements.forEach((el) => el.setVisible(false))
      this.naStatsText?.setVisible(false)
      this.weaponStatsElements.forEach((el) => el.setVisible(true))

      const attackDist = selected.attackDistance ?? GAME_WEAPON_CONFIG.attackDistance
      const attackDur = selected.attackDurationMs ?? GAME_WEAPON_CONFIG.attackDurationMs
      const holdX = selected.holdOffsetX ?? GAME_WEAPON_CONFIG.holdOffsetX
      const holdY = selected.holdOffsetY ?? GAME_WEAPON_CONFIG.holdOffsetY

      setField('attackDistance', attackDist.toString())
      setField('attackDurationMs', attackDur.toString())
      setField('holdOffsetX', holdX.toString())
      setField('holdOffsetY', holdY.toString())
      this.updateTestEquipButtonState()
    } else {
      this.section3Title?.setText('STATS')
      setField('maxHealth', '--')
      setField('speed', '--')
      setField('player_speed_summary', '--')
      setField('attackDistance', '--')
      setField('attackDurationMs', '--')
      setField('holdOffsetX', '--')
      setField('holdOffsetY', '--')
      this.statsElements.forEach((el) => el.setVisible(false))
      this.guardStatsElements.forEach((el) => el.setVisible(false))
      this.playerStatsElements.forEach((el) => el.setVisible(false))
      this.weaponStatsElements.forEach((el) => el.setVisible(false))
      this.naStatsText?.setVisible(true)
    }
  }

  private adjustProperty(property: CharacterProperty, delta: number): void {
    const selected = this.getSelected()
    if (!selected) return

    let prevValue = selected[property] as number | undefined
    if (prevValue === undefined) {
      if (property === 'maxSpeed') {
        prevValue =
          typeof selected.speed === 'number'
            ? selected.speed
            : typeof selected.speed === 'object' && selected.speed !== null
              ? selected.speed.maxSpeed
              : 240
      } else if (property === 'speed') {
        prevValue = typeof selected.speed === 'number' ? selected.speed : 210
      } else if (property === 'acceleration') {
        prevValue =
          typeof selected.speed === 'object' && selected.speed !== null
            ? selected.speed.acceleration
            : 800
      } else if (property === 'frictionAcceleration') {
        prevValue =
          typeof selected.speed === 'object' && selected.speed !== null
            ? (selected.speed.frictionAcceleration ?? 1200)
            : 1200
      } else if (property === 'turnaroundAcceleration') {
        prevValue =
          typeof selected.speed === 'object' && selected.speed !== null
            ? selected.speed.turnaroundAcceleration
            : 1600
      } else if (property === 'attackDistance') {
        prevValue = GAME_WEAPON_CONFIG.attackDistance
      } else if (property === 'attackDurationMs') {
        prevValue = GAME_WEAPON_CONFIG.attackDurationMs
      } else if (property === 'holdOffsetX') {
        prevValue = GAME_WEAPON_CONFIG.holdOffsetX
      } else if (property === 'holdOffsetY') {
        prevValue = GAME_WEAPON_CONFIG.holdOffsetY
      }
    }
    if (prevValue === undefined) return

    let min = 10
    if (property === 'maxHealth') {
      min = 1
    } else if (property === 'attackDistance') {
      min = 0
    } else if (property === 'attackDurationMs') {
      min = 10
    } else if (property === 'holdOffsetX' || property === 'holdOffsetY') {
      min = -200
    }
    const nextValue = Math.max(min, prevValue + delta)
    if (nextValue === prevValue) return

    selected[property] = nextValue
    if (typeof selected.speed === 'object' && selected.speed !== null) {
      if (property === 'maxSpeed') selected.speed.maxSpeed = nextValue
      if (property === 'acceleration') selected.speed.acceleration = nextValue
      if (property === 'frictionAcceleration') selected.speed.frictionAcceleration = nextValue
      if (property === 'turnaroundAcceleration') selected.speed.turnaroundAcceleration = nextValue
    }
    if (property === 'attackDistance') GAME_WEAPON_CONFIG.attackDistance = nextValue
    if (property === 'attackDurationMs') GAME_WEAPON_CONFIG.attackDurationMs = nextValue
    if (property === 'holdOffsetX') GAME_WEAPON_CONFIG.holdOffsetX = nextValue
    if (property === 'holdOffsetY') GAME_WEAPON_CONFIG.holdOffsetY = nextValue

    if (this.testEquippedWeaponId === selected.id) {
      this.updateEquippedWeaponPosition(selected)
    }

    this.history.push({
      type: 'property',
      objectId: selected.id,
      property,
      delta: nextValue - prevValue,
      prevValue,
      nextValue,
    })

    this.updatePropertyPanel()
  }

  private promptProperty(property: CharacterProperty): void {
    const selected = this.getSelected()
    if (!selected) return

    let prevValue = selected[property] as number | undefined
    if (prevValue === undefined) {
      if (property === 'maxSpeed') {
        prevValue =
          typeof selected.speed === 'number'
            ? selected.speed
            : typeof selected.speed === 'object' && selected.speed !== null
              ? selected.speed.maxSpeed
              : 240
      } else if (property === 'speed') {
        prevValue = typeof selected.speed === 'number' ? selected.speed : 210
      } else if (property === 'acceleration') {
        prevValue =
          typeof selected.speed === 'object' && selected.speed !== null
            ? selected.speed.acceleration
            : 800
      } else if (property === 'frictionAcceleration') {
        prevValue =
          typeof selected.speed === 'object' && selected.speed !== null
            ? (selected.speed.frictionAcceleration ?? 1200)
            : 1200
      } else if (property === 'turnaroundAcceleration') {
        prevValue =
          typeof selected.speed === 'object' && selected.speed !== null
            ? selected.speed.turnaroundAcceleration
            : 1600
      } else if (property === 'attackDistance') {
        prevValue = GAME_WEAPON_CONFIG.attackDistance
      } else if (property === 'attackDurationMs') {
        prevValue = GAME_WEAPON_CONFIG.attackDurationMs
      } else if (property === 'holdOffsetX') {
        prevValue = GAME_WEAPON_CONFIG.holdOffsetX
      } else if (property === 'holdOffsetY') {
        prevValue = GAME_WEAPON_CONFIG.holdOffsetY
      }
    }
    if (prevValue === undefined) return

    const label =
      property === 'maxHealth'
        ? 'max_health'
        : property === 'maxSpeed'
          ? 'max_speed'
          : property === 'frictionAcceleration'
            ? 'friction_accel'
            : property === 'turnaroundAcceleration'
              ? 'turnaround_accel'
              : property === 'attackDistance'
                ? 'attack_dist'
                : property === 'attackDurationMs'
                  ? 'attack_dur'
                  : property === 'holdOffsetX'
                    ? 'hold_offset_x'
                    : property === 'holdOffsetY'
                      ? 'hold_offset_y'
                      : property
    const input = window.prompt(`Enter new ${label} for ${selected.id}:`, prevValue.toString())
    if (input === null) return

    const parsed = parseInt(input.trim(), 10)
    let min = 10
    if (property === 'maxHealth') {
      min = 1
    } else if (property === 'attackDistance') {
      min = 0
    } else if (property === 'attackDurationMs') {
      min = 10
    } else if (property === 'holdOffsetX' || property === 'holdOffsetY') {
      min = -200
    }
    if (isNaN(parsed) || parsed < min) return

    const nextValue = parsed
    if (nextValue === prevValue) return

    selected[property] = nextValue
    if (typeof selected.speed === 'object' && selected.speed !== null) {
      if (property === 'maxSpeed') selected.speed.maxSpeed = nextValue
      if (property === 'acceleration') selected.speed.acceleration = nextValue
      if (property === 'frictionAcceleration') selected.speed.frictionAcceleration = nextValue
      if (property === 'turnaroundAcceleration') selected.speed.turnaroundAcceleration = nextValue
    }
    if (property === 'attackDistance') GAME_WEAPON_CONFIG.attackDistance = nextValue
    if (property === 'attackDurationMs') GAME_WEAPON_CONFIG.attackDurationMs = nextValue
    if (property === 'holdOffsetX') GAME_WEAPON_CONFIG.holdOffsetX = nextValue
    if (property === 'holdOffsetY') GAME_WEAPON_CONFIG.holdOffsetY = nextValue

    if (this.testEquippedWeaponId === selected.id) {
      this.updateEquippedWeaponPosition(selected)
    }

    this.history.push({
      type: 'property',
      objectId: selected.id,
      property,
      delta: nextValue - prevValue,
      prevValue,
      nextValue,
    })

    this.updatePropertyPanel()
  }

  private getSelected(): EditorObject | undefined {
    return this.editorObjects.find((obj) => obj.id === this.selectedId)
  }

  public getCollisionBox(
    role: WorldObjectRole,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
  ): { x: number; y: number; width: number; height: number } | null {
    return computeEditorCollisionBox(role, x, y, scaleX, scaleY)
  }

  public wouldOverlapAny(
    objectId: string,
    x: number,
    y: number,
    scaleX?: number,
    scaleY?: number,
  ): boolean {
    const targetObj = this.editorObjects.find((o) => o.id === objectId)
    const role = targetObj?.role ?? 'enemy'
    const sX = scaleX ?? targetObj?.scaleX ?? 1
    const sY = scaleY ?? targetObj?.scaleY ?? 1
    return wouldOverlapAnyEditorObject(objectId, role, x, y, sX, sY, this.editorObjects)
  }

  private updateObjectVisuals(obj: EditorObject): void {
    obj.sprite.setPosition(obj.x, obj.y)
    obj.sprite.setDisplaySize(obj.displayWidth, obj.displayHeight)
    obj.outline.setPosition(obj.x, obj.y)
    obj.outline.setSize(obj.displayWidth + 8, obj.displayHeight + 8)
    if (obj.collisionBox) {
      const collSize = computeCollisionSize(obj.role, obj.scaleX, obj.scaleY)
      obj.collisionBox.setPosition(obj.x, obj.y)
      obj.collisionBox.setSize(collSize.width, collSize.height)
      obj.collisionBox.setVisible(obj.sprite.visible)
    }
    obj.scaleHandle.setPosition(
      obj.x + obj.displayWidth / 2,
      obj.y + obj.displayHeight / 2,
    )
    obj.label.setPosition(obj.x, obj.y - obj.displayHeight / 2 - 20)
  }

  public toggleTestEquip(weaponId?: string): void {
    const id = weaponId ?? this.selectedId
    if (!id) return
    const weapon = this.editorObjects.find((o) => o.id === id && o.role === 'weapon')
    if (!weapon) return

    if (this.testEquippedWeaponId === weapon.id) {
      this.testUnequip(weapon.id)
    } else {
      this.testEquip(weapon.id)
    }
  }

  public testEquip(weaponId: string): void {
    const weapon = this.editorObjects.find((o) => o.id === weaponId && o.role === 'weapon')
    if (!weapon) return
    const player = this.editorObjects.find((o) => o.role === 'player')
    if (!player) return

    if (this.testEquippedWeaponId && this.testEquippedWeaponId !== weapon.id) {
      this.testUnequip(this.testEquippedWeaponId)
    }

    if (!this.savedWeaponPositions.has(weapon.id)) {
      this.savedWeaponPositions.set(weapon.id, { x: weapon.x, y: weapon.y })
    }

    this.testEquippedWeaponId = weapon.id
    this.updateEquippedWeaponPosition(weapon, player)
    this.updateTestEquipButtonState()
    this.updatePropertyPanel()
  }

  public testUnequip(weaponId: string): void {
    this.stopTestAttack()
    const weapon = this.editorObjects.find((o) => o.id === weaponId)
    const saved = this.savedWeaponPositions.get(weaponId)
    if (weapon && saved) {
      weapon.x = saved.x
      weapon.y = saved.y
      this.updateObjectVisuals(weapon)
    }
    this.savedWeaponPositions.delete(weaponId)
    if (this.testEquippedWeaponId === weaponId) {
      this.testEquippedWeaponId = null
    }
    this.updateTestEquipButtonState()
    this.updatePropertyPanel()
  }

  public testAttack(weaponId?: string): void {
    const id = weaponId ?? this.selectedId
    if (!id) return
    const weapon = this.editorObjects.find((o) => o.id === id && o.role === 'weapon')
    if (!weapon) return

    if (this.testEquippedWeaponId !== weapon.id) {
      this.testEquip(weapon.id)
    }

    this.stopTestAttack()

    const durationMs = weapon.attackDurationMs ?? GAME_WEAPON_CONFIG.attackDurationMs
    const attackDistance = weapon.attackDistance ?? GAME_WEAPON_CONFIG.attackDistance

    this.testAttackAnimation = {
      weaponId: weapon.id,
      elapsedMs: 0,
      durationMs,
      attackDistance,
    }
  }

  public stopTestAttack(): void {
    if (this.testAttackAnimation) {
      const weapon = this.editorObjects.find((o) => o.id === this.testAttackAnimation?.weaponId)
      this.testAttackAnimation = null
      if (weapon) {
        if (this.testEquippedWeaponId === weapon.id) {
          this.updateEquippedWeaponPosition(weapon)
        } else {
          this.updateObjectVisuals(weapon)
        }
      }
    }
  }

  public updateEquippedWeaponPosition(
    weapon: EditorObject,
    player?: EditorObject,
    attackTranslation = 0,
  ): void {
    const p = player ?? this.editorObjects.find((o) => o.role === 'player')
    if (!p) return
    const holdX = weapon.holdOffsetX ?? GAME_WEAPON_CONFIG.holdOffsetX
    const holdY = weapon.holdOffsetY ?? GAME_WEAPON_CONFIG.holdOffsetY
    weapon.x = p.x + holdX + attackTranslation
    weapon.y = p.y + holdY
    this.updateObjectVisuals(weapon)
  }

  private updateTestEquipButtonState(): void {
    if (!this.testEquipBtn) return
    const selected = this.getSelected()
    const isEquipped = selected && this.testEquippedWeaponId === selected.id
    this.testEquipBtn.setText(isEquipped ? 'TEST UNEQUIP' : 'TEST EQUIP')
    this.testEquipBtn.setBackgroundColor(isEquipped ? '#d84315' : '#00695c')
  }

  private scaleSelected(factor: number): void {
    const selected = this.getSelected()
    if (!selected) return

    const prevScaleX = selected.scaleX
    const prevScaleY = selected.scaleY
    const prevDisplayWidth = selected.displayWidth
    const prevDisplayHeight = selected.displayHeight

    const nextScaleX = selected.scaleX * factor
    const nextScaleY = selected.scaleY * factor
    const nextDisplayWidth = Math.max(16, Math.round(selected.baseWidth * nextScaleX))
    const nextDisplayHeight = Math.max(16, Math.round(selected.baseHeight * nextScaleY))

    if (selected.role !== 'weapon' && this.wouldOverlapAny(selected.id, selected.x, selected.y, nextScaleX, nextScaleY)) {
      return
    }

    selected.scaleX = nextScaleX
    selected.scaleY = nextScaleY
    selected.displayWidth = nextDisplayWidth
    selected.displayHeight = nextDisplayHeight

    this.history.push({
      type: 'scale',
      objectId: selected.id,
      factor,
      prevScaleX,
      prevScaleY,
      prevDisplayWidth,
      prevDisplayHeight,
      nextScaleX: selected.scaleX,
      nextScaleY: selected.scaleY,
      nextDisplayWidth: selected.displayWidth,
      nextDisplayHeight: selected.displayHeight,
    })

    this.updateObjectVisuals(selected)
    this.updatePropertyPanel()
  }

  private nudgeSelected(dx: number, dy: number): void {
    const selected = this.getSelected()
    if (!selected) return

    if (this.testEquippedWeaponId === selected.id) {
      this.testUnequip(selected.id)
    }

    const prevX = selected.x
    const prevY = selected.y
    const nextX = snap(selected.x + dx)
    const nextY = snap(selected.y + dy)
    if (selected.role !== 'weapon' && this.wouldOverlapAny(selected.id, nextX, nextY)) {
      return
    }
    const actualDx = nextX - prevX
    const actualDy = nextY - prevY

    if (actualDx === 0 && actualDy === 0) return

    selected.x = nextX
    selected.y = nextY

    this.history.push({
      type: 'move',
      objectId: selected.id,
      dx: actualDx,
      dy: actualDy,
      prevX,
      prevY,
      nextX,
      nextY,
    })

    this.updateObjectVisuals(selected)
    if (selected.role === 'player' && this.testEquippedWeaponId) {
      const weapon = this.editorObjects.find((o) => o.id === this.testEquippedWeaponId)
      if (weapon) {
        this.updateEquippedWeaponPosition(weapon, selected)
      }
    }
    this.updatePropertyPanel()
  }

  // --- Input Handlers ---

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const worldX = pointer.worldX
    const worldY = pointer.worldY

    // Check if clicking inside the bottom control panel
    if (
      this.panelContainer?.visible &&
      worldX >= PANEL_X &&
      worldX <= PANEL_X + PANEL_WIDTH &&
      worldY >= PANEL_Y &&
      worldY <= PANEL_Y + PANEL_HEIGHT
    ) {
      return
    }

    // Check if clicking the scale handle of the selected object
    const selected = this.getSelected()
    if (selected && selected.scaleHandle.visible) {
      const hx = selected.x + selected.displayWidth / 2
      const hy = selected.y + selected.displayHeight / 2
      if (
        Math.abs(worldX - hx) <= HANDLE_SIZE &&
        Math.abs(worldY - hy) <= HANDLE_SIZE
      ) {
        this.isDraggingScaleHandle = true
        this.scaleStartWidth = selected.displayWidth
        this.scaleStartHeight = selected.displayHeight
        this.scaleStartScaleX = selected.scaleX
        this.scaleStartScaleY = selected.scaleY
        this.scaleStartPointerX = worldX
        this.scaleStartPointerY = worldY
        return
      }
    }

    // Check if clicking on an object sprite
    for (let i = this.editorObjects.length - 1; i >= 0; i--) {
      const obj = this.editorObjects[i]
      const halfW = obj.displayWidth / 2
      const halfH = obj.displayHeight / 2
      if (
        worldX >= obj.x - halfW &&
        worldX <= obj.x + halfW &&
        worldY >= obj.y - halfH &&
        worldY <= obj.y + halfH
      ) {
        this.selectObject(obj.id)
        this.isDraggingObject = true
        this.dragStartX = worldX
        this.dragStartY = worldY
        this.dragObjStartX = obj.x
        this.dragObjStartY = obj.y
        return
      }
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isDraggingObject) {
      const selected = this.getSelected()
      if (!selected) return
      if (this.testEquippedWeaponId === selected.id) {
        this.testUnequip(selected.id)
        this.dragObjStartX = selected.x
        this.dragObjStartY = selected.y
      }
      const dx = pointer.worldX - this.dragStartX
      const dy = pointer.worldY - this.dragStartY
      const targetX = snap(this.dragObjStartX + dx)
      const targetY = snap(this.dragObjStartY + dy)

      if (selected.role === 'weapon') {
        selected.x = targetX
        selected.y = targetY
      } else {
        if (!this.wouldOverlapAny(selected.id, targetX, targetY)) {
          selected.x = targetX
          selected.y = targetY
        } else {
          if (!this.wouldOverlapAny(selected.id, targetX, selected.y)) {
            selected.x = targetX
          }
          if (!this.wouldOverlapAny(selected.id, selected.x, targetY)) {
            selected.y = targetY
          }
        }
      }

      this.updateObjectVisuals(selected)
      if (selected.role === 'player' && this.testEquippedWeaponId) {
        const weapon = this.editorObjects.find((o) => o.id === this.testEquippedWeaponId)
        if (weapon) {
          this.updateEquippedWeaponPosition(weapon, selected)
        }
      }
      this.updatePropertyPanel()
    }

    if (this.isDraggingScaleHandle) {
      const selected = this.getSelected()
      if (!selected) return
      const dx = pointer.worldX - this.scaleStartPointerX
      const dy = pointer.worldY - this.scaleStartPointerY
      // Use the larger axis delta to scale uniformly
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
      const scaleFactor = 1 + delta / 200
      const candDisplayW = Math.max(16, Math.round(this.scaleStartWidth * scaleFactor))
      const candDisplayH = Math.max(16, Math.round(this.scaleStartHeight * scaleFactor))
      const candScaleX = candDisplayW / selected.baseWidth
      const candScaleY = candDisplayH / selected.baseHeight

      if (selected.role !== 'weapon' && this.wouldOverlapAny(selected.id, selected.x, selected.y, candScaleX, candScaleY)) {
        return
      }

      selected.displayWidth = candDisplayW
      selected.displayHeight = candDisplayH
      selected.scaleX = candScaleX
      selected.scaleY = candScaleY
      this.updateObjectVisuals(selected)
      this.updatePropertyPanel()
    }
  }

  private onPointerUp(): void {
    if (this.isDraggingObject) {
      const selected = this.getSelected()
      if (selected) {
        const dx = selected.x - this.dragObjStartX
        const dy = selected.y - this.dragObjStartY
        if (dx !== 0 || dy !== 0) {
          this.history.push({
            type: 'move',
            objectId: selected.id,
            dx,
            dy,
            prevX: this.dragObjStartX,
            prevY: this.dragObjStartY,
            nextX: selected.x,
            nextY: selected.y,
          })
        }
      }
      this.isDraggingObject = false
    }

    if (this.isDraggingScaleHandle) {
      const selected = this.getSelected()
      if (
        selected &&
        (selected.displayWidth !== this.scaleStartWidth ||
          selected.displayHeight !== this.scaleStartHeight)
      ) {
        const factor =
          this.scaleStartWidth !== 0 ? selected.displayWidth / this.scaleStartWidth : 1
        this.history.push({
          type: 'scale',
          objectId: selected.id,
          factor,
          prevScaleX: this.scaleStartScaleX,
          prevScaleY: this.scaleStartScaleY,
          prevDisplayWidth: this.scaleStartWidth,
          prevDisplayHeight: this.scaleStartHeight,
          nextScaleX: selected.scaleX,
          nextScaleY: selected.scaleY,
          nextDisplayWidth: selected.displayWidth,
          nextDisplayHeight: selected.displayHeight,
        })
      }
      this.isDraggingScaleHandle = false
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      this.undo()
      return
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.key === 'p' || event.key === 'P') {
        event.preventDefault()
        this.togglePanel()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (this.selectedId && this.selectedId !== WORLD_OBJECT_IDS.player) {
          event.preventDefault()
          this.despawnWorldObject(this.selectedId)
          return
        }
      }
    }

    const selected = this.getSelected()
    if (!selected) return

    if (event.key === ' ' && selected.role === 'weapon') {
      event.preventDefault()
      this.testAttack()
      return
    }

    const step = event.shiftKey ? 10 : 1

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        this.nudgeSelected(-step, 0)
        return
      case 'ArrowRight':
        event.preventDefault()
        this.nudgeSelected(step, 0)
        return
      case 'ArrowUp':
        event.preventDefault()
        this.nudgeSelected(0, -step)
        return
      case 'ArrowDown':
        event.preventDefault()
        this.nudgeSelected(0, step)
        return
      case '+':
      case '=':
        this.scaleSelected(1.05)
        return
      case '-':
      case '_':
        this.scaleSelected(1 / 1.05)
        return
      case 'Tab':
        event.preventDefault()
        this.cycleSelection(event.shiftKey ? -1 : 1)
        return
      default:
        return
    }
  }

  private togglePanel(): void {
    if (!this.panelContainer || !this.exportButton) return
    const isVisible = !this.panelContainer.visible
    this.panelContainer.setVisible(isVisible)
    this.exportButton.setVisible(isVisible)
  }

  private undo(): void {
    const reversed = this.history.undo((id) => this.editorObjects.find((o) => o.id === id))
    if (!reversed) return

    if (reversed.type === 'despawn') {
      this.despawnWorldObject(reversed.objectId, false)
      return
    }

    if (reversed.type === 'spawn') {
      this.spawnWorldObject(
        reversed.role,
        {
          id: reversed.objectId,
          x: reversed.snapshot.x,
          y: reversed.snapshot.y,
          displayWidth: reversed.snapshot.displayWidth,
          displayHeight: reversed.snapshot.displayHeight,
          scaleX: reversed.snapshot.scaleX,
          scaleY: reversed.snapshot.scaleY,
          speed: reversed.snapshot.speed,
          maxHealth: reversed.snapshot.maxHealth,
          attackDistance: reversed.snapshot.attackDistance,
          attackDurationMs: reversed.snapshot.attackDurationMs,
          holdOffsetX: reversed.snapshot.holdOffsetX,
          holdOffsetY: reversed.snapshot.holdOffsetY,
        },
        false,
      )
      this.selectObject(reversed.objectId)
      return
    }

    this.selectObject(reversed.objectId)
    const obj = this.getSelected()
    if (obj) {
      this.updateObjectVisuals(obj)
    }
    this.updatePropertyPanel()
  }

  private cycleSelection(direction: number): void {
    if (this.editorObjects.length === 0) return
    const currentIndex = this.editorObjects.findIndex((obj) => obj.id === this.selectedId)
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + this.editorObjects.length) % this.editorObjects.length
    this.selectObject(this.editorObjects[nextIndex].id)
  }

  public syncToRoom1Objects(): RoomObjectConfig[] {
    const objects: RoomObjectConfig[] = this.editorObjects.map((obj) => {
      let speed: number | PlayerSpeedConfig | undefined = undefined
      if (obj.role === 'player') {
        const maxSpeed =
          obj.maxSpeed ??
          (typeof obj.speed === 'object' && obj.speed !== null
            ? obj.speed.maxSpeed
            : typeof obj.speed === 'number'
              ? obj.speed
              : 300)
        const acceleration =
          obj.acceleration ??
          (typeof obj.speed === 'object' && obj.speed !== null
            ? obj.speed.acceleration
            : 2500)
        const frictionAcceleration =
          obj.frictionAcceleration ??
          (typeof obj.speed === 'object' && obj.speed !== null
            ? obj.speed.frictionAcceleration
            : 3000)
        const turnaroundAcceleration =
          obj.turnaroundAcceleration ??
          (typeof obj.speed === 'object' && obj.speed !== null
            ? obj.speed.turnaroundAcceleration
            : 1600)
        speed = {
          acceleration,
          frictionAcceleration,
          turnaroundAcceleration,
          maxSpeed,
        }
      } else if (obj.role === 'guard' || obj.role === 'enemy') {
        speed = typeof obj.speed === 'number' ? obj.speed : (obj.maxSpeed ?? 210)
      }

      const savedPos = this.savedWeaponPositions.get(obj.id)
      const posX = savedPos ? savedPos.x : obj.x
      const posY = savedPos ? savedPos.y : obj.y

      return {
        id: obj.id,
        role: obj.role,
        x: Math.round(posX),
        y: Math.round(posY),
        displayWidth: Math.round(obj.displayWidth),
        displayHeight: Math.round(obj.displayHeight),
        scaleX: Number(obj.scaleX.toFixed(2)),
        scaleY: Number(obj.scaleY.toFixed(2)),
        ...(speed !== undefined ? { speed } : {}),
        ...(obj.maxHealth !== undefined ? { maxHealth: obj.maxHealth } : {}),
        ...(obj.attackDistance !== undefined ? { attackDistance: obj.attackDistance } : {}),
        ...(obj.attackDurationMs !== undefined ? { attackDurationMs: obj.attackDurationMs } : {}),
        ...(obj.holdOffsetX !== undefined ? { holdOffsetX: obj.holdOffsetX } : {}),
        ...(obj.holdOffsetY !== undefined ? { holdOffsetY: obj.holdOffsetY } : {}),
      }
    })

    ROOM1_OBJECTS.length = 0
    ROOM1_OBJECTS.push(...objects)
    return objects
  }

  public openSpeedEditor(): void {
    const sceneManager = SceneManager.get(this.game)
    if (sceneManager) {
      sceneManager.openEditor('speed-editor')
    } else {
      this.syncToRoom1Objects()
      this.scene.start('speed-editor')
    }
  }

  public openAiEditor(): void {
    const sceneManager = SceneManager.get(this.game)
    if (sceneManager) {
      sceneManager.openEditor('behavior-tree-editor')
    } else {
      this.syncToRoom1Objects()
      this.scene.start('behavior-tree-editor')
    }
  }

  public async saveLayout(): Promise<boolean> {
    const objects = this.syncToRoom1Objects()
    const source = generateRoom1Source(objects)

    const bg = this.exportButton?.getAt(0) as Phaser.GameObjects.Rectangle | undefined
    const label = this.exportButton?.getAt(1) as Phaser.GameObjects.Text | undefined

    try {
      const response = await fetch('/api/save-room1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: source }),
      })

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error ?? 'Unknown error writing file')
      }

      console.log(
        '%c Overwrote room1.ts directly ',
        'background: #2e7d32; color: #fff; font-size: 14px; padding: 4px 8px; border-radius: 4px',
      )
      console.log(source)

      if (bg && label) {
        bg.setFillStyle(0x66bb6a, 1)
        label.setText('SAVED TO ROOM1.TS!')
        this.time.delayedCall(1500, () => {
          bg.setFillStyle(0x2e7d32, 1)
          label.setText('SAVE TO ROOM1.TS')
        })
      }
      return true
    } catch (err) {
      console.error('Failed to overwrite room1.ts directly:', err)
      console.log('Generated room1.ts source fallback:\n' + source)

      if (bg && label) {
        bg.setFillStyle(0xb71c1c, 1)
        label.setText('SAVE FAILED (CONSOLE)')
        this.time.delayedCall(2000, () => {
          bg.setFillStyle(0x2e7d32, 1)
          label.setText('SAVE TO ROOM1.TS')
        })
      }
      return false
    }
  }

  public exportLayout(): Promise<boolean> {
    return this.saveLayout()
  }

  public spawnWorldObject(
    role: WorldObjectRole = 'enemy',
    config: SpawnObjectConfig = {},
    recordHistory = true,
  ): EditorObject {
    const id = config.id ?? this.generateNextId(role)

    const existingIndex = this.editorObjects.findIndex((o) => o.id === id)
    if (existingIndex !== -1) {
      const existing = this.editorObjects[existingIndex]
      if (config.x !== undefined) existing.x = config.x
      if (config.y !== undefined) existing.y = config.y
      if (config.displayWidth !== undefined) existing.displayWidth = config.displayWidth
      if (config.displayHeight !== undefined) existing.displayHeight = config.displayHeight
      if (config.scaleX !== undefined) {
        existing.scaleX = config.scaleX
        existing.baseWidth = existing.scaleX !== 0 ? existing.displayWidth / existing.scaleX : existing.baseWidth
      } else if (config.displayWidth !== undefined) {
        existing.scaleX = existing.displayWidth / existing.baseWidth
      }
      if (config.scaleY !== undefined) {
        existing.scaleY = config.scaleY
        existing.baseHeight = existing.scaleY !== 0 ? existing.displayHeight / existing.scaleY : existing.baseHeight
      } else if (config.displayHeight !== undefined) {
        existing.scaleY = existing.displayHeight / existing.baseHeight
      }
      if (config.maxHealth !== undefined) existing.maxHealth = config.maxHealth
      if (config.speed !== undefined) existing.speed = config.speed
      if (config.attackDistance !== undefined) existing.attackDistance = config.attackDistance
      if (config.attackDurationMs !== undefined) existing.attackDurationMs = config.attackDurationMs
      if (config.holdOffsetX !== undefined) existing.holdOffsetX = config.holdOffsetX
      if (config.holdOffsetY !== undefined) existing.holdOffsetY = config.holdOffsetY
      this.updateObjectVisuals(existing)
      this.selectObject(id)
      return existing
    }

    const textureKey = this.textureKeyForRole(role)
    const isWeapon = role === 'weapon'
    const isCharacter = role === 'player' || role === 'guard' || role === 'enemy'
    const defaultBaseWidth = isWeapon
      ? DAGGER_SIZE.width
      : (role === 'object' ? BOULDER_BASE_SIZE.width : CHARACTER_BASE_SIZE.width)
    const defaultBaseHeight = isWeapon
      ? DAGGER_SIZE.height
      : (role === 'object' ? BOULDER_BASE_SIZE.height : CHARACTER_BASE_SIZE.height)

    const displayWidth = config.displayWidth ?? defaultBaseWidth
    const displayHeight = config.displayHeight ?? defaultBaseHeight

    const scaleX = config.scaleX ?? (displayWidth / defaultBaseWidth)
    const scaleY = config.scaleY ?? (displayHeight / defaultBaseHeight)

    const baseWidth = scaleX !== 0 ? displayWidth / scaleX : defaultBaseWidth
    const baseHeight = scaleY !== 0 ? displayHeight / scaleY : defaultBaseHeight
    const maxHealth =
      config.maxHealth !== undefined
        ? config.maxHealth
        : isCharacter
          ? 100
          : undefined
    const speed =
      config.speed !== undefined
        ? config.speed
        : isCharacter
          ? (role === 'guard' || role === 'enemy'
              ? 120
              : { acceleration: 800, frictionAcceleration: 1200, turnaroundAcceleration: 1600, maxSpeed: 240 })
          : undefined
    const speedConfig = typeof speed === 'object' && speed !== null ? speed : undefined
    const maxSpeed = speedConfig?.maxSpeed ?? (typeof speed === 'number' ? speed : undefined)
    const acceleration = speedConfig?.acceleration
    const frictionAcceleration = speedConfig?.frictionAcceleration
    const turnaroundAcceleration = speedConfig?.turnaroundAcceleration
    const spawnAttackDistance = config.attackDistance ?? (isWeapon ? GAME_WEAPON_CONFIG.attackDistance : undefined)
    const spawnAttackDurationMs = config.attackDurationMs ?? (isWeapon ? GAME_WEAPON_CONFIG.attackDurationMs : undefined)
    const spawnHoldOffsetX = config.holdOffsetX ?? (isWeapon ? GAME_WEAPON_CONFIG.holdOffsetX : undefined)
    const spawnHoldOffsetY = config.holdOffsetY ?? (isWeapon ? GAME_WEAPON_CONFIG.holdOffsetY : undefined)

    const defaultX = 960 + (this.editorObjects.length % 5) * 40 - 80
    const defaultY = 380 + (this.editorObjects.length % 5) * 30 - 60
    let x = config.x !== undefined ? config.x : defaultX
    let y = config.y !== undefined ? config.y : defaultY

    if (role !== 'weapon') {
      const collSize = computeCollisionSize(role, scaleX, scaleY)
      let offset = 0
      while (offset < 800) {
        let collides = false
        for (const other of this.editorObjects) {
          if (other.role === 'weapon') continue
          const otherSize = computeCollisionSize(other.role, other.scaleX, other.scaleY)
          if (
            Math.abs(x - other.x) < (collSize.width + otherSize.width) / 2 &&
            Math.abs(y - other.y) < (collSize.height + otherSize.height) / 2
          ) {
            collides = true
            break
          }
        }
        if (!collides) break
        offset += 60
        x = (config.x !== undefined ? config.x : defaultX) + offset
        y = (config.y !== undefined ? config.y : defaultY) + (offset % 120)
      }
    }

    const sprite = this.add.image(x, y, textureKey).setDepth(3)
    sprite.setDisplaySize(displayWidth, displayHeight)
    sprite.setAlpha(0.9)

    // Selection outline
    const outline = this.add
      .rectangle(x, y, displayWidth + 8, displayHeight + 8)
      .setStrokeStyle(3, SELECTED_OUTLINE, 1)
      .setFillStyle(SELECTED_OUTLINE, 0.08)
      .setDepth(2)
      .setVisible(false)

    // Collision box (added for all world objects besides weapon)
    let collisionBox: Phaser.GameObjects.Rectangle | undefined
    if (role !== 'weapon') {
      const collSize = computeCollisionSize(role, scaleX, scaleY)
      collisionBox = this.add
        .rectangle(x, y, collSize.width, collSize.height)
        .setStrokeStyle(2, 0x00e676, 0.9)
        .setFillStyle(0x00e676, 0.12)
        .setDepth(2)
    }

    // Scale handle (bottom-right corner)
    const scaleHandle = this.add
      .rectangle(
        x + displayWidth / 2,
        y + displayHeight / 2,
        HANDLE_SIZE,
        HANDLE_SIZE,
        HANDLE_COLOR,
        1,
      )
      .setDepth(5)
      .setVisible(false)

    // Object label
    const label = this.add
      .text(x, y - displayHeight / 2 - 20, id, {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5, 1)
      .setDepth(4)

    const editorObject: EditorObject = {
      id,
      role,
      sprite,
      outline,
      collisionBox,
      scaleHandle,
      label,
      x,
      y,
      displayWidth,
      displayHeight,
      baseWidth,
      baseHeight,
      scaleX,
      scaleY,
      maxHealth,
      speed,
      maxSpeed,
      acceleration,
      frictionAcceleration,
      turnaroundAcceleration,
      attackDistance: spawnAttackDistance,
      attackDurationMs: spawnAttackDurationMs,
      holdOffsetX: spawnHoldOffsetX,
      holdOffsetY: spawnHoldOffsetY,
    }

    this.editorObjects.push(editorObject)

    if (recordHistory) {
      this.history.push({
        type: 'spawn',
        objectId: id,
        role,
        snapshot: this.createSnapshot(editorObject),
      })
    }

    this.refreshObjectList()
    this.selectObject(id)
    return editorObject
  }

  public despawnWorldObject(id: string, recordHistory = true): boolean {
    if (id === WORLD_OBJECT_IDS.player) {
      return false
    }

    if (this.testEquippedWeaponId === id) {
      this.testUnequip(id)
    }

    const index = this.editorObjects.findIndex((obj) => obj.id === id)
    if (index === -1) return false

    const obj = this.editorObjects[index]
    if (recordHistory) {
      this.history.push({
        type: 'despawn',
        objectId: obj.id,
        role: obj.role,
        snapshot: this.createSnapshot(obj),
      })
    }

    obj.sprite.destroy()
    obj.outline.destroy()
    obj.collisionBox?.destroy()
    obj.scaleHandle.destroy()
    obj.label.destroy()

    this.editorObjects.splice(index, 1)

    if (this.selectedId === id) {
      const nextObj = this.editorObjects[Math.max(0, index - 1)]
      if (nextObj) {
        this.selectObject(nextObj.id)
      } else {
        this.selectedId = null
        this.updatePropertyPanel()
      }
    }

    this.refreshObjectList()
    return true
  }

  private refreshObjectList(): void {
    if (!this.panelContainer) return

    for (const btn of this.objectListButtons) {
      this.panelContainer.remove(btn)
      btn.destroy()
    }
    this.objectListButtons = []

    const count = this.editorObjects.length
    const twoColumns = count > 4
    const startY = 74
    const rowHeight = twoColumns ? 26 : 28

    for (let i = 0; i < count; i++) {
      const obj = this.editorObjects[i]
      const col = twoColumns ? i % 2 : 0
      const row = twoColumns ? Math.floor(i / 2) : i
      const x = twoColumns ? (col === 0 ? 75 : 205) : 140
      const y = startY + row * rowHeight

      const displayLabel = obj.id.length > 10 ? obj.id.substring(0, 9) + '…' : obj.id.toUpperCase()
      const isSelected = obj.id === this.selectedId

      const btn = this.add
        .text(x, y, displayLabel, {
          fontFamily: FONT_FAMILY,
          fontSize: twoColumns ? 10 : 12,
          color: isSelected ? ACCENT_COLOR : TEXT_COLOR,
          backgroundColor: '#2a2a2a',
          padding: { x: twoColumns ? 6 : 10, y: 3 },
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })

      btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.()
        this.selectObject(obj.id)
      })

      this.panelContainer.add(btn)
      this.objectListButtons.push(btn)
      this.panelFields.set(`btn_${obj.id}`, btn)
    }

    this.updateDeleteButtonVisibility()
  }

  private updateDeleteButtonVisibility(): void {
    if (!this.deleteButton) return
    const canDelete = this.selectedId !== null && this.selectedId !== WORLD_OBJECT_IDS.player
    this.deleteButton.setVisible(canDelete)
  }

  private createSnapshot(obj: EditorObject): ScalableMovableObject {
    const savedPos = this.savedWeaponPositions.get(obj.id)
    return {
      id: obj.id,
      x: savedPos ? savedPos.x : obj.x,
      y: savedPos ? savedPos.y : obj.y,
      displayWidth: obj.displayWidth,
      displayHeight: obj.displayHeight,
      baseWidth: obj.baseWidth,
      baseHeight: obj.baseHeight,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      speed: obj.speed,
      maxHealth: obj.maxHealth,
      attackDistance: obj.attackDistance,
      attackDurationMs: obj.attackDurationMs,
      holdOffsetX: obj.holdOffsetX,
      holdOffsetY: obj.holdOffsetY,
    }
  }

  private generateNextId(role: WorldObjectRole): string {
    const prefix =
      role === 'weapon'
        ? 'dagger'
        : role === 'object'
          ? 'boulder'
          : role === 'enemy' || role === 'guard'
            ? 'guard'
            : role
    let counter = 2
    while (this.editorObjects.some((o) => o.id === `${prefix}-${counter}`)) {
      counter++
    }
    return `${prefix}-${counter}`
  }

  private textureKeyForRole(role: WorldObjectRole): string {
    switch (role) {
      case 'player':
        return PLAYER_TEXTURE_KEY
      case 'enemy':
      case 'guard':
        return GUARD_TEXTURE_KEY
      case 'weapon':
        return DAGGER_TEXTURE_KEY
      case 'object':
        return BOULDER_TEXTURE_KEY
    }
  }

  private textureKeyFor(worldObject: WorldObject): string | undefined {
    if (worldObject.id === 'boulder') {
      return BOULDER_TEXTURE_KEY
    }
    const rawRole = worldObject.metadata.role
    const role: WorldObjectRole | undefined =
      rawRole === 'weapon'
        ? 'weapon'
        : rawRole === 'enemy' || rawRole === 'guard'
          ? 'enemy'
          : rawRole === 'object'
            ? 'object'
            : rawRole === 'player'
              ? 'player'
              : undefined
    return role ? this.textureKeyForRole(role) : undefined
  }
}

function snap(value: number): number {
  return Math.round(value / GRID_SNAP) * GRID_SNAP
}
