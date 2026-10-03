import { CommandSubmissionService } from '../commands/CommandSubmissionService.ts'
import { EveryCommandRequirementChecker } from '../commands/EveryCommandRequirementChecker.ts'
import { RegisteredCommandRegistry } from '../commands/RegisteredCommandRegistry.ts'
import { CdCommandExecutor } from '../commands/executors/cd.ts'
import { LsCommandExecutor } from '../commands/executors/ls.ts'
import { VirtualCommandParser } from '../commands/VirtualCommandParser.ts'
import { VirtualWorldPathResolver } from '../domain/VirtualWorldPathResolver.ts'

export function createRoom1CommandSubmissionService(): CommandSubmissionService {
  const pathResolver = new VirtualWorldPathResolver()

  return new CommandSubmissionService(
    new VirtualCommandParser(),
    new RegisteredCommandRegistry([
      { name: 'ls', requirements: [], executor: new LsCommandExecutor() },
      { name: 'cd', requirements: [], executor: new CdCommandExecutor(pathResolver) },
    ]),
    new EveryCommandRequirementChecker(),
  )
}
