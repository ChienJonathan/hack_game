import type { CommandFeedback } from './CommandFeedback.ts'

export type CommandResult =
  | {
      readonly status: 'success'
      readonly feedback: readonly CommandFeedback[]
      readonly completion?: 'deferred'
    }
  | { readonly status: 'rejected'; readonly feedback: CommandFeedback }
