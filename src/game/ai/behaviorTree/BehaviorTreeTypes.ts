export type BehaviorTreeStatus = 'SUCCESS' | 'FAILURE' | 'RUNNING'

export type CompositeNodeType = 'selector' | 'sequence'

export type DecoratorNodeType = 'inverter' | 'cooldown'

export type ConditionNodeType =
  | 'is_player_in_range'
  | 'is_player_in_zone'
  | 'is_health_below'

export type ActionNodeType =
  | 'chase_player'
  | 'melee_attack'
  | 'charge_attack'
  | 'patrol'
  | 'flee'
  | 'wait'
  | 'heal'

export type BehaviorNodeType =
  | CompositeNodeType
  | DecoratorNodeType
  | ConditionNodeType
  | ActionNodeType

export type NodeCategory = 'composite' | 'decorator' | 'condition' | 'action'

export function getNodeCategory(type: BehaviorNodeType): NodeCategory {
  if (type === 'selector' || type === 'sequence') {
    return 'composite'
  }
  if (type === 'inverter' || type === 'cooldown') {
    return 'decorator'
  }
  if (
    type === 'is_player_in_range' ||
    type === 'is_player_in_zone' ||
    type === 'is_health_below'
  ) {
    return 'condition'
  }
  return 'action'
}

export interface Waypoint {
  x: number
  y: number
}

export interface BehaviorNodeParams {
  range?: number
  zone?: 'left' | 'right' | 'any'
  thresholdPercent?: number
  speedMultiplier?: number
  durationMs?: number
  cooldownMs?: number
  safeDistance?: number
  healAmount?: number
  chargeSpeed?: number
  waypoints?: Waypoint[]
  [key: string]: unknown
}

export interface BehaviorTreeNodeDef {
  id: string
  type: BehaviorNodeType
  name: string
  params?: BehaviorNodeParams
  children?: BehaviorTreeNodeDef[]
}

export interface BehaviorTreeDef {
  id: string
  name: string
  description?: string
  root: BehaviorTreeNodeDef
}

export interface BehaviorTreeContext {
  state: import('../../../game/domain/WorldState.ts').WorldState
  entity: import('../../../game/domain/WorldObject.ts').WorldObject
  blackboard: Record<string, unknown>
  tickDurationMs: number
  recordNodeStatus?: (nodeId: string, status: BehaviorTreeStatus) => void
}

