import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type {
  FirstSliceEconomyTickState,
  FirstSliceEconomyTickStateRepository,
} from "../ports";

export interface FileBackedFirstSliceEconomyTickStateRepositoryOptions {
  readonly storageFilePath?: string;
}

interface PersistedFirstSliceEconomyTickState {
  readonly settlement_id: string;
  readonly settlement_name: string;
  readonly tick_started_at: string;
  readonly tick_ended_at: string;
  readonly duration_ms: number;
  readonly resource_stock_by_id: Readonly<Record<string, number>>;
  readonly resource_delta_by_id: Readonly<Record<string, number>>;
  readonly projection_reason_codes: readonly string[];
}

export class FileBackedFirstSliceEconomyTickStateRepository
  implements FirstSliceEconomyTickStateRepository
{
  private static readonly DEFAULT_STORAGE_FILE_PATH = "backend/tmp/first-slice-economy-tick-states.json";

  private readonly storageFilePath: string;
  private readonly tickStatesBySettlementId = new Map<string, FirstSliceEconomyTickState>();

  constructor(
    input?: FileBackedFirstSliceEconomyTickStateRepositoryOptions,
  ) {
    const normalizedPath = input?.storageFilePath?.trim();
    this.storageFilePath = normalizedPath && normalizedPath.length > 0
      ? normalizedPath
      : FileBackedFirstSliceEconomyTickStateRepository.DEFAULT_STORAGE_FILE_PATH;

    this.reloadFromStorage();
  }

  readLatestTickState(input: {
    readonly settlement_id: string;
  }): FirstSliceEconomyTickState | null {
    this.reloadFromStorage();
    const settlementId = input.settlement_id.trim();
    const savedState = this.tickStatesBySettlementId.get(settlementId);
    if (savedState === undefined) {
      return null;
    }

    return cloneFirstSliceEconomyTickState(savedState);
  }

  saveTickState(state: FirstSliceEconomyTickState): FirstSliceEconomyTickState {
    const normalized = normalizeEconomyTickState(state);

    this.reloadFromStorage();
    const storedState = this.tickStatesBySettlementId.get(normalized.settlement_id);
    if (
      storedState !== undefined
      && storedState.tick_ended_at.getTime() >= normalized.tick_ended_at.getTime()
    ) {
      return cloneFirstSliceEconomyTickState(storedState);
      }

    this.tickStatesBySettlementId.set(normalized.settlement_id, normalized);
    this.persistAllStates();
    return cloneFirstSliceEconomyTickState(normalized);
  }

  private reloadFromStorage(): void {
    this.tickStatesBySettlementId.clear();

    if (!existsSync(this.storageFilePath)) {
      return;
    }

    const raw = readFileSync(this.storageFilePath, "utf8");
    const parsed = parseStoragePayload(raw, this.storageFilePath);

    for (const state of parsed) {
      const normalized = normalizePersistedState(state);
      this.tickStatesBySettlementId.set(normalized.settlement_id, normalized);
    }
  }

  private persistAllStates(): void {
    const output = serializeStatesToPersistence(this.tickStatesBySettlementId);

    const directory = dirname(this.storageFilePath);
    mkdirSync(directory, { recursive: true });

    const temporaryStoragePath = `${this.storageFilePath}.tmp`;
    writeFileSync(temporaryStoragePath, output, "utf8");
    renameSync(temporaryStoragePath, this.storageFilePath);
  }
}

function parseStoragePayload(
  raw: string,
  sourcePath: string,
): readonly PersistedFirstSliceEconomyTickState[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) && !isSettlementStateRecord(parsed)) {
    throw new Error(`Invalid storage payload in '${sourcePath}'.`);
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  const states: PersistedFirstSliceEconomyTickState[] = [];
  for (const state of Object.values(parsed)) {
    states.push(state as PersistedFirstSliceEconomyTickState);
  }

  return states;
}

function isSettlementStateRecord(
  value: unknown,
): value is Record<string, PersistedFirstSliceEconomyTickState> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePersistedState(
  state: PersistedFirstSliceEconomyTickState,
): FirstSliceEconomyTickState {
  return {
    settlement_id: normalizeText(state.settlement_id, "settlement_id"),
    settlement_name: normalizeText(state.settlement_name, "settlement_name"),
    tick_started_at: parseDate(state.tick_started_at, "tick_started_at"),
    tick_ended_at: parseDate(state.tick_ended_at, "tick_ended_at"),
    duration_ms: toFiniteNumber(state.duration_ms, "duration_ms"),
    resource_stock_by_id: normalizeNumberRecord(state.resource_stock_by_id),
    resource_delta_by_id: normalizeNumberRecord(state.resource_delta_by_id),
    projection_reason_codes: [...state.projection_reason_codes],
  };
}

function normalizeEconomyTickState(
  state: FirstSliceEconomyTickState,
): FirstSliceEconomyTickState {
  return {
    ...state,
    settlement_id: normalizeText(state.settlement_id, "settlement_id"),
    settlement_name: normalizeText(state.settlement_name, "settlement_name"),
    tick_started_at: new Date(state.tick_started_at.getTime()),
    tick_ended_at: new Date(state.tick_ended_at.getTime()),
    resource_stock_by_id: { ...state.resource_stock_by_id },
    resource_delta_by_id: { ...state.resource_delta_by_id },
    projection_reason_codes: [...state.projection_reason_codes],
  };
}

function normalizeNumberRecord(
  input: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const output: Record<string, number> = {};

  for (const [key, value] of Object.entries(input)) {
    const parsed = toFiniteNumber(value, `resource value '${key}'`);
    output[key] = parsed;
  }

  return output;
}

function normalizeText(value: string | undefined, field: string): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`Invalid persisted economy tick state field '${field}'.`);
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Invalid persisted economy tick state field '${field}'.`);
  }
  return normalized;
}

function toFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid persisted number for '${field}': ${String(value)}.`);
  }
  return value;
}

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid persisted date for '${field}': ${String(value)}.`);
  }
  return date;
}

function serializeStatesToPersistence(
  statesBySettlementId: ReadonlyMap<string, FirstSliceEconomyTickState>,
): string {
  const serializable: Record<string, PersistedFirstSliceEconomyTickState> = {};

  for (const [settlementId, state] of statesBySettlementId) {
    serializable[settlementId] = {
      ...state,
      tick_started_at: state.tick_started_at.toISOString(),
      tick_ended_at: state.tick_ended_at.toISOString(),
      projection_reason_codes: [...state.projection_reason_codes],
      resource_stock_by_id: { ...state.resource_stock_by_id },
      resource_delta_by_id: { ...state.resource_delta_by_id },
    };
  }

  return JSON.stringify(serializable, null, 2);
}

function cloneFirstSliceEconomyTickState(
  state: FirstSliceEconomyTickState,
): FirstSliceEconomyTickState {
  return {
    ...state,
    tick_started_at: new Date(state.tick_started_at.getTime()),
    tick_ended_at: new Date(state.tick_ended_at.getTime()),
    resource_stock_by_id: { ...state.resource_stock_by_id },
    resource_delta_by_id: { ...state.resource_delta_by_id },
    projection_reason_codes: [...state.projection_reason_codes],
  };
}
