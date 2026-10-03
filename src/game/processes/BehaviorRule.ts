import type { ProcessDefinitionId } from '../domain/ids.ts'
import type { JsonValue } from '../domain/JsonValue.ts'

export interface BehaviorRule {
  readonly condition: JsonValue
  readonly processDefinitionId: ProcessDefinitionId
}

export const ALWAYS_ACTIVE_BEHAVIOR = { kind: 'always' } as const
