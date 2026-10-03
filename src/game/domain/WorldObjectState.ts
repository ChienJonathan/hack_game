import type { MutableJsonValue } from './JsonValue.ts'
import type { WorldObject } from './WorldObject.ts'

export type MutableWorldObjectState = { [key: string]: MutableJsonValue }

export function getMutableWorldObjectState<T extends MutableWorldObjectState>(
  worldObject: WorldObject,
): T {
  if (
    typeof worldObject.state !== 'object' ||
    worldObject.state === null ||
    Array.isArray(worldObject.state)
  ) {
    throw new Error(`World object "${worldObject.id}" must have an object state.`)
  }

  return worldObject.state as unknown as T
}
