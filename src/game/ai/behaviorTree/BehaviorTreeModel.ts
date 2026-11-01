import type {
  BehaviorNodeType,
  BehaviorTreeNodeDef,
  NodeCategory,
} from './BehaviorTreeTypes.ts'
import { getNodeCategory } from './BehaviorTreeTypes.ts'

export interface NodeLayout {
  id: string
  x: number
  y: number
  width: number
  height: number
  depth: number
}

export interface TreeLayoutOptions {
  nodeWidth?: number
  nodeHeight?: number
  horizontalSpacing?: number
  verticalSpacing?: number
  startX?: number
  startY?: number
}

let nextIdCounter = 1

export function generateNodeId(prefix = 'node'): string {
  return `${prefix}-${Date.now().toString(36)}-${(nextIdCounter++).toString(36)}`
}

export function createDefaultNode(type: BehaviorNodeType, customId?: string): BehaviorTreeNodeDef {
  const id = customId ?? generateNodeId(type)
  const category: NodeCategory = getNodeCategory(type)

  const defaultNames: Record<BehaviorNodeType, string> = {
    selector: 'Selector (Fallback)',
    sequence: 'Sequence',
    inverter: 'Inverter',
    cooldown: 'Cooldown (2s)',
    is_player_in_range: 'Player in Range',
    is_player_in_zone: 'Player in Zone',
    is_health_below: 'Health < 50%',
    chase_player: 'Chase Player',
    melee_attack: 'Melee Strike',
    charge_attack: 'Charge Dash',
    patrol: 'Patrol Area',
    flee: 'Flee to Safety',
    wait: 'Wait (1s)',
    heal: 'Heal (+15 HP)',
  }

  const defaultParams: Partial<Record<BehaviorNodeType, Record<string, unknown>>> = {
    cooldown: { cooldownMs: 2500 },
    is_player_in_range: { range: 350 },
    is_player_in_zone: { zone: 'right' },
    is_health_below: { thresholdPercent: 50 },
    chase_player: { speedMultiplier: 1.0 },
    charge_attack: { chargeSpeed: 550 },
    flee: { safeDistance: 450, speedMultiplier: 1.2 },
    wait: { durationMs: 1000 },
    heal: { healAmount: 15 },
    patrol: { speedMultiplier: 0.8 },
  }

  const node: BehaviorTreeNodeDef = {
    id,
    type,
    name: defaultNames[type] ?? type,
    params: defaultParams[type] ? { ...defaultParams[type] } : undefined,
  }

  if (category === 'composite' || category === 'decorator') {
    node.children = []
  }

  return node
}

export function findNodeById(root: BehaviorTreeNodeDef, id: string): BehaviorTreeNodeDef | null {
  if (root.id === id) {
    return root
  }
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeById(child, id)
      if (found) return found
    }
  }
  return null
}

export function findParentNode(
  root: BehaviorTreeNodeDef,
  childId: string,
): { parent: BehaviorTreeNodeDef; index: number } | null {
  if (root.children) {
    for (let i = 0; i < root.children.length; i++) {
      if (root.children[i].id === childId) {
        return { parent: root, index: i }
      }
      const deep = findParentNode(root.children[i], childId)
      if (deep) return deep
    }
  }
  return null
}

export function addChildNode(
  root: BehaviorTreeNodeDef,
  parentId: string,
  newNode: BehaviorTreeNodeDef,
): boolean {
  const parent = findNodeById(root, parentId)
  if (!parent) return false

  const category = getNodeCategory(parent.type)
  if (category !== 'composite' && category !== 'decorator') {
    return false
  }

  if (!parent.children) {
    parent.children = []
  }

  // Decorators can only have 1 child
  if (category === 'decorator' && parent.children.length >= 1) {
    return false
  }

  parent.children.push(newNode)
  return true
}

export function removeNode(root: BehaviorTreeNodeDef, id: string): boolean {
  // Cannot remove root node
  if (root.id === id) return false

  const parentInfo = findParentNode(root, id)
  if (!parentInfo) return false

  parentInfo.parent.children?.splice(parentInfo.index, 1)
  return true
}

export function moveChild(
  root: BehaviorTreeNodeDef,
  childId: string,
  direction: 'left' | 'right' | 'up' | 'down',
): boolean {
  const parentInfo = findParentNode(root, childId)
  if (!parentInfo) return false

  const siblings = parentInfo.parent.children
  if (!siblings || siblings.length <= 1) return false

  const idx = parentInfo.index
  const isPrevious = direction === 'left' || direction === 'up'
  const targetIdx = isPrevious ? idx - 1 : idx + 1

  if (targetIdx < 0 || targetIdx >= siblings.length) return false

  const temp = siblings[idx]
  siblings[idx] = siblings[targetIdx]
  siblings[targetIdx] = temp
  return true
}

export function updateNode(
  root: BehaviorTreeNodeDef,
  id: string,
  updates: Partial<BehaviorTreeNodeDef>,
): boolean {
  const node = findNodeById(root, id)
  if (!node) return false

  if (updates.name !== undefined) node.name = updates.name
  if (updates.params !== undefined) node.params = { ...node.params, ...updates.params }
  if (updates.type !== undefined && updates.type !== node.type) {
    node.type = updates.type
    const newCat = getNodeCategory(updates.type)
    if (newCat === 'condition' || newCat === 'action') {
      delete node.children
    } else if (!node.children) {
      node.children = []
    }
  }

  return true
}

/**
 * Computes a hierarchical 2D tree layout for visual rendering.
 */
export function computeTreeLayout(
  root: BehaviorTreeNodeDef,
  options: TreeLayoutOptions = {},
): Map<string, NodeLayout> {
  const nodeWidth = options.nodeWidth ?? 170
  const nodeHeight = options.nodeHeight ?? 56
  const horizontalSpacing = options.horizontalSpacing ?? 26
  const verticalSpacing = options.verticalSpacing ?? 88
  const startY = options.startY ?? 90

  const layoutMap = new Map<string, NodeLayout>()

  let currentLeafX = options.startX ?? 40

  function layoutSubtree(node: BehaviorTreeNodeDef, depth: number): { x: number; y: number } {
    const y = startY + depth * verticalSpacing
    const children = node.children ?? []

    if (children.length === 0) {
      const x = currentLeafX + nodeWidth / 2
      currentLeafX += nodeWidth + horizontalSpacing
      layoutMap.set(node.id, { id: node.id, x, y, width: nodeWidth, height: nodeHeight, depth })
      return { x, y }
    }

    const childPositions = children.map((child) => layoutSubtree(child, depth + 1))
    const minChildX = childPositions[0].x
    const maxChildX = childPositions[childPositions.length - 1].x
    const centeredX = (minChildX + maxChildX) / 2

    // Avoid overlap with existing left edge
    const x = Math.max(centeredX, currentLeafX - (nodeWidth + horizontalSpacing) / 2)
    layoutMap.set(node.id, { id: node.id, x, y, width: nodeWidth, height: nodeHeight, depth })
    return { x, y }
  }

  layoutSubtree(root, 0)
  return layoutMap
}
