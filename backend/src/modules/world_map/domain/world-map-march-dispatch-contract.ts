export const WORLD_MAP_MARCH_DISPATCH_FLOW = "world_map.march_dispatch_v1" as const;

export const WORLD_MAP_MARCH_DISPATCH_ERROR_CODES = [
  "feature_not_in_slice",
  "hero_unavailable",
  "hero_already_assigned",
  "hero_target_scope_mismatch",
  "march_already_exists",
] as const;

export type WorldMapMarchDispatchErrorCode =
  (typeof WORLD_MAP_MARCH_DISPATCH_ERROR_CODES)[number];

export interface WorldMapMarchDispatchHeroAttachmentDto {
  readonly player_id: string;
  readonly hero_id: string;
  readonly assignment_id: string;
  readonly assignment_context_type: "army";
  readonly assignment_context_id: string;
  readonly attached_at: Date;
  readonly detached_at?: Date;
}

export interface WorldMapMarchDispatchAcceptedResponseDto {
  readonly flow: typeof WORLD_MAP_MARCH_DISPATCH_FLOW;
  readonly march_id: string;
  readonly march_revision: number;
  readonly march_state: "march_state_in_transit";
  readonly departed_at: Date;
  readonly arrives_at: Date;
  readonly hero_attachment?: WorldMapMarchDispatchHeroAttachmentDto;
}
