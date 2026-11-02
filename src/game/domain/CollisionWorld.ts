/** The outline a collider takes. A `circle` fits inside its `width` × `height` box: its radius is half the smaller side. */
export type ColliderShape = 'box' | 'circle'

export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** Defaults to `box`. */
  readonly shape?: ColliderShape
}

/** Copies the collider fields of any positioned state, keeping its shape. */
export function boxFromState(state: {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly shape?: unknown
}): Box {
  const box = { x: state.x, y: state.y, width: state.width, height: state.height }
  return state.shape === 'circle' ? { ...box, shape: 'circle' } : box
}

export function isCircle(box: Box): boolean {
  return box.shape === 'circle'
}

export function radiusOf(box: Box): number {
  return Math.min(box.width, box.height) / 2
}

/** How two colliders sit relative to each other. */
export interface Contact {
  /** Unit vector pointing from `a` towards `b` along which they touch or would touch. */
  readonly normal: { readonly x: number; readonly y: number }
  /** Signed separation: positive is the gap between them, negative is how deep they overlap. */
  readonly distance: number
}

/** Overlap shallower than this is treated as touching, so pushed-apart bodies do not count as overlapping. */
const OVERLAP_EPSILON = 1e-9

function unit(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y)
  return length === 0 ? { x: 1, y: 0 } : { x: x / length, y: y / length }
}

function boxBoxContact(a: Box, b: Box): Contact {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const separationX = Math.abs(dx) - (a.width + b.width) / 2
  const separationY = Math.abs(dy) - (a.height + b.height) / 2
  if (separationX < 0 && separationY < 0) {
    // Overlapping: the way out is along the shallower axis.
    return separationX >= separationY
      ? { normal: { x: dx >= 0 ? 1 : -1, y: 0 }, distance: separationX }
      : { normal: { x: 0, y: dy >= 0 ? 1 : -1 }, distance: separationY }
  }
  const gapX = Math.max(0, separationX)
  const gapY = Math.max(0, separationY)
  return {
    normal: unit(gapX === 0 ? 0 : Math.sign(dx) * gapX, gapY === 0 ? 0 : Math.sign(dy) * gapY),
    distance: Math.hypot(gapX, gapY),
  }
}

function circleCircleContact(a: Box, b: Box): Contact {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return { normal: unit(dx, dy), distance: Math.hypot(dx, dy) - radiusOf(a) - radiusOf(b) }
}

/** Contact of circle `a` with box `b`. */
function circleBoxContact(a: Box, b: Box): Contact {
  const radius = radiusOf(a)
  const left = b.x - b.width / 2
  const right = b.x + b.width / 2
  const top = b.y - b.height / 2
  const bottom = b.y + b.height / 2
  const closestX = Math.min(Math.max(a.x, left), right)
  const closestY = Math.min(Math.max(a.y, top), bottom)
  const toClosestX = closestX - a.x
  const toClosestY = closestY - a.y
  const length = Math.hypot(toClosestX, toClosestY)
  if (length > 0) {
    return { normal: { x: toClosestX / length, y: toClosestY / length }, distance: length - radius }
  }

  // The circle's centre is inside the box: it leaves through the nearest edge, so the box lies the other way.
  const exits = [
    { depth: a.x - left, normal: { x: 1, y: 0 } },
    { depth: right - a.x, normal: { x: -1, y: 0 } },
    { depth: a.y - top, normal: { x: 0, y: 1 } },
    { depth: bottom - a.y, normal: { x: 0, y: -1 } },
  ]
  const nearest = exits.reduce((best, exit) => (exit.depth < best.depth ? exit : best))
  return { normal: nearest.normal, distance: -(radius + nearest.depth) }
}

