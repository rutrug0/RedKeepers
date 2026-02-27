import type { Instant } from "../../../shared/index.ts";

export type HeroUnlockState = "locked" | "unlocked";
export type HeroReadinessState = "ready" | "on_cooldown";
export type HeroAssignmentContextType =
  | "none"
  | "army"
  | "scout_detachment"
  | "siege_column";
export type HeroAssignmentBoundContextType = Exclude<
  HeroAssignmentContextType,
  "none"
>;

export interface HeroRuntimeState {
  readonly hero_runtime_id: string;
  readonly player_id: string;
  readonly hero_id: string;
  readonly active_ability_id: string;
  readonly unlock_state: HeroUnlockState;
  readonly readiness_state: HeroReadinessState;
  readonly assignment_context_type: HeroAssignmentContextType;
  readonly assignment_context_id?: string;
  readonly cooldown_started_at?: Instant;
  readonly cooldown_ends_at?: Instant;
  readonly last_ability_activated_at?: Instant;
  readonly revision: number;
  readonly updated_at: Instant;
}

export interface HeroRuntimeStateSeedInput {
  readonly hero_runtime_id: string;
  readonly player_id: string;
  readonly hero_id: string;
  readonly active_ability_id: string;
  readonly unlock_state: HeroUnlockState;
  readonly readiness_state: HeroReadinessState;
  readonly assignment_context_type?: HeroAssignmentContextType;
  readonly assignment_context_id?: string;
  readonly cooldown_started_at?: Instant;
  readonly cooldown_ends_at?: Instant;
  readonly last_ability_activated_at?: Instant;
  readonly revision?: number;
  readonly updated_at: Instant;
}

export interface HeroAssignmentBinding {
  readonly assignment_id: string;
  readonly player_id: string;
  readonly hero_id: string;
  readonly assignment_context_type: HeroAssignmentBoundContextType;
  readonly assignment_context_id: string;
  readonly is_active: boolean;
  readonly assigned_at: Instant;
  readonly unassigned_at?: Instant;
}

export type HeroModifierDomain = "combat" | "scout" | "siege" | "logistics";
export type HeroModifierOp = "add" | "mul";
export type HeroModifierStatus = "active" | "consumed" | "expired";

export interface HeroModifierInstance {
  readonly modifier_instance_id: string;
  readonly player_id: string;
  readonly hero_id: string;
  readonly ability_id: string;
  readonly modifier_id: string;
  readonly domain: HeroModifierDomain;
  readonly stat_key: string;
  readonly op: HeroModifierOp;
  readonly value: string;
  readonly trigger_window: string;
  readonly remaining_charges: number;
  readonly assignment_context_type: HeroAssignmentBoundContextType;
  readonly assignment_context_id: string;
  readonly activated_at: Instant;
  readonly expires_at?: Instant;
  readonly consumed_at?: Instant;
  readonly status: HeroModifierStatus;
}

export interface HeroModifierActivationInput {
  readonly modifier_instance_id: string;
  readonly modifier_id: string;
  readonly domain: HeroModifierDomain;
  readonly stat_key: string;
  readonly op: HeroModifierOp;
  readonly value: string;
  readonly trigger_window: string;
  readonly remaining_charges: number;
  readonly expires_at?: Instant;
  readonly exclusive_by_stat?: boolean;
}

export interface HeroModifierLifecycleMutationInput {
  readonly modifier_instance_id: string;
  readonly remaining_charges: number;
  readonly status: HeroModifierStatus;
  readonly consumed_at?: Instant;
}

export interface HeroModifierLifecycleWriteInput {
  readonly player_id: string;
  readonly now: Instant;
  readonly mutations: readonly HeroModifierLifecycleMutationInput[];
}

export interface HeroAssignmentMutationInput {
  readonly player_id: string;
  readonly hero_id: string;
  readonly expected_revision: number;
  readonly now: Instant;
  readonly assignment:
    | {
        readonly assignment_id: string;
        readonly assignment_context_type: HeroAssignmentBoundContextType;
        readonly assignment_context_id: string;
      }
    | null;
}

export interface HeroAssignmentArmyOwnershipReadRepository {
  isArmyOwnedByPlayer(input: {
    readonly player_id: string;
    readonly army_id: string;
  }): boolean;
}

