import type {
  HeroAbilityActivationApplied,
  HeroAbilityActivationWriteInput,
  HeroAssignmentBinding,
  HeroAssignmentBoundContextType,
  HeroAssignmentContextOwnershipReadRepositories,
  HeroAssignmentContextType,
  HeroAssignmentMutationApplied,
  HeroAssignmentMutationInput,
  HeroModifierActivationInput,
  HeroModifierLifecycleApplied,
  HeroModifierLifecycleMutationInput,
  HeroModifierLifecycleWriteInput,
  HeroModifierInstance,
  HeroModifierStatus,
  HeroRuntimePersistenceRepository,
  HeroRuntimePersistenceSnapshot,
  HeroRuntimeState,
  HeroRuntimeStateSeedInput,
  HeroRuntimeWriteConflict,
  HeroRuntimeWriteConflictCode,
  HeroRuntimeWriteResult,
} from "../ports/hero-runtime-persistence-repository.ts";

export class InMemoryHeroRuntimePersistenceRepository
  implements HeroRuntimePersistenceRepository
{
  private readonly runtimeByHeroKey = new Map<string, HeroRuntimeState>();
  private readonly assignmentBindingById = new Map<string, HeroAssignmentBinding>();
  private readonly modifierInstanceById = new Map<string, HeroModifierInstance>();
  private readonly assignmentContextOwnershipReadRepositories:
    HeroAssignmentContextOwnershipReadRepositories;

  constructor(input?: {
    readonly initial_snapshot?: HeroRuntimePersistenceSnapshot;
    readonly assignment_context_ownership_read_repositories?:
      HeroAssignmentContextOwnershipReadRepositories;
  }) {
    this.assignmentContextOwnershipReadRepositories =
      input?.assignment_context_ownership_read_repositories
      ?? createRejectingContextOwnershipReadRepositories();
    if (input?.initial_snapshot !== undefined) {
      this.replaceSnapshot(input.initial_snapshot);
    }
  }

  replaceSnapshot(snapshot: HeroRuntimePersistenceSnapshot): void {
    this.runtimeByHeroKey.clear();
    this.assignmentBindingById.clear();
    this.modifierInstanceById.clear();

    for (const runtimeState of snapshot.runtime_states) {
      const normalized = normalizeRuntimeState(runtimeState);
      this.runtimeByHeroKey.set(
        toHeroRuntimeKey(normalized.player_id, normalized.hero_id),
        normalized,
      );
    }

    for (const binding of snapshot.assignment_bindings) {
      const normalized = normalizeAssignmentBinding(binding);
      this.assignmentBindingById.set(normalized.assignment_id, normalized);
    }

    for (const modifier of snapshot.modifier_instances) {
      const normalized = normalizeModifierInstance(modifier);
      this.modifierInstanceById.set(normalized.modifier_instance_id, normalized);
    }
  }

  exportSnapshot(): HeroRuntimePersistenceSnapshot {
    const runtimeStates = [...this.runtimeByHeroKey.values()]
      .map((state) => cloneRuntimeState(state))
      .sort((left, right) => left.hero_runtime_id.localeCompare(right.hero_runtime_id));

    const assignmentBindings = [...this.assignmentBindingById.values()]
      .map((binding) => cloneAssignmentBinding(binding))
      .sort((left, right) => left.assignment_id.localeCompare(right.assignment_id));

    const modifierInstances = [...this.modifierInstanceById.values()]
      .map((modifier) => cloneModifierInstance(modifier))
      .sort((left, right) => left.modifier_instance_id.localeCompare(right.modifier_instance_id));

    return {
      runtime_states: runtimeStates,
      assignment_bindings: assignmentBindings,
      modifier_instances: modifierInstances,
    };
  }

  ensureRuntimeState(input: HeroRuntimeStateSeedInput): HeroRuntimeState {
    const playerId = normalizeRequiredText(input.player_id, "player_id");
    const heroId = normalizeRequiredText(input.hero_id, "hero_id");
    const runtimeKey = toHeroRuntimeKey(playerId, heroId);
    const existing = this.runtimeByHeroKey.get(runtimeKey);
    if (existing !== undefined) {
      return cloneRuntimeState(existing);
    }

    const seeded = normalizeRuntimeState({
      hero_runtime_id: input.hero_runtime_id,
      player_id: playerId,
      hero_id: heroId,
      active_ability_id: input.active_ability_id,
      unlock_state: input.unlock_state,
      readiness_state: input.readiness_state,
      assignment_context_type: input.assignment_context_type ?? "none",
      assignment_context_id: input.assignment_context_id,
      cooldown_started_at: input.cooldown_started_at,
      cooldown_ends_at: input.cooldown_ends_at,
      last_ability_activated_at: input.last_ability_activated_at,
      revision: input.revision ?? 0,
      updated_at: input.updated_at,
    });

    this.runtimeByHeroKey.set(runtimeKey, seeded);
    return cloneRuntimeState(seeded);
  }

  readRuntimeState(input: {
    readonly player_id: string;
    readonly hero_id: string;
  }): HeroRuntimeState | null {
    const playerId = normalizeRequiredText(input.player_id, "player_id");
    const heroId = normalizeRequiredText(input.hero_id, "hero_id");
    const state = this.runtimeByHeroKey.get(toHeroRuntimeKey(playerId, heroId));
    if (state === undefined) {
      return null;
    }

    return cloneRuntimeState(state);
  }

  readActiveAssignmentBinding(input: {
    readonly player_id: string;
    readonly hero_id: string;
  }): HeroAssignmentBinding | null {
    const playerId = normalizeRequiredText(input.player_id, "player_id");
    const heroId = normalizeRequiredText(input.hero_id, "hero_id");

    for (const binding of this.assignmentBindingById.values()) {
      if (
        binding.player_id === playerId
        && binding.hero_id === heroId
        && binding.is_active
      ) {
        return cloneAssignmentBinding(binding);
      }
    }

    return null;
  }

  listModifierInstances(input: {
    readonly player_id: string;
    readonly hero_id?: string;
    readonly assignment_context_type?: HeroAssignmentBoundContextType;
    readonly assignment_context_id?: string;
    readonly status?: HeroModifierStatus;
  }): readonly HeroModifierInstance[] {
    const playerId = normalizeRequiredText(input.player_id, "player_id");
    const heroId = input.hero_id === undefined
      ? undefined
      : normalizeRequiredText(input.hero_id, "hero_id");
    const assignmentContextType = input.assignment_context_type === undefined
      ? undefined
      : normalizeBoundContextType(input.assignment_context_type);
    const assignmentContextId = input.assignment_context_id === undefined
      ? undefined
      : normalizeRequiredText(input.assignment_context_id, "assignment_context_id");
    const status = input.status;

    const matched: HeroModifierInstance[] = [];
    for (const modifier of this.modifierInstanceById.values()) {
      if (modifier.player_id !== playerId) {
        continue;
      }
      if (heroId !== undefined && modifier.hero_id !== heroId) {
        continue;
      }
      if (
        assignmentContextType !== undefined
        && modifier.assignment_context_type !== assignmentContextType
      ) {
        continue;
      }
      if (
        assignmentContextId !== undefined
        && modifier.assignment_context_id !== assignmentContextId
      ) {
        continue;
      }
      if (status !== undefined && modifier.status !== status) {
        continue;
      }

      matched.push(cloneModifierInstance(modifier));
    }

    return matched;
  }

  applyAssignmentMutation(
    input: HeroAssignmentMutationInput,
  ): HeroRuntimeWriteResult<HeroAssignmentMutationApplied> {
    const playerId = normalizeRequiredText(input.player_id, "player_id");
    const heroId = normalizeRequiredText(input.hero_id, "hero_id");
    const runtimeKey = toHeroRuntimeKey(playerId, heroId);
    const existingRuntime = this.runtimeByHeroKey.get(runtimeKey);
    if (existingRuntime === undefined) {
      return createConflict("runtime_not_found", "Hero runtime state was not found.");
    }

    if (existingRuntime.revision !== input.expected_revision) {
      return createConflict(
        "revision_conflict",
        `Expected revision ${input.expected_revision}, found ${existingRuntime.revision}.`,
        existingRuntime,
      );
    }

    const now = normalizeInstant(input.now, "now");

    if (input.assignment === null) {
      const deactivatedAssignmentIds = this.deactivateActiveBindingsForHero({
        player_id: playerId,
        hero_id: heroId,
        unassigned_at: now,
      });
      const runtimeState = normalizeRuntimeState({
        ...existingRuntime,
        assignment_context_type: "none",
        assignment_context_id: undefined,
        revision: existingRuntime.revision + 1,
        updated_at: now,
      });
      this.runtimeByHeroKey.set(runtimeKey, runtimeState);
      return {
        status: "applied",
        result: {
          runtime_state: cloneRuntimeState(runtimeState),
          active_binding: null,
          deactivated_assignment_ids: deactivatedAssignmentIds,
        },
      };
    }

    const assignmentId = normalizeRequiredText(
      input.assignment.assignment_id,
      "assignment.assignment_id",
    );
    const assignmentContextType = normalizeBoundContextType(
      input.assignment.assignment_context_type,
    );
    const assignmentContextId = normalizeRequiredText(
      input.assignment.assignment_context_id,
      "assignment.assignment_context_id",
    );

    if (!this.isAssignmentContextOwnedByPlayer({
      player_id: playerId,
      assignment_context_type: assignmentContextType,
      assignment_context_id: assignmentContextId,
    })) {
      return createConflict(
        "assignment_context_not_owned",
        `Context '${assignmentContextType}:${assignmentContextId}' is not owned by player '${playerId}'.`,
        existingRuntime,
      );
    }

    const activeBindingInContext = this.findActiveBindingByContext({
      player_id: playerId,
      assignment_context_type: assignmentContextType,
      assignment_context_id: assignmentContextId,
    });

    if (
      activeBindingInContext !== null
      && activeBindingInContext.hero_id !== heroId
    ) {
      return createConflict(
        "context_already_bound",
        `Context '${assignmentContextType}:${assignmentContextId}' is already assigned.`,
        existingRuntime,
      );
    }

    const bindingWithSameId = this.assignmentBindingById.get(assignmentId);
    if (
      bindingWithSameId !== undefined
      && (
        bindingWithSameId.player_id !== playerId
        || bindingWithSameId.hero_id !== heroId
        || bindingWithSameId.assignment_context_type !== assignmentContextType
        || bindingWithSameId.assignment_context_id !== assignmentContextId
      )
    ) {
      return createConflict(
        "assignment_id_conflict",
        `Assignment id '${assignmentId}' already exists with a different binding shape.`,
        existingRuntime,
      );
    }

    const deactivatedAssignmentIds = this.deactivateActiveBindingsForHero({
      player_id: playerId,
      hero_id: heroId,
      unassigned_at: now,
    });

    const activeBinding = normalizeAssignmentBinding({
      assignment_id: assignmentId,
      player_id: playerId,
      hero_id: heroId,
      assignment_context_type: assignmentContextType,
      assignment_context_id: assignmentContextId,
      is_active: true,
      assigned_at: now,
      unassigned_at: undefined,
    });
    this.assignmentBindingById.set(activeBinding.assignment_id, activeBinding);

    const runtimeState = normalizeRuntimeState({
      ...existingRuntime,
      assignment_context_type: assignmentContextType,
      assignment_context_id: assignmentContextId,
      revision: existingRuntime.revision + 1,
      updated_at: now,
    });
    this.runtimeByHeroKey.set(runtimeKey, runtimeState);

    return {
      status: "applied",
      result: {
        runtime_state: cloneRuntimeState(runtimeState),
        active_binding: cloneAssignmentBinding(activeBinding),
        deactivated_assignment_ids: deactivatedAssignmentIds,
      },
    };
  }

  applyAbilityActivation(
    input: HeroAbilityActivationWriteInput,
  ): HeroRuntimeWriteResult<HeroAbilityActivationApplied> {
    const playerId = normalizeRequiredText(input.player_id, "player_id");
    const heroId = normalizeRequiredText(input.hero_id, "hero_id");
    const abilityId = normalizeRequiredText(input.ability_id, "ability_id");
    const assignmentContextType = normalizeBoundContextType(
      input.assignment_context_type,
    );
    const assignmentContextId = normalizeRequiredText(
      input.assignment_context_id,
      "assignment_context_id",
    );
    const activatedAt = normalizeInstant(input.activated_at, "activated_at");
    const cooldownEndsAt = normalizeInstant(input.cooldown_ends_at, "cooldown_ends_at");

    if (cooldownEndsAt.getTime() <= activatedAt.getTime()) {
      return createConflict(
        "cooldown_window_invalid",
        "cooldown_ends_at must be later than activated_at.",
      );
    }

    const runtimeKey = toHeroRuntimeKey(playerId, heroId);
    const existingRuntime = this.runtimeByHeroKey.get(runtimeKey);
    if (existingRuntime === undefined) {
      return createConflict("runtime_not_found", "Hero runtime state was not found.");
    }

    if (existingRuntime.revision !== input.expected_revision) {
      return createConflict(
        "revision_conflict",
        `Expected revision ${input.expected_revision}, found ${existingRuntime.revision}.`,
        existingRuntime,
      );
    }

    if (existingRuntime.readiness_state !== "ready") {
      return createConflict(
        "readiness_conflict",
        `Hero readiness state '${existingRuntime.readiness_state}' does not allow activation.`,
        existingRuntime,
      );
    }

    if (
      existingRuntime.assignment_context_type === "none"
      || existingRuntime.assignment_context_id === undefined
    ) {
      return createConflict(
        "hero_not_assigned",
        "Hero is not assigned to an activation context.",
        existingRuntime,
      );
    }

    if (
      existingRuntime.assignment_context_type !== assignmentContextType
      || existingRuntime.assignment_context_id !== assignmentContextId
    ) {
      return createConflict(
        "assignment_context_mismatch",
        "Activation context does not match the runtime assignment.",
        existingRuntime,
      );
    }

    const activeBinding = this.readActiveAssignmentBinding({
      player_id: playerId,
      hero_id: heroId,
    });
    if (
      activeBinding === null
      || activeBinding.assignment_context_type !== assignmentContextType
      || activeBinding.assignment_context_id !== assignmentContextId
    ) {
      return createConflict(
        "hero_not_assigned",
        "Active assignment binding is missing for the requested context.",
        existingRuntime,
      );
    }

    const normalizedModifiers = input.modifiers.map((modifier) =>
      normalizeModifierActivationInput(modifier),
    );
    for (const modifier of normalizedModifiers) {
      if (this.modifierInstanceById.has(modifier.modifier_instance_id)) {
        return createConflict(
          "modifier_instance_conflict",
          `Modifier instance '${modifier.modifier_instance_id}' already exists.`,
          existingRuntime,
        );
      }

      if (
        modifier.exclusive_by_stat
        && this.hasActiveModifierForStat({
          player_id: playerId,
          assignment_context_type: assignmentContextType,
          assignment_context_id: assignmentContextId,
          stat_key: modifier.stat_key,
        })
      ) {
        return createConflict(
          "modifier_exclusive_stat_conflict",
          `An active modifier already owns stat '${modifier.stat_key}' in this context.`,
          existingRuntime,
        );
      }
    }

    const createdModifierIds: string[] = [];
    for (const modifier of normalizedModifiers) {
      const nextInstance = normalizeModifierInstance({
        modifier_instance_id: modifier.modifier_instance_id,
        player_id: playerId,
        hero_id: heroId,
        ability_id: abilityId,
        modifier_id: modifier.modifier_id,
        domain: modifier.domain,
        stat_key: modifier.stat_key,
        op: modifier.op,
        value: modifier.value,
        trigger_window: modifier.trigger_window,
        remaining_charges: modifier.remaining_charges,
        assignment_context_type: assignmentContextType,
        assignment_context_id: assignmentContextId,
        activated_at: activatedAt,
        expires_at: modifier.expires_at,
        consumed_at: undefined,
        status: "active",
      });

      this.modifierInstanceById.set(
        nextInstance.modifier_instance_id,
        nextInstance,
      );
      createdModifierIds.push(nextInstance.modifier_instance_id);
    }

    const runtimeState = normalizeRuntimeState({
      ...existingRuntime,
      active_ability_id: abilityId,
      readiness_state: "on_cooldown",
      cooldown_started_at: activatedAt,
      cooldown_ends_at: cooldownEndsAt,
      last_ability_activated_at: activatedAt,
      revision: existingRuntime.revision + 1,
      updated_at: activatedAt,
    });
    this.runtimeByHeroKey.set(runtimeKey, runtimeState);

    return {
      status: "applied",
      result: {
        runtime_state: cloneRuntimeState(runtimeState),
        created_modifier_instance_ids: createdModifierIds,
      },
    };
  }

  applyModifierLifecycle(
    input: HeroModifierLifecycleWriteInput,
  ): HeroRuntimeWriteResult<HeroModifierLifecycleApplied> {
    const playerId = normalizeRequiredText(input.player_id, "player_id");
    const now = normalizeInstant(input.now, "now");
    const normalizedMutations = input.mutations.map((mutation) =>
      normalizeModifierLifecycleMutationInput(mutation),
    );

    for (const mutation of normalizedMutations) {
      const existing = this.modifierInstanceById.get(mutation.modifier_instance_id);
      if (existing === undefined) {
        return createConflict(
          "modifier_not_found",
          `Modifier instance '${mutation.modifier_instance_id}' was not found.`,
        );
      }
      if (existing.player_id !== playerId) {
        return createConflict(
          "modifier_player_mismatch",
          `Modifier instance '${mutation.modifier_instance_id}' does not belong to player '${playerId}'.`,
        );
      }
      if (existing.status !== "active") {
        return createConflict(
          "modifier_not_active",
          `Modifier instance '${mutation.modifier_instance_id}' is not active.`,
        );
      }
    }

    const updatedModifierIds: string[] = [];
    for (const mutation of normalizedMutations) {
      const existing = this.modifierInstanceById.get(mutation.modifier_instance_id);
      if (existing === undefined) {
        continue;
      }

      const consumedAt = mutation.status === "consumed"
        ? mutation.consumed_at ?? now
        : undefined;
      const updated = normalizeModifierInstance({
        ...existing,
        remaining_charges: mutation.remaining_charges,
        status: mutation.status,
        consumed_at: consumedAt,
      });

      this.modifierInstanceById.set(updated.modifier_instance_id, updated);
      updatedModifierIds.push(updated.modifier_instance_id);
    }

    return {
      status: "applied",
      result: {
        updated_modifier_instance_ids: updatedModifierIds,
      },
    };
  }

  private deactivateActiveBindingsForHero(input: {
    readonly player_id: string;
    readonly hero_id: string;
    readonly unassigned_at: Date;
  }): readonly string[] {
    const deactivatedAssignmentIds: string[] = [];
    for (const [assignmentId, binding] of this.assignmentBindingById.entries()) {
      if (
        binding.player_id === input.player_id
        && binding.hero_id === input.hero_id
        && binding.is_active
      ) {
        const deactivated = normalizeAssignmentBinding({
          ...binding,
          is_active: false,
          unassigned_at: input.unassigned_at,
        });
        this.assignmentBindingById.set(assignmentId, deactivated);
        deactivatedAssignmentIds.push(assignmentId);
      }
    }

    return deactivatedAssignmentIds;
  }

  private findActiveBindingByContext(input: {
    readonly player_id: string;
    readonly assignment_context_type: HeroAssignmentBoundContextType;
    readonly assignment_context_id: string;
  }): HeroAssignmentBinding | null {
    for (const binding of this.assignmentBindingById.values()) {
      if (
        binding.player_id === input.player_id
        && binding.assignment_context_type === input.assignment_context_type
        && binding.assignment_context_id === input.assignment_context_id
        && binding.is_active
      ) {
        return binding;
      }
    }

    return null;
  }

  private hasActiveModifierForStat(input: {
    readonly player_id: string;
    readonly assignment_context_type: HeroAssignmentBoundContextType;
    readonly assignment_context_id: string;
    readonly stat_key: string;
  }): boolean {
    for (const modifier of this.modifierInstanceById.values()) {
      if (
        modifier.player_id === input.player_id
        && modifier.assignment_context_type === input.assignment_context_type
        && modifier.assignment_context_id === input.assignment_context_id
        && modifier.stat_key === input.stat_key
        && modifier.status === "active"
      ) {
        return true;
      }
    }

    return false;
  }

  private isAssignmentContextOwnedByPlayer(input: {
    readonly player_id: string;
    readonly assignment_context_type: HeroAssignmentBoundContextType;
    readonly assignment_context_id: string;
  }): boolean {
    switch (input.assignment_context_type) {
      case "army":
        return this.assignmentContextOwnershipReadRepositories.army.isArmyOwnedByPlayer({
          player_id: input.player_id,
          army_id: input.assignment_context_id,
        });
      case "scout_detachment":
        return this.assignmentContextOwnershipReadRepositories.scout_detachment
          .isScoutDetachmentOwnedByPlayer({
            player_id: input.player_id,
            scout_detachment_id: input.assignment_context_id,
          });
      case "siege_column":
        return this.assignmentContextOwnershipReadRepositories.siege_column
          .isSiegeColumnOwnedByPlayer({
            player_id: input.player_id,
            siege_column_id: input.assignment_context_id,
          });
      default:
        return false;
    }
  }
}

