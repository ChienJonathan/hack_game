import { describe, expect, it } from 'vitest'
import { createAiEditorSession } from './aiEditorSession.ts'
import { BOSS_CYBER_ENFORCER_TREE, STANDARD_GUARD_TREE } from '../ai/behaviorTree/BehaviorTreePresets.ts'

describe('aiEditorSession', () => {
  it('creates AI editor session reusing room1 environment and runs simulation steps', () => {
    const bundle = createAiEditorSession({ tree: STANDARD_GUARD_TREE })
    expect(bundle.session).toBeDefined()
    expect(bundle.worldState.worldObjects.length).toBeGreaterThanOrEqual(3)

    // Run a step
    bundle.step(20)
    const statuses = bundle.getNodeStatuses()
    expect(statuses.size).toBeGreaterThan(0)
  })

  it('allows switching tree and damage/heal boss with real room1 guard', () => {
    const bundle = createAiEditorSession({ tree: BOSS_CYBER_ENFORCER_TREE, bossMaxHealth: 150 })
    expect(bundle.getTree().id).toBe('boss-cyber-enforcer')

    bundle.damageBoss(25)
    const boss = bundle.worldState.worldObjects.find((o) => o.id === bundle.targetGuardId)!
    expect((boss.state as { health: number }).health).toBe(125)

    bundle.healBoss(10)
    expect((boss.state as { health: number }).health).toBe(135)

    bundle.setTree(STANDARD_GUARD_TREE)
    expect(bundle.getTree().id).toBe('standard-guard')

    bundle.resetArena()
    expect((boss.state as { health: number }).health).toBe(150)
  })
})
