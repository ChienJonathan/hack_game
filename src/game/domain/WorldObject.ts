import type { BehaviorRule } from '../processes/BehaviorRule.ts'
import type { JsonValue, MutableJsonValue } from './JsonValue.ts'
import type { RoomId, WorldObjectId } from './ids.ts'

export type WorldObjectMetadata = Readonly<Record<string, JsonValue>>

export abstract class WorldObject {
  readonly id: WorldObjectId
  readonly roomId: RoomId
  readonly metadata: WorldObjectMetadata
  readonly behaviorRules: readonly BehaviorRule[]
  public state: MutableJsonValue

  protected constructor(
    id: WorldObjectId,
    roomId: RoomId,
    metadata: WorldObjectMetadata,
    behaviorRules: readonly BehaviorRule[],
    state: MutableJsonValue,
  ) {
    this.id = id
    this.roomId = roomId
    this.metadata = metadata
    this.behaviorRules = behaviorRules
    this.state = state
  }
}
