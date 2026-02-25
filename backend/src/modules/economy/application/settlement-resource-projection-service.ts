import type { IntegrationEvent, Instant } from "../../../shared";

const MS_PER_HOUR = 60 * 60 * 1000;

export const FIRST_SLICE_RESOURCE_IDS = ["food", "wood", "stone", "iron"] as const;

export type FirstSliceResourceId = (typeof FIRST_SLICE_RESOURCE_IDS)[number];

export type SettlementResourceTickReasonCode =
  | "passive_prod_base"
  | "passive_prod_elapsed_floor"
  | "storage_cap_reached"
  | "stock_clamped_to_zero"
  | "stock_clamped_to_cap"
  | "storage_cap_clamped_minimum"
  | "passive_prod_clamped_non_negative"
  | "default_resource_definition_seed"
  | "default_stock_starting_seed"
  | "default_storage_cap_seed"
  | "default_passive_prod_seed"
  | "tick_window_clamped_to_zero";

export interface StarterEconomyResourceDefinition {
  readonly resource_id: string;
  readonly starting_stock: number;
  readonly base_storage_cap: number;
  readonly base_passive_prod_per_h: number;
  readonly slice_status?: string;
}

export interface StarterEconomyResourceDefinitionsTable {
  readonly entries_by_id: Readonly<Record<string, StarterEconomyResourceDefinition>>;
}

export interface SettlementResourceTickInput {
  readonly settlement_id: string;
  readonly settlement_name?: string;
  readonly tick_started_at: Instant;
  readonly tick_ended_at: Instant;
  readonly resource_stock?: Readonly<Record<string, number | undefined>>;
  readonly storage_caps?: Readonly<Record<string, number | undefined>>;
  readonly passive_prod_per_h?: Readonly<Record<string, number | undefined>>;
  readonly correlation_id?: string;
}

export interface SettlementResourceProjectionItem {
  readonly resource_id: FirstSliceResourceId;
  readonly previous_stock: number;
  readonly delta: number;
  readonly updated_stock: number;
  readonly storage_cap: number;
  readonly passive_prod_per_h: number;
  readonly reason_codes: readonly SettlementResourceTickReasonCode[];
}

export interface SettlementResourceTickPlaceholderEventPayload {
  readonly schema_version: "rk-v1-settlement-resource-tick-event";
  readonly event_key: "event.economy.tick_passive_income";
  readonly settlement_id: string;
  readonly settlement_name: string;
  readonly tick_started_at_iso: string;
  readonly tick_ended_at_iso: string;
  readonly duration_ms: number;
  readonly resource_delta_by_id: Readonly<Record<FirstSliceResourceId, number>>;
  readonly resource_stock_by_id: Readonly<Record<FirstSliceResourceId, number>>;
  readonly reason_codes: readonly SettlementResourceTickReasonCode[];
}

export interface SettlementResourceTickProjection {
  readonly schema_version: "rk-v1-settlement-resource-tick";
  readonly settlement_id: string;
  readonly settlement_name: string;
  readonly tick_started_at: Instant;
  readonly tick_ended_at: Instant;
  readonly duration_ms: number;
  readonly resources: readonly SettlementResourceProjectionItem[];
  readonly resource_delta_by_id: Readonly<Record<FirstSliceResourceId, number>>;
  readonly resource_stock_by_id: Readonly<Record<FirstSliceResourceId, number>>;
  readonly projection_reason_codes: readonly SettlementResourceTickReasonCode[];
  readonly placeholder_events: readonly IntegrationEvent<SettlementResourceTickPlaceholderEventPayload>[];
}

export interface SettlementResourceProjectionService {
  tickSettlementResources(input: SettlementResourceTickInput): SettlementResourceTickProjection;
}

export const SETTLEMENT_RESOURCE_TICK_PROJECTED_EVENT_TYPE =
  "Economy.ResourceTickProjected" as const;

export const createSettlementResourceProjectionServiceFromStarterData = (
  resourceDefinitionsTable: StarterEconomyResourceDefinitionsTable,
  options?: {
    readonly default_settlement_name?: string;
  },
): DeterministicSettlementResourceProjectionService => {
  const playableDefinitions: Record<string, StarterEconomyResourceDefinition> = {};

  for (const resourceId of FIRST_SLICE_RESOURCE_IDS) {
    const definition = resourceDefinitionsTable.entries_by_id[resourceId];

    if (definition?.slice_status === "playable_now") {
      playableDefinitions[resourceId] = definition;
    }
  }

  return new DeterministicSettlementResourceProjectionService({
    resource_definitions_by_id: playableDefinitions,
    default_settlement_name: options?.default_settlement_name,
  });
};

