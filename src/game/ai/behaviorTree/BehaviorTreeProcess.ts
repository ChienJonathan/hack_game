import { ROOM_IDS } from '../../content/room1Constants.ts'
import type { ProcessTickContext, WorldObjectProcess } from '../../simulation/TickSimulationEngine.ts'
import { BehaviorTreeEvaluator } from './BehaviorTreeEvaluator.ts'
import { STANDARD_GUARD_TREE } from './BehaviorTreePresets.ts'
import type { BehaviorTreeDef, BehaviorTreeStatus } from './BehaviorTreeTypes.ts'

export const BEHAVIOR_TREE_PROCESS_ID = 'behavior-tree-process'

export class BehaviorTreeProcess implements WorldObjectProcess {
  readonly id = BEHAVIOR_TREE_PROCESS_ID
  readonly definitionId = BEHAVIOR_TREE_PROCESS_ID

  private activeTree: BehaviorTreeDef
  private readonly nodeStatusTracker = new Map<string, BehaviorTreeStatus>()

  constructor(defaultTree: BehaviorTreeDef = STANDARD_GUARD_TREE) {
    this.activeTree = defaultTree
  }

  public setTree(tree: BehaviorTreeDef): void {
    this.activeTree = tree
  }

  public getTree(): BehaviorTreeDef {
    return this.activeTree
  }

  public getNodeStatuses(): ReadonlyMap<string, BehaviorTreeStatus> {
    return this.nodeStatusTracker
  }

  tick(context: ProcessTickContext): void {
    if (context.state.currentRoomId !== ROOM_IDS.first || context.state.outcome !== 'playing') {
      return
    }

    const entityState = context.worldObject.state as Record<string, unknown>
    if (entityState.alive === false) {
      return
    }

    // Determine which tree to use: check object state or activeTree
    const objectTree = entityState.behaviorTree as BehaviorTreeDef | undefined
    const treeToRun = objectTree ?? this.activeTree

    if (typeof context.processInstance.runtimeState !== 'object' || context.processInstance.runtimeState === null || Array.isArray(context.processInstance.runtimeState)) {
      context.processInstance.runtimeState = {}
    }
    const blackboard = context.processInstance.runtimeState as Record<string, unknown>

    this.nodeStatusTracker.clear()

    BehaviorTreeEvaluator.evaluate(treeToRun.root, {
      state: context.state,
      entity: context.worldObject,
      blackboard,
      tickDurationMs: context.tickDurationMs,
      recordNodeStatus: (nodeId, status) => {
        this.nodeStatusTracker.set(nodeId, status)
      },
    })
  }
}
