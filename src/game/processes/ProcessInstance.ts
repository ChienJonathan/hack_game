import type { ProcessDefinitionId, ProcessInstanceId, WorldObjectId } from '../domain/ids.ts'
import type { JsonValue } from '../domain/JsonValue.ts'

export interface ProcessInstance {
  readonly id: ProcessInstanceId
  readonly definitionId: ProcessDefinitionId
  readonly ownerObjectId: WorldObjectId
  runtimeState: JsonValue
}
