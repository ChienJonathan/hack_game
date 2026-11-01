import type { BehaviorTreeDef } from './BehaviorTreeTypes.ts'

export const STANDARD_GUARD_TREE: BehaviorTreeDef = {
  id: 'standard-guard',
  name: 'Standard Guard AI',
  description: 'Classic room guard. Aggros when player enters right half, chases and attacks.',
  root: {
    id: 'root-selector',
    type: 'selector',
    name: 'Root Selector',
    children: [
      {
        id: 'seq-engage',
        type: 'sequence',
        name: 'Engage Player',
        children: [
          {
            id: 'cond-player-zone',
            type: 'is_player_in_zone',
            name: 'Player in Right Half',
            params: { zone: 'right' },
          },
          {
            id: 'sel-attack-or-chase',
            type: 'selector',
            name: 'Attack or Chase',
            children: [
              {
                id: 'act-melee-attack',
                type: 'melee_attack',
                name: 'Melee Attack',
              },
              {
                id: 'act-chase-player',
                type: 'chase_player',
                name: 'Chase Player',
                params: { speedMultiplier: 1.0 },
              },
            ],
          },
        ],
      },
    ],
  },
}

export const PATROL_GUARD_TREE: BehaviorTreeDef = {
  id: 'patrol-guard',
  name: 'Patrol & Ambush Guard',
  description: 'Patrols area until player is detected within 380px, then engages.',
  root: {
    id: 'root-patrol-selector',
    type: 'selector',
    name: 'Root Selector',
    children: [
      {
        id: 'seq-patrol-detect',
        type: 'sequence',
        name: 'Detect & Engage',
        children: [
          {
            id: 'cond-patrol-range',
            type: 'is_player_in_range',
            name: 'Player within 380px',
            params: { range: 380 },
          },
          {
            id: 'sel-patrol-combat',
            type: 'selector',
            name: 'Combat Options',
            children: [
              {
                id: 'act-patrol-melee',
                type: 'melee_attack',
                name: 'Melee Attack',
              },
              {
                id: 'act-patrol-chase',
                type: 'chase_player',
                name: 'Chase Player',
                params: { speedMultiplier: 1.15 },
              },
            ],
          },
        ],
      },
      {
        id: 'act-patrol-loop',
        type: 'patrol',
        name: 'Patrol Waypoints',
        params: { speedMultiplier: 0.8 },
      },
    ],
  },
}

export const BOSS_CYBER_ENFORCER_TREE: BehaviorTreeDef = {
  id: 'boss-cyber-enforcer',
  name: 'Boss: Cyber Enforcer (2-Phase)',
  description: 'Multi-phase boss. Phase 1 stalker; Phase 2 (<50% HP) enrages with high-speed charge attack.',
  root: {
    id: 'boss-root',
    type: 'selector',
    name: 'Boss AI Root',
    children: [
      {
        id: 'boss-phase2-seq',
        type: 'sequence',
        name: 'Phase 2: Enraged Berserk (HP < 50%)',
        children: [
          {
            id: 'boss-cond-hp-low',
            type: 'is_health_below',
            name: 'Health < 50%',
            params: { thresholdPercent: 50 },
          },
          {
            id: 'boss-p2-actions',
            type: 'selector',
            name: 'Enraged Offensive',
            children: [
              {
                id: 'boss-p2-melee',
                type: 'melee_attack',
                name: 'Deadly Strike',
              },
              {
                id: 'boss-p2-charge-cooldown',
                type: 'cooldown',
                name: 'Charge Cooldown (3.5s)',
                params: { cooldownMs: 3500 },
                children: [
                  {
                    id: 'boss-p2-charge-action',
                    type: 'charge_attack',
                    name: 'High-Speed Charge Dash',
                    params: { chargeSpeed: 600 },
                  },
                ],
              },
              {
                id: 'boss-p2-furious-chase',
                type: 'chase_player',
                name: 'Furious Chase (1.4x Speed)',
                params: { speedMultiplier: 1.4 },
              },
            ],
          },
        ],
      },
      {
        id: 'boss-phase1-seq',
        type: 'sequence',
        name: 'Phase 1: Tactical Stalker',
        children: [
          {
            id: 'boss-p1-actions',
            type: 'selector',
            name: 'Stalker Actions',
            children: [
              {
                id: 'boss-p1-melee',
                type: 'melee_attack',
                name: 'Melee Strike',
              },
              {
                id: 'boss-p1-hunt-seq',
                type: 'sequence',
                name: 'Hunt Player',
                children: [
                  {
                    id: 'boss-p1-range-check',
                    type: 'is_player_in_range',
                    name: 'Player within 500px',
                    params: { range: 500 },
                  },
                  {
                    id: 'boss-p1-chase',
                    type: 'chase_player',
                    name: 'Pursue Player',
                    params: { speedMultiplier: 1.0 },
                  },
                ],
              },
              {
                id: 'boss-p1-patrol',
                type: 'patrol',
                name: 'Patrol Area',
                params: { speedMultiplier: 0.8 },
              },
            ],
          },
        ],
      },
    ],
  },
}

