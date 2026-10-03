import type { ParsedCommand } from './ParsedCommand.ts'
import type { WorldState } from '../domain/WorldState.ts'

export type RequirementCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string }

export interface CommandRequirement {
  check(command: ParsedCommand, state: WorldState): RequirementCheckResult
}
