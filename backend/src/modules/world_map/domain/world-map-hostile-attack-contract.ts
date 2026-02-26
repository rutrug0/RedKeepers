import type { WorldMapMarchCombatOutcome } from "./world-map-march-snapshot-contract";

export const WORLD_MAP_HOSTILE_ATTACK_FLOW = "world_map.hostile_attack_v1" as const;

export const WORLD_MAP_HOSTILE_ATTACK_EVENT_PAYLOAD_KEYS = [
  "dispatch_sent",
  "march_arrived",
  "combat_resolved",
] as const;

export type WorldMapHostileAttackEventPayloadKey =
  (typeof WORLD_MAP_HOSTILE_ATTACK_EVENT_PAYLOAD_KEYS)[number];

export interface WorldMapHostileAttackEventPayload {
  readonly payload_key: WorldMapHostileAttackEventPayloadKey;
  readonly content_key: string;
  readonly content_key_aliases?: readonly string[];
  readonly occurred_at: Date;
  readonly tokens: Readonly<Record<string, string>>;
}

export interface WorldMapHostileAttackLossSummaryDto {
  readonly attacker_loss_ratio: number;
  readonly defender_loss_ratio: number;
  readonly attacker_units_dispatched: number;
  readonly attacker_units_lost: number;
  readonly attacker_units_remaining: number;
  readonly defender_garrison_lost: number;
  readonly defender_garrison_remaining: number;
  readonly attacker_unit_losses_by_id: Readonly<Record<string, number>>;
}

export interface WorldMapHostileAttackResolvedResponseDto {
  readonly flow: typeof WORLD_MAP_HOSTILE_ATTACK_FLOW;
  readonly march_id: string;
  readonly march_revision: number;
  readonly march_state: "march_state_resolved";
  readonly source_settlement_id: string;
  readonly target_settlement_id: string;
  readonly departed_at: Date;
  readonly arrives_at: Date;
  readonly resolved_at: Date;
  readonly attacker_strength: number;
  readonly defender_strength: number;
  readonly combat_outcome: WorldMapMarchCombatOutcome;
  readonly losses: WorldMapHostileAttackLossSummaryDto;
  readonly event_payloads: {
    readonly dispatch_sent: WorldMapHostileAttackEventPayload;
    readonly march_arrived: WorldMapHostileAttackEventPayload;
    readonly combat_resolved: WorldMapHostileAttackEventPayload;
  };
  readonly events: readonly WorldMapHostileAttackEventPayload[];
}