function createConflict(
  conflictCode: HeroRuntimeWriteConflictCode,
  message: string,
  currentRuntimeState?: HeroRuntimeState,
): HeroRuntimeWriteConflict {
  return {
    status: "conflict",
    conflict_code: conflictCode,
    message,
    current_runtime_state: currentRuntimeState === undefined
      ? undefined
      : cloneRuntimeState(currentRuntimeState),
  };
}

function toHeroRuntimeKey(playerId: string, heroId: string): string {
  return `${playerId}::${heroId}`;
}

function createRejectingContextOwnershipReadRepositories():
  HeroAssignmentContextOwnershipReadRepositories {
  return {
    army: {
      isArmyOwnedByPlayer: () => false,
    },
    scout_detachment: {
      isScoutDetachmentOwnedByPlayer: () => false,
    },
    siege_column: {
      isSiegeColumnOwnedByPlayer: () => false,
    },
  };
}

function normalizeRuntimeState(input: HeroRuntimeState): HeroRuntimeState {
  const assignmentContextType = normalizeAssignmentContextType(
    input.assignment_context_type,
  );
  const assignmentContextId = input.assignment_context_id === undefined
    ? undefined
    : normalizeRequiredText(input.assignment_context_id, "assignment_context_id");
  const cooldownStartedAt = input.cooldown_started_at === undefined
    ? undefined
    : normalizeInstant(input.cooldown_started_at, "cooldown_started_at");
  const cooldownEndsAt = input.cooldown_ends_at === undefined
    ? undefined
    : normalizeInstant(input.cooldown_ends_at, "cooldown_ends_at");
  const lastAbilityActivatedAt = input.last_ability_activated_at === undefined
    ? undefined
    : normalizeInstant(input.last_ability_activated_at, "last_ability_activated_at");

  if (assignmentContextType === "none" && assignmentContextId !== undefined) {
    throw new Error(
      "assignment_context_id must be undefined when assignment_context_type is 'none'.",
    );
  }
  if (assignmentContextType !== "none" && assignmentContextId === undefined) {
    throw new Error(
      "assignment_context_id is required when assignment_context_type is not 'none'.",
    );
  }

  if (input.readiness_state === "ready") {
    if (cooldownStartedAt !== undefined || cooldownEndsAt !== undefined) {
      throw new Error(
        "ready runtime states cannot carry cooldown_started_at or cooldown_ends_at.",
      );
    }
  } else {
    if (cooldownStartedAt === undefined || cooldownEndsAt === undefined) {
      throw new Error(
        "on_cooldown runtime states require cooldown_started_at and cooldown_ends_at.",
      );
    }
    if (cooldownEndsAt.getTime() <= cooldownStartedAt.getTime()) {
      throw new Error("cooldown_ends_at must be later than cooldown_started_at.");
    }
  }

  return {
    hero_runtime_id: normalizeRequiredText(input.hero_runtime_id, "hero_runtime_id"),
    player_id: normalizeRequiredText(input.player_id, "player_id"),
    hero_id: normalizeRequiredText(input.hero_id, "hero_id"),
    active_ability_id: normalizeRequiredText(input.active_ability_id, "active_ability_id"),
    unlock_state: input.unlock_state,
    readiness_state: input.readiness_state,
    assignment_context_type: assignmentContextType,
    assignment_context_id: assignmentContextId,
    cooldown_started_at: cooldownStartedAt,
    cooldown_ends_at: cooldownEndsAt,
    last_ability_activated_at: lastAbilityActivatedAt,
    revision: normalizeRevision(input.revision),
    updated_at: normalizeInstant(input.updated_at, "updated_at"),
  };
}

