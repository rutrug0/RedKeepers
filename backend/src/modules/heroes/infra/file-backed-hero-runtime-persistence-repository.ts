import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type {
  HeroAbilityActivationApplied,
  HeroAbilityActivationWriteInput,
  HeroAssignmentBinding,
  HeroAssignmentBoundContextType,
  HeroAssignmentMutationApplied,
  HeroAssignmentMutationInput,
  HeroModifierInstance,
  HeroModifierStatus,
  HeroRuntimePersistenceRepository,
  HeroRuntimePersistenceSnapshot,
  HeroRuntimeState,
  HeroRuntimeStateSeedInput,
  HeroRuntimeWriteResult,
} from "../ports";
import { InMemoryHeroRuntimePersistenceRepository } from "./in-memory-hero-runtime-persistence-repository";

export interface FileBackedHeroRuntimePersistenceRepositoryOptions {
  readonly storage_file_path?: string;
}

interface PersistedHeroRuntimeState {
  readonly hero_runtime_id: string;
  readonly player_id: string;
  readonly hero_id: string;
  readonly active_ability_id: string;
  readonly unlock_state: HeroRuntimeState["unlock_state"];
  readonly readiness_state: HeroRuntimeState["readiness_state"];
  readonly assignment_context_type: HeroRuntimeState["assignment_context_type"];
  readonly assignment_context_id?: string;
  readonly cooldown_started_at?: string;
  readonly cooldown_ends_at?: string;
  readonly last_ability_activated_at?: string;
  readonly revision: number;
  readonly updated_at: string;
}

interface PersistedHeroAssignmentBinding {
  readonly assignment_id: string;
  readonly player_id: string;
  readonly hero_id: string;
  readonly assignment_context_type: "army" | "scout_detachment" | "siege_column";
  readonly assignment_context_id: string;
  readonly is_active: boolean;
  readonly assigned_at: string;
  readonly unassigned_at?: string;
}

interface PersistedHeroModifierInstance {
  readonly modifier_instance_id: string;
  readonly player_id: string;
  readonly hero_id: string;
  readonly ability_id: string;
  readonly modifier_id: string;
  readonly domain: "combat" | "scout" | "siege" | "logistics";
  readonly stat_key: string;
  readonly op: "add" | "mul";
  readonly value: string;
  readonly trigger_window: string;
  readonly remaining_charges: number;
  readonly assignment_context_type: "army" | "scout_detachment" | "siege_column";
  readonly assignment_context_id: string;
  readonly activated_at: string;
  readonly expires_at?: string;
  readonly consumed_at?: string;
  readonly status: "active" | "consumed" | "expired";
}

interface PersistedHeroRuntimePersistenceSnapshot {
  readonly runtime_states: readonly PersistedHeroRuntimeState[];
  readonly assignment_bindings: readonly PersistedHeroAssignmentBinding[];
  readonly modifier_instances: readonly PersistedHeroModifierInstance[];
}

export class FileBackedHeroRuntimePersistenceRepository
  implements HeroRuntimePersistenceRepository
{
  private static readonly DEFAULT_STORAGE_FILE_PATH =
    "backend/tmp/hero-runtime-persistence.json";

  private readonly storageFilePath: string;
  private readonly inMemory = new InMemoryHeroRuntimePersistenceRepository();

  constructor(input?: FileBackedHeroRuntimePersistenceRepositoryOptions) {
    const configuredPath = input?.storage_file_path?.trim();
    this.storageFilePath = configuredPath && configuredPath.length > 0
      ? configuredPath
      : FileBackedHeroRuntimePersistenceRepository.DEFAULT_STORAGE_FILE_PATH;
    this.reloadFromStorage();
  }

  ensureRuntimeState(input: HeroRuntimeStateSeedInput): HeroRuntimeState {
    this.reloadFromStorage();
    const state = this.inMemory.ensureRuntimeState(input);
    this.persistToStorage();
    return state;
  }

  readRuntimeState(input: {
    readonly player_id: string;
    readonly hero_id: string;
  }): HeroRuntimeState | null {
    this.reloadFromStorage();
    return this.inMemory.readRuntimeState(input);
  }

  readActiveAssignmentBinding(input: {
    readonly player_id: string;
    readonly hero_id: string;
  }): HeroAssignmentBinding | null {
    this.reloadFromStorage();
    return this.inMemory.readActiveAssignmentBinding(input);
  }

  listModifierInstances(input: {
    readonly player_id: string;
    readonly hero_id?: string;
    readonly assignment_context_type?: HeroAssignmentBoundContextType;
    readonly assignment_context_id?: string;
    readonly status?: HeroModifierStatus;
  }): readonly HeroModifierInstance[] {
    this.reloadFromStorage();
    return this.inMemory.listModifierInstances(input);
  }

  applyAssignmentMutation(
    input: HeroAssignmentMutationInput,
  ): HeroRuntimeWriteResult<HeroAssignmentMutationApplied> {
    this.reloadFromStorage();
    const result = this.inMemory.applyAssignmentMutation(input);
    if (result.status === "applied") {
      this.persistToStorage();
    }
    return result;
  }

  applyAbilityActivation(
    input: HeroAbilityActivationWriteInput,
  ): HeroRuntimeWriteResult<HeroAbilityActivationApplied> {
    this.reloadFromStorage();
    const result = this.inMemory.applyAbilityActivation(input);
    if (result.status === "applied") {
      this.persistToStorage();
    }
    return result;
  }

  private reloadFromStorage(): void {
    if (!existsSync(this.storageFilePath)) {
      this.inMemory.replaceSnapshot({
        runtime_states: [],
        assignment_bindings: [],
        modifier_instances: [],
      });
      return;
    }

    const raw = readFileSync(this.storageFilePath, "utf8");
    const parsed = parseStorage(raw, this.storageFilePath);
    this.inMemory.replaceSnapshot(deserializeSnapshot(parsed));
  }

  private persistToStorage(): void {
    const snapshot = this.inMemory.exportSnapshot();
    const serialized = JSON.stringify(serializeSnapshot(snapshot), null, 2);

    mkdirSync(dirname(this.storageFilePath), { recursive: true });
    const temporaryPath = `${this.storageFilePath}.tmp`;
    writeFileSync(temporaryPath, serialized, "utf8");
    renameSync(temporaryPath, this.storageFilePath);
  }
}

