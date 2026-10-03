import type { CommandParseResult } from './ParsedCommand.ts'
import type { CommandParser } from './CommandParser.ts'

export class ConsoleEchoCommandParser implements CommandParser {
  parse(rawText: string): CommandParseResult {
    console.log(rawText)

    return {
      ok: false,
      reason: 'Command parsing is not implemented yet.',
    }
  }
}