interface NormalizedResourceDefinition {
  readonly resource_id: FirstSliceResourceId;
  readonly starting_stock: number;
  readonly base_storage_cap: number;
  readonly base_passive_prod_per_h: number;
}

const DEFAULT_FIRST_SLICE_RESOURCE_DEFINITIONS: Readonly<
  Record<FirstSliceResourceId, NormalizedResourceDefinition>
> = {
  food: {
    resource_id: "food",
    starting_stock: 300,
    base_storage_cap: 1000,
    base_passive_prod_per_h: 6,
  },
  wood: {
    resource_id: "wood",
    starting_stock: 260,
    base_storage_cap: 1000,
    base_passive_prod_per_h: 4,
  },
  stone: {
    resource_id: "stone",
    starting_stock: 220,
    base_storage_cap: 1000,
    base_passive_prod_per_h: 2,
  },
  iron: {
    resource_id: "iron",
    starting_stock: 140,
    base_storage_cap: 1000,
    base_passive_prod_per_h: 1,
  },
};

export class DeterministicSettlementResourceProjectionService
  implements SettlementResourceProjectionService
{
  private readonly resourceDefinitions: Readonly<
    Record<FirstSliceResourceId, NormalizedResourceDefinition>
  >;

  private readonly defaultedDefinitionIds: ReadonlySet<FirstSliceResourceId>;

  constructor(options?: {
    readonly resource_definitions_by_id?: Readonly<
      Record<string, StarterEconomyResourceDefinition>
    >;
    readonly default_settlement_name?: string;
  }) {
    const defaults = options?.resource_definitions_by_id;
    const normalized: Record<FirstSliceResourceId, NormalizedResourceDefinition> = {
      ...DEFAULT_FIRST_SLICE_RESOURCE_DEFINITIONS,
    };
    const defaulted = new Set<FirstSliceResourceId>();

    for (const resourceId of FIRST_SLICE_RESOURCE_IDS) {
      const supplied = defaults?.[resourceId];

      if (
        supplied === undefined ||
        (supplied.slice_status !== undefined && supplied.slice_status !== "playable_now")
      ) {
        if (defaults !== undefined) {
          defaulted.add(resourceId);
        }
        continue;
      }

      normalized[resourceId] = {
        resource_id: resourceId,
        starting_stock: toFiniteOrDefault(
          supplied.starting_stock,
          DEFAULT_FIRST_SLICE_RESOURCE_DEFINITIONS[resourceId].starting_stock,
        ),
        base_storage_cap: toFiniteOrDefault(
          supplied.base_storage_cap,
          DEFAULT_FIRST_SLICE_RESOURCE_DEFINITIONS[resourceId].base_storage_cap,
        ),
        base_passive_prod_per_h: toFiniteOrDefault(
          supplied.base_passive_prod_per_h,
          DEFAULT_FIRST_SLICE_RESOURCE_DEFINITIONS[resourceId].base_passive_prod_per_h,
        ),
      };
    }

    this.resourceDefinitions = normalized;
    this.defaultedDefinitionIds = defaulted;
    this.defaultSettlementName = options?.default_settlement_name ?? "Starter Settlement";
  }

  private readonly defaultSettlementName: string;

  tickSettlementResources(input: SettlementResourceTickInput): SettlementResourceTickProjection {
    const tickStartMs = input.tick_started_at.getTime();
    const tickEndMsRaw = input.tick_ended_at.getTime();
    const projectionReasonCodes: SettlementResourceTickReasonCode[] = [];

    const durationMs =
      tickEndMsRaw >= tickStartMs ? tickEndMsRaw - tickStartMs : 0;
    if (tickEndMsRaw < tickStartMs) {
      projectionReasonCodes.push("tick_window_clamped_to_zero");
    }

    const tickEndedAt = new Date(tickStartMs + durationMs);
    const resources: SettlementResourceProjectionItem[] = [];

    const resourceDeltaById: Record<FirstSliceResourceId, number> = {
      food: 0,
      wood: 0,
      stone: 0,
      iron: 0,
    };
    const resourceStockById: Record<FirstSliceResourceId, number> = {
      food: 0,
      wood: 0,
      stone: 0,
      iron: 0,
    };

    for (const resourceId of FIRST_SLICE_RESOURCE_IDS) {
      const definition = this.resourceDefinitions[resourceId];
      const reasonCodes: SettlementResourceTickReasonCode[] = [];

      if (this.defaultedDefinitionIds.has(resourceId)) {
        reasonCodes.push("default_resource_definition_seed");
      }

      let previousStock = toFiniteOrUndefined(input.resource_stock?.[resourceId]);
      if (previousStock === undefined) {
        previousStock = definition.starting_stock;
        reasonCodes.push("default_stock_starting_seed");
      }

      let storageCap = toFiniteOrUndefined(input.storage_caps?.[resourceId]);
      if (storageCap === undefined || storageCap <= 0) {
        storageCap = definition.base_storage_cap;
        reasonCodes.push("default_storage_cap_seed");
      }
      if (storageCap <= 0) {
        storageCap = 1;
        reasonCodes.push("storage_cap_clamped_minimum");
      }

      if (previousStock < 0) {
        previousStock = 0;
        reasonCodes.push("stock_clamped_to_zero");
      }
      if (previousStock > storageCap) {
        previousStock = storageCap;
        reasonCodes.push("stock_clamped_to_cap");
      }

      let passiveProdPerHour = toFiniteOrUndefined(input.passive_prod_per_h?.[resourceId]);
      if (passiveProdPerHour === undefined) {
        passiveProdPerHour = definition.base_passive_prod_per_h;
        reasonCodes.push("default_passive_prod_seed");
      }
      if (passiveProdPerHour < 0) {
        passiveProdPerHour = 0;
        reasonCodes.push("passive_prod_clamped_non_negative");
      }

      const projectedPassiveGain = Math.floor(
        (passiveProdPerHour * durationMs) / MS_PER_HOUR,
      );
      if (durationMs > 0 && projectedPassiveGain === 0) {
        reasonCodes.push("passive_prod_elapsed_floor");
      }

      let updatedStock = previousStock + projectedPassiveGain;
      if (updatedStock > storageCap) {
        updatedStock = storageCap;
        reasonCodes.push("storage_cap_reached");
      }

      const delta = updatedStock - previousStock;
      reasonCodes.push("passive_prod_base");

      resourceDeltaById[resourceId] = delta;
      resourceStockById[resourceId] = updatedStock;
      resources.push({
        resource_id: resourceId,
        previous_stock: previousStock,
        delta,
        updated_stock: updatedStock,
        storage_cap: storageCap,
        passive_prod_per_h: passiveProdPerHour,
        reason_codes: reasonCodes,
      });
    }

    const settlementName = input.settlement_name ?? this.defaultSettlementName;
    const placeholderEvent: IntegrationEvent<SettlementResourceTickPlaceholderEventPayload> = {
      type: SETTLEMENT_RESOURCE_TICK_PROJECTED_EVENT_TYPE,
      occurredAt: tickEndedAt,
      correlationId: input.correlation_id,
      payload: {
        schema_version: "rk-v1-settlement-resource-tick-event",
        event_key: "event.economy.tick_passive_income",
        settlement_id: input.settlement_id,
        settlement_name: settlementName,
        tick_started_at_iso: input.tick_started_at.toISOString(),
        tick_ended_at_iso: tickEndedAt.toISOString(),
        duration_ms: durationMs,
        resource_delta_by_id: resourceDeltaById,
        resource_stock_by_id: resourceStockById,
        reason_codes: dedupeReasonCodes(
          projectionReasonCodes,
          resources.flatMap((resource) => resource.reason_codes),
        ),
      },
    };

    return {
      schema_version: "rk-v1-settlement-resource-tick",
      settlement_id: input.settlement_id,
      settlement_name: settlementName,
      tick_started_at: input.tick_started_at,
      tick_ended_at: tickEndedAt,
      duration_ms: durationMs,
      resources,
      resource_delta_by_id: resourceDeltaById,
      resource_stock_by_id: resourceStockById,
      projection_reason_codes: projectionReasonCodes,
      placeholder_events: [placeholderEvent],
    };
  }
}

function toFiniteOrUndefined(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function toFiniteOrDefault(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function dedupeReasonCodes(
  ...sets: readonly SettlementResourceTickReasonCode[][]
): readonly SettlementResourceTickReasonCode[] {
  const unique = new Set<SettlementResourceTickReasonCode>();
  for (const reasonSet of sets) {
    for (const reasonCode of reasonSet) {
      unique.add(reasonCode);
    }
  }
  return Array.from(unique.values());
}
