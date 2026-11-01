import { describe, expect, it } from 'vitest'
import { MvCommandExecutor } from './mv.ts'
import { createInitialWorldState } from '../../content/room1WorldState.ts'
import { ROOM_LAYOUT, WORLD_OBJECT_IDS } from '../../content/room1Constants.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from '../../domain/WorldObjectState.ts'

describe('MvCommandExecutor', () => {
  const executor = new MvCommandExecutor()

  it('rejects command with usage popup when fewer than 2 arguments are provided', () => {
    const state = createInitialWorldState()
    expect(executor.execute({ name: 'mv', arguments: [], options: [] }, state)).toEqual({
      status: 'rejected',
      feedback: { kind: 'popup', text: 'Usage: mv <label1> <label2>' },
    })

    expect(executor.execute({ name: 'mv', arguments: ['dagger'], options: [] }, state)).toEqual({
      status: 'rejected',
      feedback: { kind: 'popup', text: 'Usage: mv <label1> <label2>' },
    })
  })

  it('rejects command if source object cannot be found', () => {
    const state = createInitialWorldState()
    const result = executor.execute({ name: 'mv', arguments: ['nonexistent', 'guard'], options: [] }, state)
    expect(result).toEqual({
      status: 'rejected',
      feedback: { kind: 'popup', text: 'Cannot find "nonexistent".' },
    })
  })

  it('rejects command if source and target refer to the same object', () => {
    const state = createInitialWorldState()
    const result = executor.execute({ name: 'mv', arguments: ['dagger', 'dagger'], options: [] }, state)
    expect(result).toEqual({
      status: 'rejected',
      feedback: { kind: 'popup', text: '"dagger" and "dagger" are the same object.' },
    })
  })

  it('renames source as target if target does not exist in room', () => {
    const state = createInitialWorldState()
    const daggerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    expect(daggerObj.metadata.name).toBe('dagger')
    expect((daggerObj.state as Record<string, unknown>).discovered).toBe(false)

    const result = executor.execute({ name: 'mv', arguments: ['dagger', 'knife'], options: [] }, state)
    expect(result).toEqual({
      status: 'success',
      feedback: [{ kind: 'popup', text: 'Renamed dagger to knife.' }],
    })

    expect(daggerObj.metadata.name).toBe('knife')
    expect((daggerObj.state as Record<string, unknown>).discovered).toBe(true)
  })

  it('throws source to target when target object exists in room', () => {
    const state = createInitialWorldState()
    const daggerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    const guardObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.guard)!

    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(daggerObj)
    const guardState = getMutableWorldObjectState<MutableWorldObjectState>(guardObj)

    const result = executor.execute({ name: 'mv', arguments: ['dagger', 'guard'], options: [] }, state)
    expect(result).toEqual({
      status: 'success',
      feedback: [{ kind: 'popup', text: 'Threw dagger to guard.' }],
    })

    expect(daggerState.thrown).toMatchObject({
      targetX: guardState.x,
      targetY: guardState.y,
      targetObjectId: guardObj.id,
      speed: 300,
    })
    expect(daggerState.discovered).toBe(true)
    expect(daggerState.vx).toBeGreaterThan(0)
  })

  it('rejects command if extra arguments or options are provided', () => {
    const state = createInitialWorldState()
    expect(
      executor.execute({ name: 'mv', arguments: ['dagger', 'guard', 'extra'], options: [] }, state),
    ).toEqual({
      status: 'rejected',
      feedback: { kind: 'popup', text: 'Usage: mv <label1> <label2>' },
    })

    expect(
      executor.execute({ name: 'mv', arguments: ['dagger', 'guard'], options: ['--speed=500'] }, state),
    ).toEqual({
      status: 'rejected',
      feedback: { kind: 'popup', text: 'Usage: mv <label1> <label2>' },
    })
  })

  it('throws source to room exit when target is exit label', () => {
    const state = createInitialWorldState()
    const daggerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(daggerObj)

    const result = executor.execute({ name: 'mv', arguments: ['dagger', 'room2'], options: [] }, state)
    expect(result).toEqual({
      status: 'success',
      feedback: [{ kind: 'popup', text: 'Threw dagger to room2.' }],
    })

    expect(daggerState.thrown).toMatchObject({
      targetX: ROOM_LAYOUT.exit.x,
      targetY: ROOM_LAYOUT.exit.y,
      speed: 300,
    })
  })

  it('unequips weapon from holder when thrown', () => {
    const state = createInitialWorldState()
    const daggerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    const playerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)!

    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(daggerObj)
    const playerState = getMutableWorldObjectState<MutableWorldObjectState>(playerObj)

    daggerState.equippedBy = WORLD_OBJECT_IDS.player
    playerState.weaponId = 'dagger'

    executor.execute({ name: 'mv', arguments: ['dagger', 'guard'], options: [] }, state)

    expect(daggerState.equippedBy).toBeNull()
    expect(playerState.weaponId).toBeNull()
  })
})
