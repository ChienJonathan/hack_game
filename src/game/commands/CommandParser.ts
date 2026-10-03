import type { CommandParseResult } from './ParsedCommand.ts'

export interface CommandParser {
  parse(rawText: string): CommandParseResult
}
