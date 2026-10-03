import type { CommandParseResult } from './ParsedCommand.ts'
import type { CommandParser } from './CommandParser.ts'

export class VirtualCommandParser implements CommandParser {
  parse(rawText: string): CommandParseResult {
    const input = rawText.trim()
    if (!input) {
      return { ok: false, reason: 'Enter a command first.' }
    }

    const [rawName, ...tokens] = input.split(/\s+/)
    const name = rawName.toLowerCase()
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      return { ok: false, reason: 'Command names can only contain letters, numbers, and hyphens.' }
    }

    const options = tokens.filter((token) => token.startsWith('--'))
    const arguments_ = tokens.filter((token) => !token.startsWith('--'))

    return {
      ok: true,
      command: { name, options, arguments: arguments_ },
    }
  }
}