function parseStorage(
  raw: string,
  storagePath: string,
): PersistedHeroRuntimePersistenceSnapshot {
  const parsed = JSON.parse(raw) as unknown;
  if (!isPersistedSnapshot(parsed)) {
    throw new Error(
      `Invalid hero runtime persistence payload in '${storagePath}'.`,
    );
  }
  return parsed;
}

function isPersistedSnapshot(
  value: unknown,
): value is PersistedHeroRuntimePersistenceSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.runtime_states)
    && Array.isArray(candidate.assignment_bindings)
    && Array.isArray(candidate.modifier_instances)
  );
}

function serializeSnapshot(
  snapshot: HeroRuntimePersistenceSnapshot,
): PersistedHeroRuntimePersistenceSnapshot {
  return {
    runtime_states: snapshot.runtime_states.map((state) => ({
      ...state,
      cooldown_started_at: state.cooldown_started_at?.toISOString(),
      cooldown_ends_at: state.cooldown_ends_at?.toISOString(),
      last_ability_activated_at: state.last_ability_activated_at?.toISOString(),
      updated_at: state.updated_at.toISOString(),
    })),
    assignment_bindings: snapshot.assignment_bindings.map((binding) => ({
      ...binding,
      assigned_at: binding.assigned_at.toISOString(),
      unassigned_at: binding.unassigned_at?.toISOString(),
    })),
    modifier_instances: snapshot.modifier_instances.map((modifier) => ({
      ...modifier,
      activated_at: modifier.activated_at.toISOString(),
      expires_at: modifier.expires_at?.toISOString(),
      consumed_at: modifier.consumed_at?.toISOString(),
    })),
  };
}

function deserializeSnapshot(
  snapshot: PersistedHeroRuntimePersistenceSnapshot,
): HeroRuntimePersistenceSnapshot {
  return {
    runtime_states: snapshot.runtime_states.map((state) => ({
      ...state,
      cooldown_started_at: parseOptionalDate(
        state.cooldown_started_at,
        "cooldown_started_at",
      ),
      cooldown_ends_at: parseOptionalDate(state.cooldown_ends_at, "cooldown_ends_at"),
      last_ability_activated_at: parseOptionalDate(
        state.last_ability_activated_at,
        "last_ability_activated_at",
      ),
      updated_at: parseRequiredDate(state.updated_at, "updated_at"),
    })),
    assignment_bindings: snapshot.assignment_bindings.map((binding) => ({
      ...binding,
      assigned_at: parseRequiredDate(binding.assigned_at, "assigned_at"),
      unassigned_at: parseOptionalDate(binding.unassigned_at, "unassigned_at"),
    })),
    modifier_instances: snapshot.modifier_instances.map((modifier) => ({
      ...modifier,
      activated_at: parseRequiredDate(modifier.activated_at, "activated_at"),
      expires_at: parseOptionalDate(modifier.expires_at, "expires_at"),
      consumed_at: parseOptionalDate(modifier.consumed_at, "consumed_at"),
    })),
  };
}

function parseRequiredDate(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid persisted timestamp for '${field}'.`);
  }
  return parsed;
}

function parseOptionalDate(value: string | undefined, field: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parseRequiredDate(value, field);
}
