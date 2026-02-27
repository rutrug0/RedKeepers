import {
  WORLD_MAP_MARCH_DISPATCH_FLOW,
  type WorldMapMarchDispatchAcceptedResponseDto,
  type WorldMapMarchDispatchErrorCode,
} from "../domain/world-map-march-dispatch-contract.ts";
import type {
  WorldMapMarchHeroAttachmentRuntimeState,
  WorldMapMarchRuntimeState,
  WorldMapMarchStateRepository,
} from "../ports/world-map-march-state-repository.ts";
import type {
  HeroAssignmentBoundContextType,
  HeroRuntimePersistenceRepository,
  HeroRuntimeWriteConflictCode,
} from "../../heroes/ports/hero-runtime-persistence-repository.ts";

const DEFAULT_SECONDS_PER_TILE = 30;

export interface WorldMapMarchDispatchInput {
  readonly march_id: string;
  readonly settlement_id: string;
  readonly origin: {
    readonly x: number;
    readonly y: number;
  };
  readonly target: {
    readonly x: number;
    readonly y: number;
  };
  readonly departed_at?: Date;
  readonly seconds_per_tile?: number;
  readonly attacker_strength: number;
  readonly defender_strength: number;
  readonly player_id?: string;
  readonly hero_id?: string;
  readonly hero_target_scope?: HeroAssignmentBoundContextType;
  readonly hero_assignment_context_id?: string;
}

export interface WorldMapMarchDispatchService {
  dispatchMarch(input: WorldMapMarchDispatchInput): WorldMapMarchDispatchAcceptedResponseDto;
}

export class WorldMapMarchDispatchOperationError extends Error {
  readonly status_code = 409;
  readonly code: WorldMapMarchDispatchErrorCode;

  constructor(
    code: WorldMapMarchDispatchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorldMapMarchDispatchOperationError";
    this.code = code;
  }
}

