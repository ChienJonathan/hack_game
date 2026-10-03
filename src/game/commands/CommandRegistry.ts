import type { CommandHandler } from './CommandHandler.ts'
import type { CommandRequirement } from './CommandRequirement.ts'

export interface RegisteredCommand {
  readonly name: string
  readonly requirements: readonly CommandRequirement[]
  readonly handler: CommandHandler
}

export interface CommandRegistry {
  resolve(name: string): RegisteredCommand | undefined
}
