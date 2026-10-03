export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

export type MutableJsonValue =
  | string
  | number
  | boolean
  | null
  | MutableJsonValue[]
  | { [key: string]: MutableJsonValue }