function normalizeAssignmentBinding(
  input: HeroAssignmentBinding,
): HeroAssignmentBinding {
  const normalized: HeroAssignmentBinding = {
    assignment_id: normalizeRequiredText(input.assignment_id, "assignment_id"),
    player_id: normalizeRequiredText(input.player_id, "player_id"),
    hero_id: normalizeRequiredText(input.hero_id, "hero_id"),
    assignment_context_type: normalizeBoundContextType(input.assignment_context_type),
    assignment_context_id: normalizeRequiredText(
      input.assignment_context_id,
      "assignment_context_id",
    ),
    is_active: input.is_active,
    assigned_at: normalizeInstant(input.assigned_at, "assigned_at"),
    unassigned_at: input.unassigned_at === undefined
      ? undefined
      : normalizeInstant(input.unassigned_at, "unassigned_at"),
  };

  if (normalized.is_active && normalized.unassigned_at !== undefined) {
    throw new Error("Active assignment bindings cannot have unassigned_at.");
  }
  if (!normalized.is_active && normalized.unassigned_at === undefined) {
    throw new Error("Inactive assignment bindings require unassigned_at.");
  }
  if (
    normalized.unassigned_at !== undefined
    && normalized.unassigned_at.getTime() < normalized.assigned_at.getTime()
  ) {
    throw new Error("unassigned_at cannot be earlier than assigned_at.");
  }

  return normalized;
}

