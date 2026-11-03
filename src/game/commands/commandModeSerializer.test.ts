import { describe, expect, it } from 'vitest'
import { generateCommandModeConstantsSource } from './commandModeSerializer.ts'

describe('generateCommandModeConstantsSource', () => {
  it('serializes command time scale into valid TypeScript source', () => {
    const source = generateCommandModeConstantsSource({ commandTimeScale: 0.15 })
    expect(source).toContain('export const DEFAULT_COMMAND_MODE_TIME_SCALE = 0.15')
    expect(source).toContain('export const GAME_COMMAND_MODE_CONFIG: CommandModeConfig')
  })
})

