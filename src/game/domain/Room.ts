import type { WorldObjectId, RoomId } from './ids.ts'
import type { JsonValue } from './JsonValue.ts'

export interface RoomExit {
  readonly targetRoomId: RoomId
  readonly label: string
  readonly x: number
  readonly y: number
}

export interface Room {
  readonly id: RoomId
  readonly objectIds: readonly WorldObjectId[]
  readonly exits: readonly RoomExit[]
  readonly state: JsonValue
}
