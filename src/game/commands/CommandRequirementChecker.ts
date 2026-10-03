import type { ParsedCommand } from './ParsedCommand.ts'
import type { CommandRequirement, RequirementCheckResult } from './CommandRequirement.ts'
import type { WorldState } from '../domain/WorldState.ts'

export interface CommandRequirementChecker {
  check(
    requirements: readonly CommandRequirement[],
    command: ParsedCommand,
    state: WorldState,
  ): RequirementCheckResult
}
