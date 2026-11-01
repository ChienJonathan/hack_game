import { describe, expect, it } from 'vitest'
import {
  addChildNode,
  computeTreeLayout,
  createDefaultNode,
  findNodeById,
  findParentNode,
  moveChild,
  removeNode,
  updateNode,
} from './BehaviorTreeModel.ts'
import { cloneBehaviorTree, STANDARD_GUARD_TREE } from './BehaviorTreePresets.ts'

describe('BehaviorTreeModel', () => {
  it('finds node by id correctly', () => {
    const tree = cloneBehaviorTree(STANDARD_GUARD_TREE)
    const node = findNodeById(tree.root, 'seq-engage')
    expect(node).not.toBeNull()
    expect(node?.id).toBe('seq-engage')
    expect(node?.type).toBe('sequence')

    expect(findNodeById(tree.root, 'non-existent')).toBeNull()
  })

  it('finds parent node and child index', () => {
    const tree = cloneBehaviorTree(STANDARD_GUARD_TREE)
    const parentInfo = findParentNode(tree.root, 'seq-engage')
    expect(parentInfo).not.toBeNull()
    expect(parentInfo?.parent.id).toBe('root-selector')
    expect(parentInfo?.index).toBe(0)
  })

  it('adds child node to composite', () => {
    const tree = cloneBehaviorTree(STANDARD_GUARD_TREE)
    const newNode = createDefaultNode('wait', 'custom-wait')
    const added = addChildNode(tree.root, 'seq-engage', newNode)
    expect(added).toBe(true)

    const found = findNodeById(tree.root, 'custom-wait')
    expect(found).not.toBeNull()
    expect(found?.type).toBe('wait')
  })

  it('removes child node but protects root', () => {
    const tree = cloneBehaviorTree(STANDARD_GUARD_TREE)
    expect(removeNode(tree.root, tree.root.id)).toBe(false)

    const removed = removeNode(tree.root, 'cond-player-zone')
    expect(removed).toBe(true)
    expect(findNodeById(tree.root, 'cond-player-zone')).toBeNull()
  })

  it('moves children left and right', () => {
    const tree = cloneBehaviorTree(STANDARD_GUARD_TREE)
    // seq-engage has children: cond-player-zone (idx 0), sel-attack-or-chase (idx 1)
    const moved = moveChild(tree.root, 'sel-attack-or-chase', 'left')
    expect(moved).toBe(true)

    const parent = findNodeById(tree.root, 'seq-engage')!
    expect(parent.children?.[0].id).toBe('sel-attack-or-chase')
    expect(parent.children?.[1].id).toBe('cond-player-zone')
  })

  it('updates node properties and type', () => {
    const tree = cloneBehaviorTree(STANDARD_GUARD_TREE)
    updateNode(tree.root, 'cond-player-zone', {
      name: 'Custom Zone Check',
      params: { zone: 'left' },
    })

    const updated = findNodeById(tree.root, 'cond-player-zone')!
    expect(updated.name).toBe('Custom Zone Check')
    expect(updated.params?.zone).toBe('left')
  })

  it('computes 2D tree layout for visual rendering', () => {
    const tree = cloneBehaviorTree(STANDARD_GUARD_TREE)
    const layout = computeTreeLayout(tree.root, { startX: 100, startY: 100 })
    expect(layout.size).toBeGreaterThan(0)
    const rootPos = layout.get('root-selector')
    expect(rootPos).toBeDefined()
    expect(rootPos?.y).toBe(100)
    expect(rootPos?.depth).toBe(0)

    for (const [id, pos] of layout.entries()) {
      expect(pos.id).toBe(id)
      expect(pos.x).toBeGreaterThan(0)
      expect(pos.y).toBeGreaterThanOrEqual(100)
    }
  })
})

