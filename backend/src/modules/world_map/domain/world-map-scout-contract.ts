export const WORLD_MAP_SCOUT_SELECT_FLOW = "world_map.scout_select_v1" as const;

export const WORLD_MAP_TILE_STATES = [
  "tile_state_unknown",
  "tile_state_quiet",
  "tile_state_hostile_hint",
] as const;

export type WorldMapTileState = (typeof WORLD_MAP_TILE_STATES)[number];

export const WORLD_MAP_SCOUT_INTERACTION_OUTCOMES = [
  "outcome_scout_dispatched",
  "outcome_scout_report_empty",
  "outcome_scout_report_hostile",
] as const;

export type WorldMapScoutInteractionOutcome =
  (typeof WORLD_MAP_SCOUT_INTERACTION_OUTCOMES)[number];

export const WORLD_MAP_SCOUT_EVENT_CONTENT_KEYS = [
  "event.world.scout_dispatched",
  "event.world.scout_report_empty",
  "event.world.scout_report_hostile",
] as const;

export type WorldMapScoutEventContentKey =
  (typeof WORLD_MAP_SCOUT_EVENT_CONTENT_KEYS)[number];

export interface WorldMapScoutDispatchedEvent {
  readonly content_key: "event.world.scout_dispatched";
  readonly tokens: {
    readonly settlement_name: string;
    readonly target_tile_label: string;
  };
}

export interface WorldMapScoutReportEmptyEvent {
  readonly content_key: "event.world.scout_report_empty";
  readonly tokens: {
    readonly target_tile_label: string;
  };
}

export interface WorldMapScoutReportHostileEvent {
  readonly content_key: "event.world.scout_report_hostile";
  readonly tokens: {
    readonly target_tile_label: string;
    readonly hostile_force_estimate: string;
  };
}

export type WorldMapScoutEvent =
  | WorldMapScoutDispatchedEvent
  | WorldMapScoutReportEmptyEvent
  | WorldMapScoutReportHostileEvent;

interface WorldMapScoutSelectResponseBase {
  readonly flow: typeof WORLD_MAP_SCOUT_SELECT_FLOW;
  readonly tile_id: string;
  readonly tile_state: WorldMapTileState;
  readonly tile_revision: number;
}

export interface WorldMapScoutDispatchedResponse
  extends WorldMapScoutSelectResponseBase
{
  readonly interaction_outcome: "outcome_scout_dispatched";
  readonly event: WorldMapScoutDispatchedEvent;
}

export interface WorldMapScoutReportEmptyResponse
  extends WorldMapScoutSelectResponseBase
{
  readonly interaction_outcome: "outcome_scout_report_empty";
  readonly event: WorldMapScoutReportEmptyEvent;
}

export interface WorldMapScoutReportHostileResponse
  extends WorldMapScoutSelectResponseBase
{
  readonly interaction_outcome: "outcome_scout_report_hostile";
  readonly event: WorldMapScoutReportHostileEvent;
}

export type WorldMapScoutSelectResponseDto =
  | WorldMapScoutDispatchedResponse
  | WorldMapScoutReportEmptyResponse
  | WorldMapScoutReportHostileResponse;
