import type { RoomId, WorldObjectId } from './ids.ts'

export type WorldPath = string

export type WorldPathTarget =
  | { readonly kind: 'room'; readonly roomId: RoomId }
  | { readonly kind: 'object'; readonly objectId: WorldObjectId }
