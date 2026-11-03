import {
  DEFAULT_COMMAND_MODE_TIME_SCALE,
  GAME_COMMAND_MODE_CONFIG,
} from '../commands/commandModeConstants.ts'

export type InputMode = 'movement' | 'command'
export type Direction = 'up' | 'down' | 'left' | 'right'
export type MovementBindings = Readonly<Record<Direction, readonly string[]>>

export interface MoveVector {
  readonly x: number
  readonly y: number
}

export { DEFAULT_COMMAND_MODE_TIME_SCALE, GAME_COMMAND_MODE_CONFIG }

export const COMMAND_TIME_SCALE_STORAGE_KEY = 'hack-game.command-time-scale'

function getInitialCommandModeTimeScale(): number {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(COMMAND_TIME_SCALE_STORAGE_KEY)
      if (stored !== null) {
        const val = parseFloat(stored)
        if (Number.isFinite(val) && val >= 0.01 && val <= 2.0) {
          return val
        }
      }
    } catch {}
  }
  return GAME_COMMAND_MODE_CONFIG.commandTimeScale ?? DEFAULT_COMMAND_MODE_TIME_SCALE
}

export let COMMAND_MODE_TIME_SCALE = getInitialCommandModeTimeScale()
GAME_COMMAND_MODE_CONFIG.commandTimeScale = COMMAND_MODE_TIME_SCALE
export const MOVEMENT_MODE_TIME_SCALE = 1

export function setCommandModeTimeScale(scale: number): void {
  const clamped = Math.max(0.01, Math.min(2.0, Math.round(scale * 1000) / 1000))
  COMMAND_MODE_TIME_SCALE = clamped
  GAME_COMMAND_MODE_CONFIG.commandTimeScale = clamped
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(COMMAND_TIME_SCALE_STORAGE_KEY, String(clamped))
    } catch {}
  }
}

export function resetCommandModeTimeScale(): void {
  COMMAND_MODE_TIME_SCALE = DEFAULT_COMMAND_MODE_TIME_SCALE
  GAME_COMMAND_MODE_CONFIG.commandTimeScale = DEFAULT_COMMAND_MODE_TIME_SCALE
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(COMMAND_TIME_SCALE_STORAGE_KEY)
    } catch {}
  }
}

const STILL: MoveVector = { x: 0, y: 0 }

export class InputModeController {
  private readonly bindings: MovementBindings
  private readonly heldKeys = new Set<string>()
  private suppressedKeys = new Set<string>()
  private latchedVector: MoveVector = STILL
  private currentMode: InputMode = 'movement'
  private customCommandTimeScale?: number

  constructor(bindings: MovementBindings) {
    this.bindings = bindings
  }

  get mode(): InputMode {
    return this.currentMode
  }

  get commandTimeScale(): number {
    return this.customCommandTimeScale ?? COMMAND_MODE_TIME_SCALE
  }

  setCommandTimeScale(scale: number): void {
    const clamped = Math.max(0.01, Math.min(2.0, Math.round(scale * 1000) / 1000))
    this.customCommandTimeScale = clamped
    setCommandModeTimeScale(clamped)
  }

  get timeScale(): number {
    return this.currentMode === 'command' ? this.commandTimeScale : MOVEMENT_MODE_TIME_SCALE
  }

  toggle(): void {
    if (this.currentMode === 'movement') {
      this.enterCommandMode()
    } else {
      this.enterMovementMode()
    }
  }

  enterCommandMode(): void {
    if (this.currentMode === 'command') {
      return
    }
    this.latchedVector = this.heldVector()
    this.suppressedKeys = new Set(this.heldKeys)
    this.currentMode = 'command'
  }

  enterMovementMode(): void {
    if (this.currentMode === 'movement') {
      return
    }
    this.latchedVector = STILL
    this.suppressedKeys.clear()
    this.currentMode = 'movement'
  }

  finishCommand(inputAfter: InputMode = 'movement'): void {
    if (inputAfter === 'movement' && this.currentMode === 'command') {
      this.enterMovementMode()
    }
  }

  keyDown(key: string): { typeable: boolean } {
    this.heldKeys.add(key)
    return { typeable: this.currentMode === 'command' && !this.suppressedKeys.has(key) }
  }

  keyUp(key: string): void {
    this.heldKeys.delete(key)
    this.suppressedKeys.delete(key)
  }

  releaseAll(): void {
    this.heldKeys.clear()
    this.suppressedKeys.clear()
  }

  isBoundTo(key: string, direction: Direction): boolean {
    const lowerKey = key.toLowerCase()
    return this.bindings[direction].some((k) => k.toLowerCase() === lowerKey)
  }

  moveVector(): MoveVector {
    return this.currentMode === 'command' ? this.latchedVector : this.heldVector()
  }

  private heldVector(): MoveVector {
    const pressed = (direction: Direction) =>
      this.bindings[direction].some((key) => this.heldKeys.has(key)) ? 1 : 0
    const x = pressed('right') - pressed('left')
    const y = pressed('down') - pressed('up')
    const length = Math.hypot(x, y)
    return length === 0 ? STILL : { x: x / length, y: y / length }
  }
}
