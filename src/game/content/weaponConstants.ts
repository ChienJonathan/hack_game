import type { MutableWorldObjectState } from '../domain/WorldObjectState.ts'

/**
 * Base dagger dimensions for display and collision.
 */
export const DEFAULT_DAGGER_SIZE = { width: 72, height: 72 } as const
export const DAGGER_SIZE = DEFAULT_DAGGER_SIZE

/**
 * Default weapon hold offset in local coordinates relative to the holder.
 * Mirrored horizontally when the holder is facing left.
 */
export const DEFAULT_WEAPON_HOLD_OFFSET = { x: 20, y: 26 } as const
export const WEAPON_HOLD_OFFSET = DEFAULT_WEAPON_HOLD_OFFSET

/**
 * Default translation distance (px) and duration (ms) for dagger attack animation.
 */
export const DEFAULT_DAGGER_ATTACK_DISTANCE = 30
export const DEFAULT_DAGGER_ATTACK_DURATION_MS = 200

export const DAGGER_ATTACK_DISTANCE = DEFAULT_DAGGER_ATTACK_DISTANCE
export const DAGGER_ATTACK_DURATION_MS = DEFAULT_DAGGER_ATTACK_DURATION_MS

/**
 * Shared runtime configuration for weapons, editable in LevelEditor.
 */
export interface WeaponConfig {
  attackDistance: number
  attackDurationMs: number
  holdOffsetX: number
  holdOffsetY: number
}

export const GAME_WEAPON_CONFIG: WeaponConfig = {
  attackDistance: DEFAULT_DAGGER_ATTACK_DISTANCE,
  attackDurationMs: DEFAULT_DAGGER_ATTACK_DURATION_MS,
  holdOffsetX: DEFAULT_WEAPON_HOLD_OFFSET.x,
  holdOffsetY: DEFAULT_WEAPON_HOLD_OFFSET.y,
}

export function resetGameWeaponConfig(): void {
  GAME_WEAPON_CONFIG.attackDistance = DEFAULT_DAGGER_ATTACK_DISTANCE
  GAME_WEAPON_CONFIG.attackDurationMs = DEFAULT_DAGGER_ATTACK_DURATION_MS
  GAME_WEAPON_CONFIG.holdOffsetX = DEFAULT_WEAPON_HOLD_OFFSET.x
  GAME_WEAPON_CONFIG.holdOffsetY = DEFAULT_WEAPON_HOLD_OFFSET.y
}

/**
 * Computes smooth translation distance (px) for dagger attack animation using sine easing.
 */
export function computeDaggerAttackTranslation(
  elapsedMs: number,
  durationMs: number = GAME_WEAPON_CONFIG.attackDurationMs,
  distance: number = GAME_WEAPON_CONFIG.attackDistance,
): number {
  if (elapsedMs <= 0 || elapsedMs >= durationMs || durationMs <= 0) {
    return 0
  }
  const progress = elapsedMs / durationMs
  return Math.round(Math.sin(progress * Math.PI) * distance)
}

/**
 * Initiates dagger attack animation state on mutable weapon object state.
 */
export function startDaggerAttackAnimation(
  daggerState: MutableWorldObjectState,
  durationMs: number = GAME_WEAPON_CONFIG.attackDurationMs,
): boolean {
  if (typeof daggerState.attackDurationMs === 'number' && daggerState.attackDurationMs > 0) {
    const elapsed = typeof daggerState.attackElapsedMs === 'number' ? daggerState.attackElapsedMs : 0
    if (elapsed < daggerState.attackDurationMs) {
      return false
    }
  }
  daggerState.attackDurationMs = durationMs
  daggerState.attackElapsedMs = 0
  daggerState.attackOffsetX = 0
  return true
}

