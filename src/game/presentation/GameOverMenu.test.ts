import { describe, expect, it } from 'vitest'
import { GameOverMenu } from './GameOverMenu.ts'

describe('GameOverMenu', () => {
  it('starts on restart and wraps with left/right', () => {
    const menu = new GameOverMenu(['restart', 'load-save'])
    expect(menu.selected).toBe('restart')
    menu.move(1)
    expect(menu.selected).toBe('load-save')
    menu.move(1)
    expect(menu.selected).toBe('restart')
    menu.move(-1)
    expect(menu.selected).toBe('load-save')
  })

  it('skips and refuses disabled choices', () => {
    const menu = new GameOverMenu(['restart'])
    menu.move(1)
    expect(menu.selected).toBe('restart')
    menu.select('load-save')
    expect(menu.confirm()).toBe('restart')
    expect(menu.isEnabled('load-save')).toBe(false)
  })
})