export class DeterministicWorldMapMarchDispatchService
  implements WorldMapMarchDispatchService
{
  private readonly marchStateRepository: WorldMapMarchStateRepository;
  private readonly defaultSecondsPerTile: number;
  private readonly heroAttachmentEnabled: boolean;
  private readonly heroRuntimePersistenceRepository?: HeroRuntimePersistenceRepository;

  constructor(
    marchStateRepository: WorldMapMarchStateRepository,
    options?: {
      readonly default_seconds_per_tile?: number;
      readonly hero_attachment_enabled?: boolean;
      readonly hero_runtime_persistence_repository?: HeroRuntimePersistenceRepository;
    },
  ) {
    this.marchStateRepository = marchStateRepository;
    this.defaultSecondsPerTile = normalizeMinimumPositiveInteger(
      options?.default_seconds_per_tile,
      DEFAULT_SECONDS_PER_TILE,
    );
    this.heroAttachmentEnabled = options?.hero_attachment_enabled ?? false;
    this.heroRuntimePersistenceRepository = options?.hero_runtime_persistence_repository;
  }

  dispatchMarch(input: WorldMapMarchDispatchInput): WorldMapMarchDispatchAcceptedResponseDto {
    const marchId = normalizeRequiredText(input.march_id, "march_id");
    const settlementId = normalizeRequiredText(input.settlement_id, "settlement_id");
    const departedAt = input.departed_at ?? new Date();
    const secondsPerTile = normalizeMinimumPositiveInteger(
      input.seconds_per_tile,
      this.defaultSecondsPerTile,
    );

    const existingMarch = this.marchStateRepository.readMarchRuntimeState({
      march_id: marchId,
    });
    if (existingMarch !== null) {
      throw new WorldMapMarchDispatchOperationError(
        "march_already_exists",
        `March '${marchId}' is already active in runtime state.`,
      );
    }

    const heroAttachment = this.resolveHeroAttachment({
      input,
      march_id: marchId,
      departed_at: departedAt,
    });
    const marchState = this.marchStateRepository.saveMarchRuntimeState({
      march_id: marchId,
      settlement_id: settlementId,
      march_revision: 1,
      march_state: "march_state_in_transit",
      origin: {
        x: normalizeFiniteNumber(input.origin.x),
        y: normalizeFiniteNumber(input.origin.y),
      },
      target: {
        x: normalizeFiniteNumber(input.target.x),
        y: normalizeFiniteNumber(input.target.y),
      },
      departed_at: new Date(departedAt.getTime()),
      seconds_per_tile: secondsPerTile,
      attacker_strength: normalizeFiniteNumber(input.attacker_strength),
      defender_strength: normalizeFiniteNumber(input.defender_strength),
      hero_attachment: heroAttachment,
    });
    const arrivesAt = resolveArrivesAt(marchState);

    return {
      flow: WORLD_MAP_MARCH_DISPATCH_FLOW,
      march_id: marchState.march_id,
      march_revision: marchState.march_revision,
      march_state: "march_state_in_transit",
      departed_at: new Date(marchState.departed_at.getTime()),
      arrives_at: arrivesAt,
      hero_attachment: heroAttachment === undefined
        ? undefined
        : cloneHeroAttachment(heroAttachment),
    };
  }

  private resolveHeroAttachment(input: {
    readonly input: WorldMapMarchDispatchInput;
    readonly march_id: string;
    readonly departed_at: Date;
  }): WorldMapMarchHeroAttachmentRuntimeState | undefined {
    const heroId = normalizeOptionalText(input.input.hero_id);
    if (heroId === undefined) {
      return undefined;
    }

    if (!this.heroAttachmentEnabled || this.heroRuntimePersistenceRepository === undefined) {
      throw new WorldMapMarchDispatchOperationError(
        "feature_not_in_slice",
        "Hero march attachment is disabled until the post-slice gate is enabled.",
      );
    }

    const playerId = normalizeOptionalText(input.input.player_id);
    if (playerId === undefined) {
      throw new WorldMapMarchDispatchOperationError(
        "hero_unavailable",
        "Hero attachment requires a player scope.",
      );
    }

    if (
      input.input.hero_target_scope !== undefined
      && input.input.hero_target_scope !== "army"
    ) {
      throw new WorldMapMarchDispatchOperationError(
        "hero_target_scope_mismatch",
        `Hero scope '${input.input.hero_target_scope}' is incompatible with march dispatch.`,
      );
    }

    const assignmentContextId = normalizeOptionalText(input.input.hero_assignment_context_id)
      ?? input.march_id;
    const runtime = this.heroRuntimePersistenceRepository.readRuntimeState({
      player_id: playerId,
      hero_id: heroId,
    });
    if (
      runtime === null
      || runtime.unlock_state !== "unlocked"
      || runtime.readiness_state !== "ready"
    ) {
      throw new WorldMapMarchDispatchOperationError(
        "hero_unavailable",
        `Hero '${heroId}' is unavailable for dispatch.`,
      );
    }

    if (runtime.assignment_context_type !== "none") {
      if (runtime.assignment_context_type !== "army") {
        throw new WorldMapMarchDispatchOperationError(
          "hero_target_scope_mismatch",
          `Hero '${heroId}' is assigned to '${runtime.assignment_context_type}'.`,
        );
      }
      if (runtime.assignment_context_id !== assignmentContextId) {
        throw new WorldMapMarchDispatchOperationError(
          "hero_already_assigned",
          `Hero '${heroId}' is already assigned to '${runtime.assignment_context_id}'.`,
        );
      }
    }

    const activeBinding = this.heroRuntimePersistenceRepository.readActiveAssignmentBinding({
      player_id: playerId,
      hero_id: heroId,
    });
    if (activeBinding !== null) {
      if (activeBinding.assignment_context_type !== "army") {
        throw new WorldMapMarchDispatchOperationError(
          "hero_target_scope_mismatch",
          `Hero '${heroId}' has active non-army binding '${activeBinding.assignment_context_type}'.`,
        );
      }
      if (activeBinding.assignment_context_id !== assignmentContextId) {
        throw new WorldMapMarchDispatchOperationError(
          "hero_already_assigned",
          `Hero '${heroId}' is already active on '${activeBinding.assignment_context_id}'.`,
        );
      }
      return {
        player_id: playerId,
        hero_id: heroId,
        assignment_id: activeBinding.assignment_id,
        assignment_context_type: "army",
        assignment_context_id: assignmentContextId,
        attached_at: new Date(input.departed_at.getTime()),
      };
    }

    const assignmentId = createHeroMarchAssignmentId({
      player_id: playerId,
      hero_id: heroId,
      assignment_context_id: assignmentContextId,
    });
    const assignmentMutation = this.heroRuntimePersistenceRepository.applyAssignmentMutation({
      player_id: playerId,
      hero_id: heroId,
      expected_revision: runtime.revision,
      now: input.departed_at,
      assignment: {
        assignment_id: assignmentId,
        assignment_context_type: "army",
        assignment_context_id: assignmentContextId,
      },
    });

    if (assignmentMutation.status === "conflict") {
      throw new WorldMapMarchDispatchOperationError(
        mapAssignmentConflictToDispatchError(assignmentMutation.conflict_code),
        assignmentMutation.message,
      );
    }

    return {
      player_id: playerId,
      hero_id: heroId,
      assignment_id: assignmentMutation.result.active_binding?.assignment_id ?? assignmentId,
      assignment_context_type: "army",
      assignment_context_id: assignmentContextId,
      attached_at: new Date(input.departed_at.getTime()),
    };
  }
}

function mapAssignmentConflictToDispatchError(
  conflictCode: HeroRuntimeWriteConflictCode,
): Extract<
  WorldMapMarchDispatchErrorCode,
  "hero_unavailable" | "hero_already_assigned" | "hero_target_scope_mismatch"
> {
  switch (conflictCode) {
    case "context_already_bound":
    case "assignment_id_conflict":
      return "hero_already_assigned";
    case "assignment_context_not_owned":
    case "assignment_context_mismatch":
      return "hero_target_scope_mismatch";
    default:
      return "hero_unavailable";
  }
}

function createHeroMarchAssignmentId(input: {
  readonly player_id: string;
  readonly hero_id: string;
  readonly assignment_context_id: string;
}): string {
  return `assign:${input.player_id}:${input.hero_id}:army:${input.assignment_context_id}`;
}

function resolveArrivesAt(state: WorldMapMarchRuntimeState): Date {
  const distanceTiles = Math.abs(state.target.x - state.origin.x)
    + Math.abs(state.target.y - state.origin.y);
  const secondsPerTile = normalizeMinimumPositiveInteger(
    state.seconds_per_tile,
    DEFAULT_SECONDS_PER_TILE,
  );
  return new Date(state.departed_at.getTime() + distanceTiles * secondsPerTile * 1000);
}

function cloneHeroAttachment(
  input: WorldMapMarchHeroAttachmentRuntimeState,
): WorldMapMarchHeroAttachmentRuntimeState {
  return {
    ...input,
    attached_at: new Date(input.attached_at.getTime()),
    detached_at: input.detached_at === undefined
      ? undefined
      : new Date(input.detached_at.getTime()),
  };
}

function normalizeRequiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Expected non-empty '${field}'.`);
  }
  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeMinimumPositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.trunc(value));
}

function normalizeFiniteNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
}
