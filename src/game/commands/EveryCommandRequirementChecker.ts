import type { ParsedCommand } from './ParsedCommand.ts'
import type { CommandRequirement, RequirementCheckResult } from './CommandRequirement.ts'
import type { CommandRequirementChecker } from './CommandRequirementChecker.ts'
import type { WorldState } from '../domain/WorldState.ts'

export class EveryCommandRequirementChecker implements CommandRequirementChecker {
  check(
    requirements: readonly CommandRequirement[],
    command: ParsedCommand,
    state: WorldState,
  ): RequirementCheckResult {
    for (const requirement of requirements) {
      const result = requirement.check(command, state)
      if (!result.ok) {
        return result
      }
    }

    return { ok: true }
  }
}
