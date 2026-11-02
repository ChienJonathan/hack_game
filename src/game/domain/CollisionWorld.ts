export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Bounds {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface CollisionWorld {
  gap(a: Box, b: Box): number
  overlaps(a: Box, b: Box): boolean
  clampToBounds(box: Box, bounds: Bounds): { x: number; y: number }
  resolveMovement(
    currentBox: Box,
    targetBox: Box,
    obstacles: readonly Box[],
    bounds?: Bounds,
  ): { x: number; y: number }
  nearestWithin<T extends { readonly box: Box }>(
    origin: Box,
    candidates: readonly T[],
    maxGap: number,
  ): T | undefined
}

export class AabbCollisionWorld implements CollisionWorld {
  gap(a: Box, b: Box): number {
    const gapX = Math.max(0, Math.abs(a.x - b.x) - (a.width + b.width) / 2)
    const gapY = Math.max(0, Math.abs(a.y - b.y) - (a.height + b.height) / 2)
    return Math.hypot(gapX, gapY)
  }

  overlaps(a: Box, b: Box): boolean {
    const halfW = (a.width + b.width) / 2
    const halfH = (a.height + b.height) / 2
    return Math.abs(a.x - b.x) < halfW && Math.abs(a.y - b.y) < halfH
  }

  clampToBounds(box: Box, bounds: Bounds): { x: number; y: number } {
    return {
      x: Math.min(Math.max(box.x, bounds.left + box.width / 2), bounds.right - box.width / 2),
      y: Math.min(Math.max(box.y, bounds.top + box.height / 2), bounds.bottom - box.height / 2),
    }
  }

  resolveMovement(
    currentBox: Box,
    targetBox: Box,
    obstacles: readonly Box[],
    bounds?: Bounds,
  ): { x: number; y: number } {
    let resolvedX = targetBox.x
    let resolvedY = targetBox.y
    const width = currentBox.width
    const height = currentBox.height

    // 1. Move along X axis first and check against obstacles
    if (resolvedX !== currentBox.x) {
      for (const obs of obstacles) {
        const testBox = { x: resolvedX, y: currentBox.y, width, height }
        if (this.overlaps(testBox, obs)) {
          if (!this.overlaps(currentBox, obs)) {
            if (targetBox.x > currentBox.x) {
              resolvedX = Math.min(resolvedX, obs.x - (obs.width + width) / 2)
            } else if (targetBox.x < currentBox.x) {
              resolvedX = Math.max(resolvedX, obs.x + (obs.width + width) / 2)
            }
          } else {
            const currDist = Math.abs(currentBox.x - obs.x)
            const newDist = Math.abs(resolvedX - obs.x)
            if (newDist < currDist) {
              resolvedX = currentBox.x
            }
          }
        }
      }
    }

    // 2. Move along Y axis with resolvedX and check against obstacles
    if (resolvedY !== currentBox.y) {
      for (const obs of obstacles) {
        const testBox = { x: resolvedX, y: resolvedY, width, height }
        if (this.overlaps(testBox, obs)) {
          if (!this.overlaps({ x: resolvedX, y: currentBox.y, width, height }, obs)) {
            if (targetBox.y > currentBox.y) {
              resolvedY = Math.min(resolvedY, obs.y - (obs.height + height) / 2)
            } else if (targetBox.y < currentBox.y) {
              resolvedY = Math.max(resolvedY, obs.y + (obs.height + height) / 2)
            }
          } else {
            const currDist = Math.abs(currentBox.y - obs.y)
            const newDist = Math.abs(resolvedY - obs.y)
            if (newDist < currDist) {
              resolvedY = currentBox.y
            }
          }
        }
      }
    }

    // 3. Fallback: if (resolvedX, resolvedY) still overlaps any obstacle that wasn't already overlapping
    for (const obs of obstacles) {
      if (!this.overlaps(currentBox, obs) && this.overlaps({ x: resolvedX, y: resolvedY, width, height }, obs)) {
        if (!this.overlaps({ x: resolvedX, y: currentBox.y, width, height }, obs)) {
          resolvedY = currentBox.y
        } else if (!this.overlaps({ x: currentBox.x, y: resolvedY, width, height }, obs)) {
          resolvedX = currentBox.x
        } else {
          resolvedX = currentBox.x
          resolvedY = currentBox.y
        }
      }
    }

    // 4. Clamping to room bounds
    if (bounds) {
      const clamped = this.clampToBounds({ x: resolvedX, y: resolvedY, width, height }, bounds)
      let clampedCollides = false
      for (const obs of obstacles) {
        if (!this.overlaps(currentBox, obs) && this.overlaps({ x: clamped.x, y: clamped.y, width, height }, obs)) {
          clampedCollides = true
          break
        }
      }
      if (!clampedCollides) {
        resolvedX = clamped.x
        resolvedY = clamped.y
      }
    }

    return { x: resolvedX, y: resolvedY }
  }

  nearestWithin<T extends { readonly box: Box }>(
    origin: Box,
    candidates: readonly T[],
    maxGap: number,
  ): T | undefined {
    let nearest: T | undefined
    let nearestGap = Infinity
    for (const candidate of candidates) {
      const candidateGap = this.gap(origin, candidate.box)
      if (candidateGap <= maxGap && candidateGap < nearestGap) {
        nearest = candidate
        nearestGap = candidateGap
      }
    }
    return nearest
  }
}
