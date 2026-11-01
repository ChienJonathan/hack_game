import type { MovementBindings } from '../application/InputModeController.ts'

export type MouseButtonName = 'left' | 'right'

interface ActionBinding {
  readonly keys: readonly string[]
  readonly mouseButtons: readonly MouseButtonName[]
}

export interface InputBindings {
  readonly movement: MovementBindings
  readonly toggleMode: readonly string[]
  readonly attack: ActionBinding
}

// Keys are lowercase `KeyboardEvent.key` values.
export const INPUT_BINDINGS: InputBindings = {
  movement: {
    up: ['arrowup'],
    down: ['arrowdown'],
    left: ['arrowleft'],
    right: ['arrowright'],
  },
  toggleMode: ['enter'],
  attack: { keys: [' ', 'space'], mouseButtons: ['left'] },
}

export function isAlphabetKey(event: {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}): boolean {
  return (
    event.key.length === 1 &&
    /^[a-zA-Z]$/.test(event.key) &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  )
}