/** Contact between any two colliders, whatever their shapes. */
export function contactOf(a: Box, b: Box): Contact {
  if (isCircle(a) && isCircle(b)) {
    return circleCircleContact(a, b)
  }
  if (isCircle(a)) {
    return circleBoxContact(a, b)
  }
  if (isCircle(b)) {
    const reversed = circleBoxContact(b, a)
    return { normal: { x: -reversed.normal.x, y: -reversed.normal.y }, distance: reversed.distance }
  }
  return boxBoxContact(a, b)
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
  /** Unit vector from `a` to `b` along which they push on each other. */
  contactNormal(a: Box, b: Box): { x: number; y: number }
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

/**
 * Collision between axis-aligned boxes and circles. Two boxes keep the original axis-by-axis
 * AABB behaviour; any pair involving a circle is resolved along its contact normal, so bodies
 * slide around the curve instead of catching on the corners of a bounding box.
 */
export class ShapeCollisionWorld implements CollisionWorld {
  gap(a: Box, b: Box): number {
    if (isCircle(a) || isCircle(b)) {
      return Math.max(0, contactOf(a, b).distance)
    }
    const gapX = Math.max(0, Math.abs(a.x - b.x) - (a.width + b.width) / 2)
    const gapY = Math.max(0, Math.abs(a.y - b.y) - (a.height + b.height) / 2)
    return Math.hypot(gapX, gapY)
  }

  overlaps(a: Box, b: Box): boolean {
    if (isCircle(a) || isCircle(b)) {
      return contactOf(a, b).distance < -OVERLAP_EPSILON
    }
    const halfW = (a.width + b.width) / 2
    const halfH = (a.height + b.height) / 2
    return Math.abs(a.x - b.x) < halfW && Math.abs(a.y - b.y) < halfH
  }

  contactNormal(a: Box, b: Box): { x: number; y: number } {
    if (isCircle(a) || isCircle(b)) {
      return contactOf(a, b).normal
    }
    // Boxes keep pushing along the line between their centres.
    return unit(b.x - a.x, b.y - a.y)
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
    const moverIsCircle = isCircle(currentBox)
    if (!moverIsCircle && !obstacles.some(isCircle)) {
      return this.resolveBoxMovement(currentBox, targetBox, obstacles, bounds)
    }

    // Box obstacles against a box mover keep the axis-by-axis rules; everything involving a circle
    // is pushed out along its contact normal afterwards.
    const curved = moverIsCircle ? obstacles : obstacles.filter(isCircle)
    const straight = moverIsCircle ? [] : obstacles.filter((obstacle) => !isCircle(obstacle))
    const at = (x: number, y: number): Box => ({ ...currentBox, x, y })

    let position =
      straight.length > 0
        ? this.resolveBoxMovement(currentBox, targetBox, straight)
        : { x: targetBox.x, y: targetBox.y }
    position = this.pushOut(currentBox, position, curved)

    if (bounds) {
      const clamped = this.clampToBounds(at(position.x, position.y), bounds)
      if (clamped.x !== position.x || clamped.y !== position.y) {
        // Pressed into a wall: settle again so the body slides along it instead of into an obstacle.
        position = this.pushOut(currentBox, clamped, curved)
        position = this.clampToBounds(at(position.x, position.y), bounds)
      }
    }

    // Never end the step inside something that was not already overlapping: fall back per axis.
    const entersObstacle = (x: number, y: number) =>
      obstacles.some((obstacle) => !this.overlaps(currentBox, obstacle) && this.overlaps(at(x, y), obstacle))
    if (!entersObstacle(position.x, position.y)) {
      return position
    }
    if (!entersObstacle(position.x, currentBox.y)) {
      return { x: position.x, y: currentBox.y }
    }
    if (!entersObstacle(currentBox.x, position.y)) {
      return { x: currentBox.x, y: position.y }
    }
    return { x: currentBox.x, y: currentBox.y }
  }

  /**
   * Moves `position` out of every obstacle it overlaps along the contact normal. An obstacle the body
   * already overlapped at the start of the step may not be entered any deeper, but is not ejected from.
   */
  private pushOut(
    currentBox: Box,
    position: { x: number; y: number },
    obstacles: readonly Box[],
  ): { x: number; y: number } {
    let { x, y } = position
    for (let iteration = 0; iteration < 4; iteration++) {
      let moved = false
      for (const obstacle of obstacles) {
        const contact = contactOf({ ...currentBox, x, y }, obstacle)
        const allowed = Math.min(0, contactOf(currentBox, obstacle).distance)
        if (contact.distance < allowed - OVERLAP_EPSILON) {
          const correction = contact.distance - allowed
          x += contact.normal.x * correction
          y += contact.normal.y * correction
          moved = true
        }
      }
      if (!moved) {
        break
      }
    }
    return { x, y }
  }

  /** The original axis-by-axis AABB resolution, used whenever only boxes are involved. */
  private resolveBoxMovement(
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
