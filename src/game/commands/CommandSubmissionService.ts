import type { CommandExecutor } from './CommandExecutor.ts'
import type { CommandParser } from './CommandParser.ts'
import type { CommandRegistry } from './CommandRegistry.ts'
import type { CommandRequirementChecker } from './CommandRequirementChecker.ts'
import type { CommandResult } from './CommandResult.ts'
import type { WorldState } from '../domain/WorldState.ts'

export class CommandSubmissionService {
  private readonly parser: CommandParser
  private readonly registry: CommandRegistry
  private readonly requirementChecker: CommandRequirementChecker
  private readonly executor: CommandExecutor

  constructor(
    parser: CommandParser,
    registry: CommandRegistry,
    requirementChecker: CommandRequirementChecker,
    executor: CommandExecutor,
  ) {
    this.parser = parser
    this.registry = registry
    this.requirementChecker = requirementChecker
    this.executor = executor
  }

  submit(rawText: string, state: WorldState): CommandResult {
    const parseResult = this.parser.parse(rawText)
    if (!parseResult.ok) {
      return { status: 'rejected', feedback: { kind: 'popup', text: parseResult.reason } }
    }

    const registeredCommand = this.registry.resolve(parseResult.command.name)
    if (!registeredCommand) {
      return {
        status: 'rejected',
        feedback: { kind: 'popup', text: `Unknown command: ${parseResult.command.name}` },
      }
    }

    const requirementResult = this.requirementChecker.check(
      registeredCommand.requirements,
      parseResult.command,
      state,
    )
    if (!requirementResult.ok) {
      return { status: 'rejected', feedback: { kind: 'popup', text: requirementResult.reason } }
    }

    return this.executor.execute(registeredCommand, parseResult.command, state)
  }
}
