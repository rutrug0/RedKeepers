export const WORLD_MAP_NEUTRAL_GATHERING_FLOW = "world_map.neutral_gathering_v1" as const;

export const WORLD_MAP_NEUTRAL_NODE_STATES = [
  "neutral_node_active",
  "neutral_node_depleted",
] as const;

export type WorldMapNeutralNodeState = (typeof WORLD_MAP_NEUTRAL_NODE_STATES)[number];

export const WORLD_MAP_GATHER_MARCH_STATES = [
  "gather_march_in_progress",
  "gather_march_resolved",
] as const;

export type WorldMapGatherMarchState = (typeof WORLD_MAP_GATHER_MARCH_STATES)[number];

export const WORLD_MAP_AMBUSH_OUTCOMES = [
  "ambush_not_triggered",
  "ambush_repelled",
  "ambush_intercepted",
] as const;

export type WorldMapAmbushOutcome = (typeof WORLD_MAP_AMBUSH_OUTCOMES)[number];

export const WORLD_MAP_NEUTRAL_GATHER_EVENT_CONTENT_KEYS = [
  "event.world.gather_started",
  "event.world.gather_completed",
  "event.world.ambush_triggered",
  "event.world.ambush_resolved",
] as const;

export type WorldMapNeutralGatherEventContentKey =
  (typeof WORLD_MAP_NEUTRAL_GATHER_EVENT_CONTENT_KEYS)[number];

export interface WorldMapGatherYieldOutput {
  readonly resource_id: string;
  readonly amount: number;
}

export interface WorldMapGatherYieldRange {
  readonly resource_id: string;
  readonly min_amount: number;
  readonly max_amount: number;
}

export interface WorldMapNeutralNodeSpawnTableRow {
  readonly node_type: string;
  readonly node_label: string;
  readonly spawn_count: number;
  readonly yield_ranges: readonly WorldMapGatherYieldRange[];
  readonly gather_duration_seconds: number;
  readonly ambush_risk_pct: number;
  readonly ambush_base_strength: number;
  readonly depletion_cycles: number;
}

export interface WorldMapGatherStartedEvent {
  readonly content_key: "event.world.gather_started";
  readonly tokens: {
    readonly army_name: string;
    readonly node_label: string;
  };
}

export interface WorldMapGatherCompletedEvent {
  readonly content_key: "event.world.gather_completed";
  readonly tokens: {
    readonly army_name: string;
    readonly node_label: string;
    readonly haul_summary: string;
  };
}

export interface WorldMapAmbushTriggeredEvent {
  readonly content_key: "event.world.ambush_triggered";
  readonly tokens: {
    readonly army_name: string;
    readonly node_label: string;
    readonly ambush_strength: string;
  };
}

export interface WorldMapAmbushResolvedEvent {
  readonly content_key: "event.world.ambush_resolved";
  readonly tokens: {
    readonly army_name: string;
    readonly node_label: string;
    readonly ambush_outcome: WorldMapAmbushOutcome;
    readonly haul_summary: string;
  };
}

export type WorldMapNeutralGatherEvent =
  | WorldMapGatherStartedEvent
  | WorldMapGatherCompletedEvent
  | WorldMapAmbushTriggeredEvent
  | WorldMapAmbushResolvedEvent;

export interface WorldMapAmbushSummary {
  readonly ambush_triggered: boolean;
  readonly ambush_roll: number;
  readonly ambush_strength: number;
  readonly escort_strength: number;
  readonly outcome: WorldMapAmbushOutcome;
}

export interface WorldMapNeutralGatheringResolutionResponseDto {
  readonly flow: typeof WORLD_MAP_NEUTRAL_GATHERING_FLOW;
  readonly world_id: string;
  readonly march_id: string;
  readonly march_revision: number;
  readonly march_state: WorldMapGatherMarchState;
  readonly node_id: string;
  readonly node_revision: number;
  readonly observed_at: Date;
  readonly resolved_at?: Date;
  readonly gathered_yield: readonly WorldMapGatherYieldOutput[];
  readonly ambush: WorldMapAmbushSummary;
  readonly events: readonly WorldMapNeutralGatherEvent[];
}