export const HIT_AND_RUN_TREE: BehaviorTreeDef = {
  id: 'hit-and-run',
  name: 'Hit & Run Skirmisher',
  description: 'Fast skirmisher. Attacks player, flees to safe distance, resets and attacks again.',
  root: {
    id: 'skirmish-root',
    type: 'selector',
    name: 'Skirmisher Root',
    children: [
      {
        id: 'skirmish-emergency-retreat',
        type: 'sequence',
        name: 'Retreat if Low HP (< 30%)',
        children: [
          {
            id: 'skirmish-cond-hp',
            type: 'is_health_below',
            name: 'Health < 30%',
            params: { thresholdPercent: 30 },
          },
          {
            id: 'skirmish-act-flee-safe',
            type: 'flee',
            name: 'Flee to Safe Zone',
            params: { safeDistance: 450, speedMultiplier: 1.3 },
          },
        ],
      },
      {
        id: 'skirmish-strike-retreat-seq',
        type: 'sequence',
        name: 'Strike & Reposition',
        children: [
          {
            id: 'skirmish-cond-detect',
            type: 'is_player_in_range',
            name: 'Player within 420px',
            params: { range: 420 },
          },
          {
            id: 'skirmish-combat-sel',
            type: 'selector',
            name: 'Close or Strike',
            children: [
              {
                id: 'skirmish-atk',
                type: 'melee_attack',
                name: 'Melee Attack',
              },
              {
                id: 'skirmish-approach',
                type: 'chase_player',
                name: 'Swift Approach',
                params: { speedMultiplier: 1.25 },
              },
            ],
          },
        ],
      },
      {
        id: 'skirmish-default-patrol',
        type: 'patrol',
        name: 'Patrol',
        params: { speedMultiplier: 0.9 },
      },
    ],
  },
}

export const TANK_BOSS_TREE: BehaviorTreeDef = {
  id: 'tank-boss',
  name: 'Tank Boss (Shield & Recovery)',
  description: 'Heavy armor boss. Recovers health when player keeps distance; heavy melee up close.',
  root: {
    id: 'tank-root',
    type: 'selector',
    name: 'Tank Boss Root',
    children: [
      {
        id: 'tank-heal-seq',
        type: 'sequence',
        name: 'Recover When Clear (HP < 40%)',
        children: [
          {
            id: 'tank-cond-hp',
            type: 'is_health_below',
            name: 'Health < 40%',
            params: { thresholdPercent: 40 },
          },
          {
            id: 'tank-invert-near',
            type: 'inverter',
            name: 'Player Not Near',
            children: [
              {
                id: 'tank-cond-near',
                type: 'is_player_in_range',
                name: 'Player within 250px',
                params: { range: 250 },
              },
            ],
          },
          {
            id: 'tank-cooldown-heal',
            type: 'cooldown',
            name: 'Repair Cooldown (4s)',
            params: { cooldownMs: 4000 },
            children: [
              {
                id: 'tank-act-heal',
                type: 'heal',
                name: 'Repair Chassis (+20 HP)',
                params: { healAmount: 20 },
              },
            ],
          },
        ],
      },
      {
        id: 'tank-offense-sel',
        type: 'selector',
        name: 'Offensive Options',
        children: [
          {
            id: 'tank-act-smash',
            type: 'melee_attack',
            name: 'Heavy Smash',
          },
          {
            id: 'tank-pursue-seq',
            type: 'sequence',
            name: 'Pursue Player',
            children: [
              {
                id: 'tank-detect-range',
                type: 'is_player_in_range',
                name: 'Player within 550px',
                params: { range: 550 },
              },
              {
                id: 'tank-chase',
                type: 'chase_player',
                name: 'Slow Heavy Advance',
                params: { speedMultiplier: 0.9 },
              },
            ],
          },
          {
            id: 'tank-patrol',
            type: 'patrol',
            name: 'Area Patrol',
            params: { speedMultiplier: 0.7 },
          },
        ],
      },
    ],
  },
}

export const PRESET_BEHAVIOR_TREES: readonly BehaviorTreeDef[] = [
  STANDARD_GUARD_TREE,
  PATROL_GUARD_TREE,
  BOSS_CYBER_ENFORCER_TREE,
  HIT_AND_RUN_TREE,
  TANK_BOSS_TREE,
]

export function cloneBehaviorTree(tree: BehaviorTreeDef): BehaviorTreeDef {
  return JSON.parse(JSON.stringify(tree))
}