function normalizeModifierInstance(input: HeroModifierInstance): HeroModifierInstance {
  const normalized: HeroModifierInstance = {
    modifier_instance_id: normalizeRequiredText(
      input.modifier_instance_id,
      "modifier_instance_id",
    ),
    player_id: normalizeRequiredText(input.player_id, "player_id"),
    hero_id: normalizeRequiredText(input.hero_id, "hero_id"),
    ability_id: normalizeRequiredText(input.ability_id, "ability_id"),
    modifier_id: normalizeRequiredText(input.modifier_id, "modifier_id"),
    domain: input.domain,
    stat_key: normalizeRequiredText(input.stat_key, "stat_key"),
    op: input.op,
    value: normalizeRequiredText(input.value, "value"),
    trigger_window: normalizeRequiredText(input.trigger_window, "trigger_window"),
    remaining_charges: normalizeNonNegativeInteger(
      input.remaining_charges,
      "remaining_charges",
    ),
    assignment_context_type: normalizeBoundContextType(input.assignment_context_type),
    assignment_context_id: normalizeRequiredText(
      input.assignment_context_id,
      "assignment_context_id",
    ),
    activated_at: normalizeInstant(input.activated_at, "activated_at"),
    expires_at: input.expires_at === undefined
      ? undefined
      : normalizeInstant(input.expires_at, "expires_at"),
    consumed_at: input.consumed_at === undefined
      ? undefined
      : normalizeInstant(input.consumed_at, "consumed_at"),
    status: input.status,
  };

  if (
    normalized.expires_at !== undefined
    && normalized.expires_at.getTime() < normalized.activated_at.getTime()
  ) {
    throw new Error("expires_at cannot be earlier than activated_at.");
  }
  if (
    normalized.consumed_at !== undefined
    && normalized.consumed_at.getTime() < normalized.activated_at.getTime()
  ) {
    throw new Error("consumed_at cannot be earlier than activated_at.");
  }
  if (normalized.status === "active" && normalized.consumed_at !== undefined) {
    throw new Error("active modifier instances cannot have consumed_at.");
  }
  if (normalized.status === "consumed" && normalized.consumed_at === undefined) {
    throw new Error("consumed modifier instances require consumed_at.");
  }

  return normalized;
}

