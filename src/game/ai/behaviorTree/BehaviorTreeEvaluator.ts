import { ROOM_LAYOUT, WORLD_OBJECT_IDS } from '../../content/room1Constants.ts'
import type { CharacterState } from '../../domain/CharacterState.ts'
import { AabbCollisionWorld } from '../../domain/CollisionWorld.ts'
import { CombatService } from '../../domain/CombatService.ts'
import { weaponFor } from '../../domain/WeaponDefinition.ts'
import { getMutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import type {
  BehaviorNodeParams,
  BehaviorTreeNodeDef,
  BehaviorTreeContext,
  BehaviorTreeStatus,
} from './BehaviorTreeTypes.ts'

const collision = new AabbCollisionWorld()
const combat = new CombatService(collision)

const ROOM_BOUNDS = {
  left: ROOM_LAYOUT.left,
  top: ROOM_LAYOUT.top,
  right: ROOM_LAYOUT.right,
  bottom: ROOM_LAYOUT.bottom,
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

function boxOf(entity: { x: number; y: number; width: number; height: number }): Box {
  return { x: entity.x, y: entity.y, width: entity.width, height: entity.height }
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function getObstacles(context: BehaviorTreeContext, excludeId: string): Box[] {
  const obstacles: Box[] = []
  for (const obj of context.state.worldObjects) {
    if (obj.id === excludeId) continue
    if (obj.roomId !== context.state.currentRoomId) continue
    if (obj.metadata.role === 'weapon') continue
    const s = obj.state as Record<string, unknown>
    if (s.alive === false) continue
    if (typeof s.x !== 'number' || typeof s.y !== 'number') continue
    if (typeof s.width !== 'number' || typeof s.height !== 'number') continue
    obstacles.push({
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
    })
  }
  return obstacles
}

function moveToward(
  position: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number },
  speed: number,
  tickDurationMs: number,
  obstacles: readonly Box[] = [],
): void {
  const deltaX = target.x - position.x
  const deltaY = target.y - position.y
  const remainingDistance = Math.hypot(deltaX, deltaY)
  const maxDistance = (speed * tickDurationMs) / 1000

  let nextX = target.x
  let nextY = target.y
  if (remainingDistance > maxDistance && remainingDistance !== 0) {
    nextX = position.x + (deltaX / remainingDistance) * maxDistance
    nextY = position.y + (deltaY / remainingDistance) * maxDistance
  }

  const currentBox = boxOf(position)
  const targetBox = { x: nextX, y: nextY, width: position.width, height: position.height }
  const resolved = collision.resolveMovement(currentBox, targetBox, obstacles, ROOM_BOUNDS)
  position.x = resolved.x
  position.y = resolved.y
}

function moveAway(
  position: { x: number; y: number; width: number; height: number },
  avoid: { x: number; y: number },
  speed: number,
  tickDurationMs: number,
  obstacles: readonly Box[] = [],
): void {
  const deltaX = position.x - avoid.x
  const deltaY = position.y - avoid.y
  const remainingDistance = Math.hypot(deltaX, deltaY)
  const maxDistance = (speed * tickDurationMs) / 1000

  let nextX = position.x + maxDistance
  let nextY = position.y
  if (remainingDistance !== 0) {
    nextX = position.x + (deltaX / remainingDistance) * maxDistance
    nextY = position.y + (deltaY / remainingDistance) * maxDistance
  }

  const currentBox = boxOf(position)
  const targetBox = { x: nextX, y: nextY, width: position.width, height: position.height }
  const resolved = collision.resolveMovement(currentBox, targetBox, obstacles, ROOM_BOUNDS)
  position.x = resolved.x
  position.y = resolved.y
}

export class BehaviorTreeEvaluator {
  public static evaluate(node: BehaviorTreeNodeDef, context: BehaviorTreeContext): BehaviorTreeStatus {
    // Advance simulation time in blackboard
    context.blackboard._timeMs = ((context.blackboard._timeMs as number) ?? 0) + context.tickDurationMs

    const status = this.evaluateNode(node, context)
    context.recordNodeStatus?.(node.id, status)
    return status
  }

  private static evaluateNode(node: BehaviorTreeNodeDef, context: BehaviorTreeContext): BehaviorTreeStatus {
    let result: BehaviorTreeStatus

    switch (node.type) {
      // Composites
      case 'selector':
        result = this.evaluateSelector(node, context)
        break
      case 'sequence':
        result = this.evaluateSequence(node, context)
        break

      // Decorators
      case 'inverter':
        result = this.evaluateInverter(node, context)
        break
      case 'cooldown':
        result = this.evaluateCooldown(node, context)
        break

      // Conditions
      case 'is_player_in_range':
        result = this.condPlayerInRange(node.params, context)
        break
      case 'is_player_in_zone':
        result = this.condPlayerInZone(node.params, context)
        break
      case 'is_health_below':
        result = this.condHealthBelow(node.params, context)
        break

      // Actions
      case 'chase_player':
        result = this.actionChasePlayer(node.params, context)
        break
      case 'melee_attack':
        result = this.actionMeleeAttack(node.params, context)
        break
      case 'charge_attack':
        result = this.actionChargeAttack(node.id, node.params, context)
        break
      case 'patrol':
        result = this.actionPatrol(node.id, node.params, context)
        break
      case 'flee':
        result = this.actionFlee(node.params, context)
        break
      case 'wait':
        result = this.actionWait(node.id, node.params, context)
        break
      case 'heal':
        result = this.actionHeal(node.params, context)
        break

      default:
        result = 'FAILURE'
    }

    context.recordNodeStatus?.(node.id, result)
    return result
  }

  // --- Composites ---

  private static evaluateSelector(node: BehaviorTreeNodeDef, context: BehaviorTreeContext): BehaviorTreeStatus {
    const children = node.children ?? []
    for (const child of children) {
      const status = this.evaluateNode(child, context)
      if (status === 'RUNNING') {
        return 'RUNNING'
      }
      if (status === 'SUCCESS') {
        return 'SUCCESS'
      }
    }
    return 'FAILURE'
  }

  private static evaluateSequence(node: BehaviorTreeNodeDef, context: BehaviorTreeContext): BehaviorTreeStatus {
    const children = node.children ?? []
    for (const child of children) {
      const status = this.evaluateNode(child, context)
      if (status === 'RUNNING') {
        return 'RUNNING'
      }
      if (status === 'FAILURE') {
        return 'FAILURE'
      }
    }
    return 'SUCCESS'
  }

  // --- Decorators ---

  private static evaluateInverter(node: BehaviorTreeNodeDef, context: BehaviorTreeContext): BehaviorTreeStatus {
    const child = node.children?.[0]
    if (!child) return 'FAILURE'

    const status = this.evaluateNode(child, context)
    if (status === 'SUCCESS') return 'FAILURE'
    if (status === 'FAILURE') return 'SUCCESS'
    return 'RUNNING'
  }

  private static evaluateCooldown(node: BehaviorTreeNodeDef, context: BehaviorTreeContext): BehaviorTreeStatus {
    const cooldownMs = node.params?.cooldownMs ?? 2000
    const key = `_cooldown_${node.id}`
    const now = (context.blackboard._timeMs as number) ?? 0
    const lastUsed = (context.blackboard[key] as number) ?? -Infinity

    if (now - lastUsed < cooldownMs) {
      return 'FAILURE'
    }

    const child = node.children?.[0]
    if (!child) {
      context.blackboard[key] = now
      return 'SUCCESS'
    }

    const status = this.evaluateNode(child, context)
    if (status === 'SUCCESS' || status === 'RUNNING') {
      context.blackboard[key] = now
    }
    return status
  }

  // --- Conditions ---

  private static condPlayerInRange(params: BehaviorNodeParams | undefined, context: BehaviorTreeContext): BehaviorTreeStatus {
    const playerObj = context.state.worldObjects.find((candidate) => candidate.id === WORLD_OBJECT_IDS.player)
    if (!playerObj) return 'FAILURE'

    const entityState = getMutableWorldObjectState<CharacterState>(context.entity)
    const playerState = getMutableWorldObjectState<CharacterState>(playerObj)
    if (!entityState.alive || !playerState.alive) return 'FAILURE'

    const range = params?.range ?? 350
    const dist = distance(entityState, playerState)
    return dist <= range ? 'SUCCESS' : 'FAILURE'
  }

  private static condPlayerInZone(params: BehaviorNodeParams | undefined, context: BehaviorTreeContext): BehaviorTreeStatus {
    const playerObj = context.state.worldObjects.find((candidate) => candidate.id === WORLD_OBJECT_IDS.player)
    if (!playerObj) return 'FAILURE'

    const playerState = getMutableWorldObjectState<CharacterState>(playerObj)
    if (!playerState.alive) return 'FAILURE'

    const zone = params?.zone ?? 'right'
    if (zone === 'right') {
      return playerState.x >= ROOM_LAYOUT.rightHalfStartX ? 'SUCCESS' : 'FAILURE'
    }
    if (zone === 'left') {
      return playerState.x < ROOM_LAYOUT.rightHalfStartX ? 'SUCCESS' : 'FAILURE'
    }
    return 'SUCCESS'
  }

  private static condHealthBelow(params: BehaviorNodeParams | undefined, context: BehaviorTreeContext): BehaviorTreeStatus {
    const entityState = getMutableWorldObjectState<CharacterState>(context.entity)
    if (!entityState.alive) return 'FAILURE'

    const thresholdPercent = params?.thresholdPercent ?? 50
    const maxHealth = entityState.maxHealth || 100
    const currentHealth = entityState.health ?? maxHealth
    const healthPercent = (currentHealth / maxHealth) * 100

    return healthPercent <= thresholdPercent ? 'SUCCESS' : 'FAILURE'
  }

  // --- Actions ---

  private static actionChasePlayer(params: BehaviorNodeParams | undefined, context: BehaviorTreeContext): BehaviorTreeStatus {
    const playerObj = context.state.worldObjects.find((candidate) => candidate.id === WORLD_OBJECT_IDS.player)
    if (!playerObj) return 'FAILURE'

    const entityState = getMutableWorldObjectState<CharacterState & { speed: number; chasing?: boolean; alerted?: boolean }>(context.entity)
    const playerState = getMutableWorldObjectState<CharacterState>(playerObj)
    if (!entityState.alive || !playerState.alive) return 'FAILURE'

    entityState.alerted = true

    const reach = weaponFor(entityState.weaponId).reach
    const gap = collision.gap(boxOf(entityState), boxOf(playerState))
    if (gap <= reach) {
      entityState.chasing = false
      return 'SUCCESS'
    }

    const multiplier = params?.speedMultiplier ?? 1.0
    const baseSpeed = typeof entityState.speed === 'number' ? entityState.speed : 210
    const speed = baseSpeed * multiplier

    const obstacles = getObstacles(context, context.entity.id)
    moveToward(entityState, playerState, speed, context.tickDurationMs, obstacles)
    entityState.chasing = true
    return 'RUNNING'
  }

  private static actionMeleeAttack(_params: BehaviorNodeParams | undefined, context: BehaviorTreeContext): BehaviorTreeStatus {
    const playerObj = context.state.worldObjects.find((candidate) => candidate.id === WORLD_OBJECT_IDS.player)
    if (!playerObj) return 'FAILURE'

    const entityState = getMutableWorldObjectState<CharacterState & { attacking?: boolean }>(context.entity)
    const playerState = getMutableWorldObjectState<CharacterState & { moveX?: number; moveY?: number; vx?: number; vy?: number }>(playerObj)
    if (!entityState.alive || !playerState.alive) return 'FAILURE'

    const reach = weaponFor(entityState.weaponId).reach
    const gap = collision.gap(boxOf(entityState), boxOf(playerState))
    if (gap > reach) {
      entityState.attacking = false
      return 'FAILURE'
    }

    const attack = combat.attack(context.state, context.entity.id)
    entityState.attacking = attack.status === 'hit'

    if (!playerState.alive) {
      playerState.moveX = 0
      playerState.moveY = 0
      playerState.vx = 0
      playerState.vy = 0
      context.state.outcome = 'game-over'
    }

    return attack.status === 'hit' ? 'SUCCESS' : 'FAILURE'
  }

  private static actionChargeAttack(nodeId: string, params: BehaviorNodeParams | undefined, context: BehaviorTreeContext): BehaviorTreeStatus {
    const playerObj = context.state.worldObjects.find((candidate) => candidate.id === WORLD_OBJECT_IDS.player)
    if (!playerObj) return 'FAILURE'

    const entityState = getMutableWorldObjectState<CharacterState & { speed: number; attacking?: boolean; alerted?: boolean }>(context.entity)
    const playerState = getMutableWorldObjectState<CharacterState & { moveX?: number; moveY?: number; vx?: number; vy?: number }>(playerObj)
    if (!entityState.alive || !playerState.alive) return 'FAILURE'

    const chargeKey = `_charge_${nodeId}`
    interface ChargeState {
      phase: 'windup' | 'charging'
      timer: number
      targetX: number
      targetY: number
    }

    let charge = context.blackboard[chargeKey] as ChargeState | undefined

    if (!charge) {
      charge = {
        phase: 'windup',
        timer: 300, // 300ms windup telegraph
        targetX: playerState.x,
        targetY: playerState.y,
      }
      context.blackboard[chargeKey] = charge
      entityState.alerted = true
      return 'RUNNING'
    }

    if (charge.phase === 'windup') {
      charge.timer -= context.tickDurationMs
      // Lock target at end of windup
      charge.targetX = playerState.x
      charge.targetY = playerState.y

      if (charge.timer <= 0) {
        charge.phase = 'charging'
        charge.timer = 700 // Up to 700ms charge time
      }
      return 'RUNNING'
    }

    // Charging phase
    charge.timer -= context.tickDurationMs
    const chargeSpeed = params?.chargeSpeed ?? ((typeof entityState.speed === 'number' ? entityState.speed : 210) * 2.2)

    const prevX = entityState.x
    const prevY = entityState.y

    const obstacles = getObstacles(context, context.entity.id)
    moveToward(entityState, { x: charge.targetX, y: charge.targetY }, chargeSpeed, context.tickDurationMs, obstacles)

    // Check collision / hit on player
    const gap = collision.gap(boxOf(entityState), boxOf(playerState))
    const reach = weaponFor(entityState.weaponId).reach + 10

    if (gap <= reach) {
      combat.attack(context.state, context.entity.id)
      entityState.attacking = true
      if (!playerState.alive) {
        playerState.moveX = 0
        playerState.moveY = 0
        playerState.vx = 0
        playerState.vy = 0
        context.state.outcome = 'game-over'
      }
      delete context.blackboard[chargeKey]
      return 'SUCCESS'
    }

    // End condition: timer expired or hit wall (didn't move)
    if (charge.timer <= 0 || (Math.abs(entityState.x - prevX) < 1 && Math.abs(entityState.y - prevY) < 1)) {
      delete context.blackboard[chargeKey]
      return 'SUCCESS'
    }

    return 'RUNNING'
  }

  private static actionPatrol(nodeId: string, params: BehaviorNodeParams | undefined, context: BehaviorTreeContext): BehaviorTreeStatus {
    const entityState = getMutableWorldObjectState<CharacterState & { speed: number; chasing?: boolean; alerted?: boolean }>(context.entity)
    if (!entityState.alive) return 'FAILURE'

    const waypoints = params?.waypoints && params.waypoints.length > 0
      ? params.waypoints
      : [
          { x: 1050, y: entityState.y },
          { x: 1650, y: entityState.y },
        ]

    const indexKey = `_patrol_idx_${nodeId}`
    let index = (context.blackboard[indexKey] as number) ?? 0
    if (index >= waypoints.length) {
      index = 0
      context.blackboard[indexKey] = 0
    }

    const target = waypoints[index]
    const speed = (typeof entityState.speed === 'number' ? entityState.speed : 210) * (params?.speedMultiplier ?? 0.8)
    const obstacles = getObstacles(context, context.entity.id)
    moveToward(entityState, target, speed, context.tickDurationMs, obstacles)

    if (distance(entityState, target) < 16) {
      index = (index + 1) % waypoints.length
      context.blackboard[indexKey] = index
    }

    entityState.chasing = false
    entityState.alerted = false
    return 'RUNNING'
  }

  private static actionFlee(params: BehaviorNodeParams | undefined, context: BehaviorTreeContext): BehaviorTreeStatus {
    const playerObj = context.state.worldObjects.find((candidate) => candidate.id === WORLD_OBJECT_IDS.player)
    if (!playerObj) return 'FAILURE'

    const entityState = getMutableWorldObjectState<CharacterState & { speed: number; chasing?: boolean }>(context.entity)
    const playerState = getMutableWorldObjectState<CharacterState>(playerObj)
    if (!entityState.alive || !playerState.alive) return 'FAILURE'

    const safeDistance = params?.safeDistance ?? 450
    const currentDist = distance(entityState, playerState)

    if (currentDist >= safeDistance) {
      entityState.chasing = false
      return 'SUCCESS'
    }

    const speed = (typeof entityState.speed === 'number' ? entityState.speed : 210) * (params?.speedMultiplier ?? 1.2)
    const obstacles = getObstacles(context, context.entity.id)
    moveAway(entityState, playerState, speed, context.tickDurationMs, obstacles)
    entityState.chasing = false
    return 'RUNNING'
  }

  private static actionWait(nodeId: string, params: BehaviorNodeParams | undefined, context: BehaviorTreeContext): BehaviorTreeStatus {
    const waitKey = `_wait_${nodeId}`
    const duration = params?.durationMs ?? 1000
    let elapsed = (context.blackboard[waitKey] as number) ?? 0

    elapsed += context.tickDurationMs
    context.blackboard[waitKey] = elapsed

    if (elapsed >= duration) {
      context.blackboard[waitKey] = 0
      return 'SUCCESS'
    }

    return 'RUNNING'
  }

  private static actionHeal(params: BehaviorNodeParams | undefined, context: BehaviorTreeContext): BehaviorTreeStatus {
    const entityState = getMutableWorldObjectState<CharacterState>(context.entity)
    if (!entityState.alive) return 'FAILURE'

    const maxHealth = entityState.maxHealth ?? 100
    const currentHealth = entityState.health ?? maxHealth
    if (currentHealth >= maxHealth) return 'SUCCESS'

    const amount = params?.healAmount ?? 10
    entityState.health = Math.min(maxHealth, currentHealth + amount)
    return 'SUCCESS'
  }
}

