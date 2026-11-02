export interface CollisionBody {
  readonly mass: number
  readonly restitution: number
  readonly vx: number
  readonly vy: number
}

export interface CollisionVelocity {
  readonly vx: number
  readonly vy: number
}

export interface CollisionResult {
  readonly a: CollisionVelocity
  readonly b: CollisionVelocity
}

interface Normal {
  readonly x: number
  readonly y: number
}

const AT_REST_SPEED = 1e-9

function isAtRest(body: CollisionBody): boolean {
  return Math.hypot(body.vx, body.vy) <= AT_REST_SPEED
}

function impulseBetween(inverseMassA: number, inverseMassB: number, restitution: number, closing: number): number {
  return ((1 + restitution) * closing) / (inverseMassA + inverseMassB)
}

/**
 * The velocities of two colliding bodies after impact, or null when they are not approaching.
 * `normal` is the unit vector from `a` to `b`. Motion is exchanged along the normal only; the
 * tangential part of each velocity is unchanged. The restitution is the product of both bodies'.
 *
 * A body at rest counts as infinitely heavy, so the other bounces off, when the speed it would gain
 * with its real mass is below `minCollideMoveVelocity`.
 */
export function resolveCollision(
  a: CollisionBody,
  b: CollisionBody,
  normal: Normal,
  minCollideMoveVelocity: number,
): CollisionResult | null {
  const closing = (a.vx - b.vx) * normal.x + (a.vy - b.vy) * normal.y
  if (closing <= 0) {
    return null
  }

  const restitution = a.restitution * b.restitution
  let inverseMassA = 1 / a.mass
  let inverseMassB = 1 / b.mass

  const impulse = impulseBetween(inverseMassA, inverseMassB, restitution, closing)
  if (isAtRest(b) && impulse * inverseMassB < minCollideMoveVelocity) {
    inverseMassB = 0
  } else if (isAtRest(a) && impulse * inverseMassA < minCollideMoveVelocity) {
    inverseMassA = 0
  }

  const finalImpulse = impulseBetween(inverseMassA, inverseMassB, restitution, closing)
  return {
    a: {
      vx: a.vx - finalImpulse * inverseMassA * normal.x,
      vy: a.vy - finalImpulse * inverseMassA * normal.y,
    },
    b: {
      vx: b.vx + finalImpulse * inverseMassB * normal.x,
      vy: b.vy + finalImpulse * inverseMassB * normal.y,
    },
  }
}