function normalizeModifierActivationInput(
  input: HeroModifierActivationInput,
): HeroModifierActivationInput {
  return {
    modifier_instance_id: normalizeRequiredText(
      input.modifier_instance_id,
      "modifier_instance_id",
    ),
    modifier_id: normalizeRequiredText(input.modifier_id, "modifier_id"),
    domain: input.domain,
    stat_key: normalizeRequiredText(input.stat_key, "stat_key"),
    op: input.op,
    value: normalizeRequiredText(input.value, "value"),
    trigger_window: normalizeRequiredText(input.trigger_window, "trigger_window"),
    remaining_charges: normalizeNonNegativeInteger(
      input.remaining_charges,
      "remaining_charges",
    ),
    expires_at: input.expires_at === undefined
      ? undefined
      : normalizeInstant(input.expires_at, "expires_at"),
    exclusive_by_stat: input.exclusive_by_stat ?? false,
  };
}

function normalizeModifierLifecycleMutationInput(
  input: HeroModifierLifecycleMutationInput,
): HeroModifierLifecycleMutationInput {
  const normalized: HeroModifierLifecycleMutationInput = {
    modifier_instance_id: normalizeRequiredText(
      input.modifier_instance_id,
      "modifier_instance_id",
    ),
    remaining_charges: normalizeNonNegativeInteger(
      input.remaining_charges,
      "remaining_charges",
    ),
    status: input.status,
    consumed_at: input.consumed_at === undefined
      ? undefined
      : normalizeInstant(input.consumed_at, "consumed_at"),
  };

  if (normalized.status !== "consumed" && normalized.consumed_at !== undefined) {
    throw new Error("consumed_at is only valid when lifecycle status is 'consumed'.");
  }

  return normalized;
}

