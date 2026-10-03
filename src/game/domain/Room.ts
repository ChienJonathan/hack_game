import type { WorldObjectId, RoomId } from './ids.ts'
import type { JsonValue } from './JsonValue.ts'

export interface Room {
  readonly id: RoomId
  readonly objectIds: readonly WorldObjectId[]
  readonly state: JsonValue
}
