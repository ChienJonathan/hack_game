import type { WorldPath, WorldPathTarget } from './WorldPath.ts'
import type { WorldPathResolver } from './WorldPathResolver.ts'
import type { WorldState } from './WorldState.ts'

function normalizeVirtualPath(path: string): string {
  return path.trim().replace(/^\/+|\/+$/g, '').toLowerCase()
}

export class VirtualWorldPathResolver implements WorldPathResolver {
  resolve(path: WorldPath, state: WorldState): WorldPathTarget | undefined {
    const normalizedPath = normalizeVirtualPath(path)
    if (!normalizedPath) {
      return undefined
    }

    const room = state.rooms.find((candidate) => candidate.id.toLowerCase() === normalizedPath)
    if (room) {
      return { kind: 'room', roomId: room.id }
    }

    const worldObject = state.worldObjects.find((candidate) => {
      const name = candidate.metadata.name
      return typeof name === 'string' && name.toLowerCase() === normalizedPath
    })

    return worldObject ? { kind: 'object', objectId: worldObject.id } : undefined
  }
}
