import type { BehaviorRule } from '../processes/BehaviorRule.ts'
import type { RoomId, WorldObjectId } from './ids.ts'
import type { MutableJsonValue } from './JsonValue.ts'
import type { WorldObjectMetadata } from './WorldObject.ts'
import { WorldObject } from './WorldObject.ts'

export class BasicWorldObject extends WorldObject {
  constructor(
    id: WorldObjectId,
    roomId: RoomId,
    metadata: WorldObjectMetadata,
    behaviorRules: readonly BehaviorRule[],
    state: MutableJsonValue,
  ) {
    super(id, roomId, metadata, behaviorRules, state)
  }
}
