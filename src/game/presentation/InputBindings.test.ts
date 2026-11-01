import { describe, expect, it } from 'vitest'
import { INPUT_BINDINGS, isAlphabetKey } from './InputBindings.ts'

describe('INPUT_BINDINGS', () => {
  it('does not contain wasd in movement bindings', () => {
    const allMovementKeys = [
      ...INPUT_BINDINGS.movement.up,
      ...INPUT_BINDINGS.movement.down,
      ...INPUT_BINDINGS.movement.left,
      ...INPUT_BINDINGS.movement.right,
    ]
    expect(allMovementKeys).not.toContain('w')
    expect(allMovementKeys).not.toContain('a')
    expect(allMovementKeys).not.toContain('s')
    expect(allMovementKeys).not.toContain('d')
  })

  it('only binds arrow keys for movement', () => {
    expect(INPUT_BINDINGS.movement.up).toEqual(['arrowup'])
    expect(INPUT_BINDINGS.movement.down).toEqual(['arrowdown'])
    expect(INPUT_BINDINGS.movement.left).toEqual(['arrowleft'])
    expect(INPUT_BINDINGS.movement.right).toEqual(['arrowright'])
  })

  it('binds spacebar and left click for attack', () => {
    expect(INPUT_BINDINGS.attack.keys).toContain(' ')
    expect(INPUT_BINDINGS.attack.mouseButtons).toContain('left')
  })
})

describe('isAlphabetKey', () => {
  it('recognizes lowercase and uppercase alphabets', () => {
    for (const char of 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      expect(isAlphabetKey({ key: char })).toBe(true)
    }
  })

  it('rejects arrow keys', () => {
    expect(isAlphabetKey({ key: 'ArrowUp' })).toBe(false)
    expect(isAlphabetKey({ key: 'ArrowDown' })).toBe(false)
    expect(isAlphabetKey({ key: 'ArrowLeft' })).toBe(false)
    expect(isAlphabetKey({ key: 'ArrowRight' })).toBe(false)
  })

  it('rejects functional and whitespace keys', () => {
    expect(isAlphabetKey({ key: 'Enter' })).toBe(false)
    expect(isAlphabetKey({ key: 'Tab' })).toBe(false)
    expect(isAlphabetKey({ key: ' ' })).toBe(false)
    expect(isAlphabetKey({ key: 'Backspace' })).toBe(false)
    expect(isAlphabetKey({ key: 'F2' })).toBe(false)
    expect(isAlphabetKey({ key: 'Escape' })).toBe(false)
  })

  it('rejects numbers and symbols', () => {
    expect(isAlphabetKey({ key: '1' })).toBe(false)
    expect(isAlphabetKey({ key: '0' })).toBe(false)
    expect(isAlphabetKey({ key: '-' })).toBe(false)
    expect(isAlphabetKey({ key: '$' })).toBe(false)
  })

  it('rejects alphabet keys when modifier keys are held', () => {
    expect(isAlphabetKey({ key: 'c', ctrlKey: true })).toBe(false)
    expect(isAlphabetKey({ key: 'z', ctrlKey: true })).toBe(false)
    expect(isAlphabetKey({ key: 'a', altKey: true })).toBe(false)
    expect(isAlphabetKey({ key: 'v', metaKey: true })).toBe(false)
  })
})

