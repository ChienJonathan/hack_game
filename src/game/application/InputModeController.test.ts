import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  COMMAND_MODE_TIME_SCALE,
  InputModeController,
  setCommandModeTimeScale,
  resetCommandModeTimeScale,
} from './InputModeController.ts'

const bindings = {
  up: ['w', 'arrowup'],
  down: ['s', 'arrowdown'],
  left: ['a', 'arrowleft'],
  right: ['d', 'arrowright'],
}

const controller = () => new InputModeController(bindings)

beforeEach(() => {
  resetCommandModeTimeScale()
})

afterEach(() => {
  resetCommandModeTimeScale()
})

describe('mode switching', () => {
  it('starts in movement mode at full time scale', () => {
    const input = controller()

    expect(input.mode).toBe('movement')
    expect(input.timeScale).toBe(1)
  })

  it('toggles between movement and command mode with the command time scale', () => {
    const input = controller()

    input.toggle()
    expect(input.mode).toBe('command')
    expect(input.timeScale).toBe(COMMAND_MODE_TIME_SCALE)
    expect(COMMAND_MODE_TIME_SCALE).toBe(0.25)

    input.toggle()
    expect(input.mode).toBe('movement')
    expect(input.timeScale).toBe(1)
  })

  it('returns to movement mode after a command by default', () => {
    const input = controller()
    input.toggle()

    input.finishCommand()

    expect(input.mode).toBe('movement')
  })

  it('stays in command mode when the command asks to keep input open', () => {
    const input = controller()
    input.toggle()

    input.finishCommand('command')

    expect(input.mode).toBe('command')
  })

  it('enters command mode explicitly and idempotently', () => {
    const input = controller()

    input.enterCommandMode()
    expect(input.mode).toBe('command')
    expect(input.timeScale).toBe(COMMAND_MODE_TIME_SCALE)

    input.enterCommandMode()
    expect(input.mode).toBe('command')
  })

  it('enters movement mode explicitly and idempotently', () => {
    const input = controller()
    input.enterCommandMode()

    input.enterMovementMode()
    expect(input.mode).toBe('movement')
    expect(input.timeScale).toBe(1)

    input.enterMovementMode()
    expect(input.mode).toBe('movement')
  })
})

describe('movement vector', () => {
  it('follows the held movement keys', () => {
    const input = controller()
    input.keyDown('w')

    expect(input.moveVector()).toEqual({ x: 0, y: -1 })
  })

  it('accepts arrow keys as well as WASD', () => {
    const input = controller()
    input.keyDown('arrowright')

    expect(input.moveVector()).toEqual({ x: 1, y: 0 })
  })

  it('normalizes diagonal movement', () => {
    const input = controller()
    input.keyDown('w')
    input.keyDown('d')

    const { x, y } = input.moveVector()
    expect(Math.hypot(x, y)).toBeCloseTo(1)
    expect(x).toBeGreaterThan(0)
    expect(y).toBeLessThan(0)
  })

  it('cancels opposite keys and stops when keys are released', () => {
    const input = controller()
    input.keyDown('a')
    input.keyDown('d')
    expect(input.moveVector()).toEqual({ x: 0, y: 0 })

    input.keyUp('a')
    input.keyUp('d')
    expect(input.moveVector()).toEqual({ x: 0, y: 0 })
  })
})

describe('entering command mode while moving', () => {
  it('keeps moving in the latched direction after the key is released', () => {
    const input = controller()
    input.keyDown('d')
    input.toggle()
    input.keyUp('d')

    expect(input.moveVector()).toEqual({ x: 1, y: 0 })
  })

  it('stops when returning to movement mode with nothing held', () => {
    const input = controller()
    input.keyDown('d')
    input.toggle()
    input.keyUp('d')
    input.toggle()

    expect(input.moveVector()).toEqual({ x: 0, y: 0 })
  })

  it('does not move in command mode when nothing was held at the switch', () => {
    const input = controller()
    input.toggle()
    input.keyDown('w')

    expect(input.moveVector()).toEqual({ x: 0, y: 0 })
  })

  it('does not type a movement key held through the switch, repeats included', () => {
    const input = controller()
    input.keyDown('d')
    input.toggle()

    expect(input.keyDown('d')).toEqual({ typeable: false })
    expect(input.keyDown('d')).toEqual({ typeable: false })

    input.keyUp('d')
    expect(input.keyDown('d')).toEqual({ typeable: true })
  })

  it('types keys that were not held at the switch', () => {
    const input = controller()
    input.keyDown('d')
    input.toggle()

    expect(input.keyDown('w')).toEqual({ typeable: true })
    expect(input.keyDown('x')).toEqual({ typeable: true })
  })

  it('resumes live key movement when a command finishes with a key still held', () => {
    const input = controller()
    input.toggle()
    input.keyDown('s')
    input.finishCommand()

    expect(input.moveVector()).toEqual({ x: 0, y: 1 })
  })
})

describe('releaseAll', () => {
  it('forgets every held key, as when the window loses focus', () => {
    const input = controller()
    input.keyDown('w')
    input.releaseAll()

    expect(input.moveVector()).toEqual({ x: 0, y: 0 })
  })
})

describe('isBoundTo', () => {
  it('checks if a key is bound to a specific direction case-insensitively', () => {
    const input = controller()

    expect(input.isBoundTo('arrowleft', 'left')).toBe(true)
    expect(input.isBoundTo('ArrowLeft', 'left')).toBe(true)
    expect(input.isBoundTo('a', 'left')).toBe(true)
    expect(input.isBoundTo('d', 'left')).toBe(false)
    expect(input.isBoundTo('arrowright', 'right')).toBe(true)
    expect(input.isBoundTo('arrowup', 'up')).toBe(true)
    expect(input.isBoundTo('arrowdown', 'down')).toBe(true)
  })
})

describe('command mode time scale tuning', () => {
  it('allows customizing command time scale dynamically', () => {
    const input = controller()
    expect(input.commandTimeScale).toBe(0.25)

    input.setCommandTimeScale(0.1)
    expect(input.commandTimeScale).toBe(0.1)

    // While in movement mode, timeScale is 1
    expect(input.mode).toBe('movement')
    expect(input.timeScale).toBe(1)

    // When entering command mode, timeScale is updated to custom scale
    input.enterCommandMode()
    expect(input.mode).toBe('command')
    expect(input.timeScale).toBe(0.1)

    input.setCommandTimeScale(0.5)
    expect(input.timeScale).toBe(0.5)

    // Clamps to at least 0.01
    input.setCommandTimeScale(-1)
    expect(input.commandTimeScale).toBe(0.01)

    // Resetting global command mode time scale
    resetCommandModeTimeScale()
    expect(COMMAND_MODE_TIME_SCALE).toBe(0.25)
  })

  it('saves and clears localStorage when window.localStorage is available', () => {
    const store = new Map<string, string>()
    const storageMock = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, val)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => store.clear(),
    }
    const origWindow = (globalThis as any).window
    ;(globalThis as any).window = { localStorage: storageMock }

    setCommandModeTimeScale(0.35)
    expect(store.get('hack-game.command-time-scale')).toBe('0.35')

    resetCommandModeTimeScale()
    expect(store.has('hack-game.command-time-scale')).toBe(false)

    if (origWindow !== undefined) {
      ;(globalThis as any).window = origWindow
    } else {
      delete (globalThis as any).window
    }
  })
})