function cloneRuntimeState(input: HeroRuntimeState): HeroRuntimeState {
  return {
    ...input,
    assignment_context_id: input.assignment_context_id,
    cooldown_started_at: cloneInstant(input.cooldown_started_at),
    cooldown_ends_at: cloneInstant(input.cooldown_ends_at),
    last_ability_activated_at: cloneInstant(input.last_ability_activated_at),
    updated_at: cloneInstant(input.updated_at) as Date,
  };
}

function cloneAssignmentBinding(input: HeroAssignmentBinding): HeroAssignmentBinding {
  return {
    ...input,
    assigned_at: cloneInstant(input.assigned_at) as Date,
    unassigned_at: cloneInstant(input.unassigned_at),
  };
}

function cloneModifierInstance(input: HeroModifierInstance): HeroModifierInstance {
  return {
    ...input,
    activated_at: cloneInstant(input.activated_at) as Date,
    expires_at: cloneInstant(input.expires_at),
    consumed_at: cloneInstant(input.consumed_at),
  };
}

function cloneInstant(input: Date | undefined): Date | undefined {
  if (input === undefined) {
    return undefined;
  }
  return new Date(input.getTime());
}

function normalizeRequiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Expected non-empty '${field}'.`);
  }
  return normalized;
}

function normalizeInstant(value: Date, field: string): Date {
  const normalized = new Date(value.getTime());
  if (Number.isNaN(normalized.getTime())) {
    throw new Error(`Expected valid instant for '${field}'.`);
  }
  return normalized;
}

function normalizeRevision(value: number): number {
  return normalizeNonNegativeInteger(value, "revision");
}

function normalizeNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Expected non-negative integer for '${field}'.`);
  }
  return value;
}

function normalizeAssignmentContextType(
  value: HeroAssignmentContextType,
): HeroAssignmentContextType {
  switch (value) {
    case "none":
    case "army":
    case "scout_detachment":
    case "siege_column":
      return value;
    default:
      throw new Error(`Unsupported assignment context type '${String(value)}'.`);
  }
}

function normalizeBoundContextType(
  value: HeroAssignmentBoundContextType,
): HeroAssignmentBoundContextType {
  if (value === "army" || value === "scout_detachment" || value === "siege_column") {
    return value;
  }
  throw new Error(`Expected bound assignment context type, received '${String(value)}'.`);
}
