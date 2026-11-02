import type { Bounds } from './CollisionWorld.ts'
import type { WorldObjectId, RoomId } from './ids.ts'
import type { JsonValue } from './JsonValue.ts'

/** What must be true in a Room before its Exit opens. */
export type ExitRequirement =
  /** Every listed World Object is defeated (or no longer in the room). */
  | { readonly kind: 'defeat'; readonly objectIds: readonly WorldObjectId[] }
  /** Every discoverable World Object in the room has been discovered. */
  | { readonly kind: 'discover-all' }

export interface RoomExit {
  readonly targetRoomId: RoomId
  readonly label: string
  readonly x: number
  readonly y: number
  /** Locks the Exit until met. */
  readonly requires?: ExitRequirement
  /** Going through ends the run with `congratulations` instead of entering the target room. */
  readonly endsGame?: boolean
}

export interface Room {
  readonly id: RoomId
  readonly objectIds: readonly WorldObjectId[]
  readonly exits: readonly RoomExit[]
  readonly state: JsonValue
  /** The area bodies stay inside; without it the room has no edge. */
  readonly bounds?: Bounds
  /** Where the Player Character appears when entering this room. */
  readonly entry?: { readonly x: number; readonly y: number }
  /** Teaching text shown on screen in this room and by `help`. */
  readonly hint?: string
  /** One-line objective shown in the HUD; for a locked Exit, what unlocks it. */
  readonly goal?: string
  /** Entering the room restores the Player Character's Health. */
  readonly restoresHealth?: boolean
}