export interface HeroAssignmentScoutDetachmentOwnershipReadRepository {
  isScoutDetachmentOwnedByPlayer(input: {
    readonly player_id: string;
    readonly scout_detachment_id: string;
  }): boolean;
}

export interface HeroAssignmentSiegeColumnOwnershipReadRepository {
  isSiegeColumnOwnedByPlayer(input: {
    readonly player_id: string;
    readonly siege_column_id: string;
  }): boolean;
}

export interface HeroAssignmentContextOwnershipReadRepositories {
  readonly army: HeroAssignmentArmyOwnershipReadRepository;
  readonly scout_detachment: HeroAssignmentScoutDetachmentOwnershipReadRepository;
  readonly siege_column: HeroAssignmentSiegeColumnOwnershipReadRepository;
}

export interface HeroAbilityActivationWriteInput {
  readonly player_id: string;
  readonly hero_id: string;
  readonly ability_id: string;
  readonly expected_revision: number;
  readonly activated_at: Instant;
  readonly cooldown_ends_at: Instant;
  readonly assignment_context_type: HeroAssignmentBoundContextType;
  readonly assignment_context_id: string;
  readonly modifiers: readonly HeroModifierActivationInput[];
}

export type HeroRuntimeWriteConflictCode =
  | "runtime_not_found"
  | "revision_conflict"
  | "assignment_context_not_owned"
  | "context_already_bound"
  | "assignment_id_conflict"
  | "assignment_context_mismatch"
  | "hero_not_assigned"
  | "readiness_conflict"
  | "cooldown_window_invalid"
  | "modifier_instance_conflict"
  | "modifier_exclusive_stat_conflict"
  | "modifier_not_found"
  | "modifier_not_active"
  | "modifier_player_mismatch";

export interface HeroRuntimeWriteApplied<TResult> {
  readonly status: "applied";
  readonly result: TResult;
}

export interface HeroRuntimeWriteConflict {
  readonly status: "conflict";
  readonly conflict_code: HeroRuntimeWriteConflictCode;
  readonly message: string;
  readonly current_runtime_state?: HeroRuntimeState;
}

export type HeroRuntimeWriteResult<TResult> =
  | HeroRuntimeWriteApplied<TResult>
  | HeroRuntimeWriteConflict;

export interface HeroAssignmentMutationApplied {
  readonly runtime_state: HeroRuntimeState;
  readonly active_binding: HeroAssignmentBinding | null;
  readonly deactivated_assignment_ids: readonly string[];
}

export interface HeroAbilityActivationApplied {
  readonly runtime_state: HeroRuntimeState;
  readonly created_modifier_instance_ids: readonly string[];
}

export interface HeroModifierLifecycleApplied {
  readonly updated_modifier_instance_ids: readonly string[];
}

export interface HeroRuntimePersistenceSnapshot {
  readonly runtime_states: readonly HeroRuntimeState[];
  readonly assignment_bindings: readonly HeroAssignmentBinding[];
  readonly modifier_instances: readonly HeroModifierInstance[];
}

export interface HeroRuntimePersistenceRepository {
  ensureRuntimeState(input: HeroRuntimeStateSeedInput): HeroRuntimeState;

  readRuntimeState(input: {
    readonly player_id: string;
    readonly hero_id: string;
  }): HeroRuntimeState | null;

  readActiveAssignmentBinding(input: {
    readonly player_id: string;
    readonly hero_id: string;
  }): HeroAssignmentBinding | null;

  listModifierInstances(input: {
    readonly player_id: string;
    readonly hero_id?: string;
    readonly assignment_context_type?: HeroAssignmentBoundContextType;
    readonly assignment_context_id?: string;
    readonly status?: HeroModifierStatus;
  }): readonly HeroModifierInstance[];

  applyAssignmentMutation(
    input: HeroAssignmentMutationInput,
  ): HeroRuntimeWriteResult<HeroAssignmentMutationApplied>;

  applyAbilityActivation(
    input: HeroAbilityActivationWriteInput,
  ): HeroRuntimeWriteResult<HeroAbilityActivationApplied>;

  applyModifierLifecycle(
    input: HeroModifierLifecycleWriteInput,
  ): HeroRuntimeWriteResult<HeroModifierLifecycleApplied>;
}
