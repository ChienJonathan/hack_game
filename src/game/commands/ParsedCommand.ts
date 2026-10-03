export interface ParsedCommand {
  readonly name: string
  readonly options: readonly string[]
  readonly arguments: readonly string[]
}

export type CommandParseResult =
  | { readonly ok: true; readonly command: ParsedCommand }
  | { readonly ok: false; readonly reason: string }
