import { err, ok } from "../shared";
import type {
  AppError,
  Instant,
  Result,
} from "../shared";
import type { BackendModule, ModuleRegistrationContext, ServiceToken } from "./composition";
import {
  createSettlementResourceProjectionServiceFromStarterData,
  type FirstSliceResourceId,
  type SettlementResourceProjectionService,
  type SettlementResourceTickProjection,
  type SettlementResourceTickReasonCode,
} from "../modules/economy";

const DEFAULT_TICK_INTERVAL_MS = 60_000;
const DEFAULT_SETTLEMENT_ID = "settlement_alpha";
const DEFAULT_SETTLEMENT_NAME = "Starter Settlement";
const MODULE_ID = "app.economy_tick_runner";
const LIFECYCLE_HOOK_NAME = "app.economy_tick_runner.hook";

export const SETTLEMENT_RESOURCE_PROJECTION_SERVICE_TOKEN: ServiceToken<SettlementResourceProjectionService> =
  {
    key: "app.economy.settlement_resource_projection_service",
    description:
      "Deterministic settlement resource projection service used by first-slice economy tick integration.",
  };

export const FIRST_SLICE_SETTLEMENT_ECONOMY_TICK_STATE_TOKEN: ServiceToken<
  FirstSliceEconomyTickStateService
> = {
  key: "app.economy.first_slice_settlement_tick_state",
  description:
    "In-memory first-slice settlement economy resource state for app-level tick integration tests and stubs.",
};

export interface FirstSliceEconomyTickState {
  readonly settlement_id: string;
  readonly settlement_name: string;
  readonly tick_started_at: Instant;
  readonly tick_ended_at: Instant;
  readonly duration_ms: number;
  readonly resource_stock_by_id: Readonly<Record<FirstSliceResourceId, number>>;
  readonly resource_delta_by_id: Readonly<Record<FirstSliceResourceId, number>>;
  readonly projection_reason_codes: readonly SettlementResourceTickReasonCode[];
}

export interface FirstSliceEconomyTickStateService {
  getLatestState(): FirstSliceEconomyTickState;
}

export interface FirstSliceEconomyTickModuleOptions {
  readonly settlementId?: string;
  readonly settlementName?: string;
  readonly tickIntervalMs?: number;
}

interface MutableFirstSliceEconomyTickState {
  settlement_id: string;
  settlement_name: string;
  tick_started_at: Instant;
  tick_ended_at: Instant;
  duration_ms: number;
  resource_stock_by_id: Record<FirstSliceResourceId, number>;
  resource_delta_by_id: Record<FirstSliceResourceId, number>;
  projection_reason_codes: readonly SettlementResourceTickReasonCode[];
}

const createFirstSliceEconomyTickStateFromProjection = (
  projection: SettlementResourceTickProjection,
): MutableFirstSliceEconomyTickState => ({
  settlement_id: projection.settlement_id,
  settlement_name: projection.settlement_name,
  tick_started_at: projection.tick_started_at,
  tick_ended_at: projection.tick_ended_at,
  duration_ms: projection.duration_ms,
  resource_stock_by_id: { ...projection.resource_stock_by_id },
  resource_delta_by_id: { ...projection.resource_delta_by_id },
  projection_reason_codes: projection.projection_reason_codes,
});

const cloneSnapshot = (
  state: MutableFirstSliceEconomyTickState,
): FirstSliceEconomyTickState => ({
  settlement_id: state.settlement_id,
  settlement_name: state.settlement_name,
  tick_started_at: state.tick_started_at,
  tick_ended_at: state.tick_ended_at,
  duration_ms: state.duration_ms,
  resource_stock_by_id: { ...state.resource_stock_by_id },
  resource_delta_by_id: { ...state.resource_delta_by_id },
  projection_reason_codes: [...state.projection_reason_codes],
});

const clampPositiveInteger = (value: number | undefined): number => {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.trunc(value);
};

const applyProjection = (
  state: MutableFirstSliceEconomyTickState,
  projection: SettlementResourceTickProjection,
): void => {
  state.tick_started_at = projection.tick_started_at;
  state.tick_ended_at = projection.tick_ended_at;
  state.duration_ms = projection.duration_ms;
  state.resource_stock_by_id = { ...projection.resource_stock_by_id };
  state.resource_delta_by_id = { ...projection.resource_delta_by_id };
  state.projection_reason_codes = projection.projection_reason_codes;
};

export const createFirstSliceEconomyTickModule = (
  options?: FirstSliceEconomyTickModuleOptions,
): BackendModule => {
  const settlementId = options?.settlementId?.trim() || DEFAULT_SETTLEMENT_ID;
  const settlementName = options?.settlementName?.trim() || DEFAULT_SETTLEMENT_NAME;
  const intervalMs = clampPositiveInteger(options?.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS);

  const projectionService = createSettlementResourceProjectionServiceFromStarterData(
    {
      entries_by_id: {},
    },
    {
      default_settlement_name: settlementName,
    },
  );

  return {
    moduleId: MODULE_ID,
    register: (context: ModuleRegistrationContext): Result<void, AppError> => {
      const seedNow = context.clock.now();
      const state = createFirstSliceEconomyTickStateFromProjection(
        projectionService.tickSettlementResources({
          settlement_id: settlementId,
          settlement_name: settlementName,
          tick_started_at: seedNow,
          tick_ended_at: seedNow,
        }),
      );
      const stateService: FirstSliceEconomyTickStateService = {
        getLatestState: () => cloneSnapshot(state),
      };

      try {
        context.services.register(SETTLEMENT_RESOURCE_PROJECTION_SERVICE_TOKEN, projectionService);
        context.services.register(FIRST_SLICE_SETTLEMENT_ECONOMY_TICK_STATE_TOKEN, stateService);
      } catch (error) {
        return err({
          code: "app_tick_module_registration_failed",
          message: `Failed to register first-slice economy tick module services for settlement '${settlementId}'.`,
          cause: error,
        });
      }

      let intervalHandle: ReturnType<typeof setInterval> | null = null;
      let running = false;
      let disposed = false;
      let tickInProgress = false;

      const runTick = async (): Promise<void> => {
        if (tickInProgress || disposed) {
          return;
        }

        tickInProgress = true;
        try {
          const nextTick = projectionService.tickSettlementResources({
            settlement_id: settlementId,
            settlement_name: settlementName,
            tick_started_at: state.tick_ended_at,
            tick_ended_at: context.clock.now(),
            resource_stock: state.resource_stock_by_id,
          });

          applyProjection(state, nextTick);

          for (const placeholderEvent of nextTick.placeholder_events) {
            await context.eventBus.publish(placeholderEvent);
          }
        } finally {
          tickInProgress = false;
        }
      };

      context.addLifecycleHook({
        name: LIFECYCLE_HOOK_NAME,
        start: async () => {
          if (running) {
            return;
          }
          running = true;
          await runTick();
          intervalHandle = setInterval(() => {
            void runTick().catch(() => {});
          }, intervalMs);
        },
        stop: async () => {
          disposed = true;
          if (intervalHandle === null) {
            return;
          }
          clearInterval(intervalHandle);
          intervalHandle = null;
        },
      });

      return ok(undefined);
    },
  };
};
