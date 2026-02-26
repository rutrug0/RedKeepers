import {
  DeterministicFirstSliceBuildingUpgradeCommandHandler,
  type FirstSliceBuildingUpgradeCommandHandler,
  POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE,
  SettlementBuildingUpgradeEndpointHandler,
  type PostSettlementBuildingUpgradeRequestDto,
  type PostSettlementBuildingUpgradeResponseDto,
} from "../../modules/buildings";
import {
  DeterministicSettlementResourceLedgerService,
  InMemoryFirstSliceEconomyTickStateRepository,
  DeterministicSettlementResourceProjectionService,
  POST_SETTLEMENT_TICK_ROUTE,
  SettlementTickEndpointHandler,
  type FirstSliceEconomyTickStateRepository,
  type PostSettlementTickRequestDto,
  type PostSettlementTickResponseDto,
  type SettlementResourceLedgerService,
  type SettlementResourceProjectionService,
} from "../../modules/economy";
import {
  DeterministicFirstSliceUnitTrainCommandHandler,
  type FirstSliceUnitTrainCommandHandler,
  POST_SETTLEMENT_UNIT_TRAIN_ROUTE,
  SettlementUnitTrainEndpointHandler,
  type PostSettlementUnitTrainRequestDto,
  type PostSettlementUnitTrainResponseDto,
} from "../../modules/units";
import {
  DeterministicWorldMapLifecycleSchedulerService,
  DeterministicWorldMapNeutralGatheringService,
  InMemoryWorldMapGatherMarchStateRepository,
  InMemoryWorldMapNeutralNodeStateRepository,
  InMemoryWorldMapLifecycleStateRepository,
  DeterministicWorldMapMarchSnapshotService,
  InMemoryWorldMapMarchStateRepository,
  DeterministicWorldMapScoutSelectService,
  POST_WORLD_MAP_GATHER_MARCH_POLL_ROUTE,
  POST_WORLD_MAP_GATHER_MARCH_START_ROUTE,
  POST_WORLD_MAP_LIFECYCLE_ADVANCE_ROUTE,
  POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE,
  WorldMapGatherMarchPollEndpointHandler,
  WorldMapGatherMarchStartEndpointHandler,
  WorldMapLifecycleAdvanceEndpointHandler,
  InMemoryWorldMapTileStateRepository,
  WorldMapMarchSnapshotEndpointHandler,
  type PostWorldMapGatherMarchPollContractResponseDto,
  type PostWorldMapGatherMarchPollRequestDto,
  type PostWorldMapGatherMarchStartContractResponseDto,
  type PostWorldMapGatherMarchStartRequestDto,
  type PostWorldMapLifecycleAdvanceRequestDto,
  type PostWorldMapLifecycleAdvanceContractResponseDto,
  type PostWorldMapMarchSnapshotRequestDto,
  type PostWorldMapMarchSnapshotResponseDto,
  POST_WORLD_MAP_TILE_INTERACT_ROUTE,
  WorldMapTileInteractEndpointHandler,
  type WorldMapGatherMarchStateRepository,
  type PostWorldMapTileInteractRequestDto,
  type PostWorldMapTileInteractContractResponseDto,
  type WorldMapNeutralGatheringService,
  type WorldMapNeutralNodeSpawnInput,
  type WorldMapNeutralNodeStateRepository,
  type WorldMapLifecycleSchedulerService,
  type WorldMapLifecycleStateRepository,
  type WorldMapMarchSnapshotService,
  type WorldMapMarchStateRepository,
  type WorldMapScoutSelectService,
  type WorldMapTileStateRepository,
} from "../../modules/world_map";

export type FirstSliceSettlementLoopRoute =
  | typeof POST_SETTLEMENT_TICK_ROUTE
  | typeof POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE
  | typeof POST_SETTLEMENT_UNIT_TRAIN_ROUTE
  | typeof POST_WORLD_MAP_LIFECYCLE_ADVANCE_ROUTE
  | typeof POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE
  | typeof POST_WORLD_MAP_TILE_INTERACT_ROUTE
  | typeof POST_WORLD_MAP_GATHER_MARCH_START_ROUTE
  | typeof POST_WORLD_MAP_GATHER_MARCH_POLL_ROUTE;

export interface FirstSliceSettlementLoopRequestByRoute {
  readonly [POST_SETTLEMENT_TICK_ROUTE]: PostSettlementTickRequestDto;
  readonly [POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE]: PostSettlementBuildingUpgradeRequestDto;
  readonly [POST_SETTLEMENT_UNIT_TRAIN_ROUTE]: PostSettlementUnitTrainRequestDto;
  readonly [POST_WORLD_MAP_LIFECYCLE_ADVANCE_ROUTE]: PostWorldMapLifecycleAdvanceRequestDto;
  readonly [POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE]: PostWorldMapMarchSnapshotRequestDto;
  readonly [POST_WORLD_MAP_TILE_INTERACT_ROUTE]: PostWorldMapTileInteractRequestDto;
  readonly [POST_WORLD_MAP_GATHER_MARCH_START_ROUTE]: PostWorldMapGatherMarchStartRequestDto;
  readonly [POST_WORLD_MAP_GATHER_MARCH_POLL_ROUTE]: PostWorldMapGatherMarchPollRequestDto;
}

export interface FirstSliceSettlementLoopResponseByRoute {
  readonly [POST_SETTLEMENT_TICK_ROUTE]: PostSettlementTickResponseDto;
  readonly [POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE]: PostSettlementBuildingUpgradeResponseDto;
  readonly [POST_SETTLEMENT_UNIT_TRAIN_ROUTE]: PostSettlementUnitTrainResponseDto;
  readonly [POST_WORLD_MAP_LIFECYCLE_ADVANCE_ROUTE]: PostWorldMapLifecycleAdvanceContractResponseDto;
  readonly [POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE]: PostWorldMapMarchSnapshotResponseDto;
  readonly [POST_WORLD_MAP_TILE_INTERACT_ROUTE]: PostWorldMapTileInteractContractResponseDto;
  readonly [POST_WORLD_MAP_GATHER_MARCH_START_ROUTE]: PostWorldMapGatherMarchStartContractResponseDto;
  readonly [POST_WORLD_MAP_GATHER_MARCH_POLL_ROUTE]: PostWorldMapGatherMarchPollContractResponseDto;
}

export interface FirstSliceSettlementLoopTransportSuccess<
  TBody,
> {
  readonly status_code: 200;
  readonly body: TBody;
}

export interface FirstSliceSettlementLoopTransportFailureBody {
  readonly code: string;
  readonly message: string;
}

export interface FirstSliceSettlementLoopTransportFailure {
  readonly status_code: number;
  readonly body: FirstSliceSettlementLoopTransportFailureBody;
}

export type FirstSliceSettlementLoopTransportResponse<
  TBody,
> =
  | FirstSliceSettlementLoopTransportSuccess<TBody>
  | FirstSliceSettlementLoopTransportFailure;

interface FirstSliceSettlementLoopRouteResolverByRoute {
  readonly [POST_SETTLEMENT_TICK_ROUTE]: (
    request: PostSettlementTickRequestDto,
  ) => PostSettlementTickResponseDto;
  readonly [POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE]: (
    request: PostSettlementBuildingUpgradeRequestDto,
  ) => PostSettlementBuildingUpgradeResponseDto;
  readonly [POST_SETTLEMENT_UNIT_TRAIN_ROUTE]: (
    request: PostSettlementUnitTrainRequestDto,
  ) => PostSettlementUnitTrainResponseDto;
  readonly [POST_WORLD_MAP_LIFECYCLE_ADVANCE_ROUTE]: (
    request: PostWorldMapLifecycleAdvanceRequestDto,
  ) => PostWorldMapLifecycleAdvanceContractResponseDto;
  readonly [POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE]: (
    request: PostWorldMapMarchSnapshotRequestDto,
  ) => PostWorldMapMarchSnapshotResponseDto;
  readonly [POST_WORLD_MAP_TILE_INTERACT_ROUTE]: (
    request: PostWorldMapTileInteractRequestDto,
  ) => PostWorldMapTileInteractContractResponseDto;
  readonly [POST_WORLD_MAP_GATHER_MARCH_START_ROUTE]: (
    request: PostWorldMapGatherMarchStartRequestDto,
  ) => PostWorldMapGatherMarchStartContractResponseDto;
  readonly [POST_WORLD_MAP_GATHER_MARCH_POLL_ROUTE]: (
    request: PostWorldMapGatherMarchPollRequestDto,
  ) => PostWorldMapGatherMarchPollContractResponseDto;
}

export interface FirstSliceSettlementLoopTransportHandlers {
  readonly tick: SettlementTickEndpointHandler;
  readonly building_upgrade: SettlementBuildingUpgradeEndpointHandler;
  readonly unit_train: SettlementUnitTrainEndpointHandler;
  readonly world_map_lifecycle_advance: WorldMapLifecycleAdvanceEndpointHandler;
  readonly world_map_march_snapshot: WorldMapMarchSnapshotEndpointHandler;
  readonly world_map_tile_interact: WorldMapTileInteractEndpointHandler;
  readonly world_map_gather_march_start: WorldMapGatherMarchStartEndpointHandler;
  readonly world_map_gather_march_poll: WorldMapGatherMarchPollEndpointHandler;
}

export interface DeterministicFirstSliceSettlementLoopLocalRpcTransportOptions {
  readonly projection_service?: SettlementResourceProjectionService;
  readonly settlement_resource_ledger_service?: SettlementResourceLedgerService;
  readonly economy_tick_state_repository?: FirstSliceEconomyTickStateRepository;
  readonly building_upgrade_command_handler?: FirstSliceBuildingUpgradeCommandHandler;
  readonly unit_train_command_handler?: FirstSliceUnitTrainCommandHandler;
  readonly world_map_lifecycle_scheduler_service?: WorldMapLifecycleSchedulerService;
  readonly world_map_lifecycle_state_repository?: WorldMapLifecycleStateRepository;
  readonly world_map_march_snapshot_service?: WorldMapMarchSnapshotService;
  readonly world_map_march_state_repository?: WorldMapMarchStateRepository;
  readonly world_map_neutral_gathering_service?: WorldMapNeutralGatheringService;
  readonly world_map_neutral_node_state_repository?: WorldMapNeutralNodeStateRepository;
  readonly world_map_gather_march_state_repository?: WorldMapGatherMarchStateRepository;
  readonly world_map_neutral_node_spawn_input?: WorldMapNeutralNodeSpawnInput;
  readonly world_map_scout_select_service?: WorldMapScoutSelectService;
  readonly world_map_tile_state_repository?: WorldMapTileStateRepository;
  readonly resolve_tile_available?: (input: {
    readonly settlement_id: string;
    readonly tile_id: string;
  }) => boolean;
}

export class FirstSliceSettlementLoopLocalRpcTransport {
  constructor(
    private readonly routeResolvers: Partial<FirstSliceSettlementLoopRouteResolverByRoute>,
  ) {}

  getRegisteredRoutes(): readonly FirstSliceSettlementLoopRoute[] {
    return Object.keys(this.routeResolvers) as FirstSliceSettlementLoopRoute[];
  }

  invoke<TRoute extends FirstSliceSettlementLoopRoute>(
    route: TRoute,
    request: FirstSliceSettlementLoopRequestByRoute[TRoute],
  ): FirstSliceSettlementLoopTransportResponse<FirstSliceSettlementLoopResponseByRoute[TRoute]> {
    const resolver = this.routeResolvers[
      route
    ] as FirstSliceSettlementLoopRouteResolverByRoute[TRoute] | undefined;
    if (resolver === undefined) {
      return {
        status_code: 404,
        body: {
          code: "route_not_found",
          message: `No transport route is wired for '${route}'.`,
        },
      };
    }

    try {
      return {
        status_code: 200,
        body: resolver(request),
      };
    } catch (error: unknown) {
      return mapTransportFailure(error);
    }
  }
}

export const createFirstSliceSettlementLoopLocalRpcTransport = (
  handlers: FirstSliceSettlementLoopTransportHandlers,
): FirstSliceSettlementLoopLocalRpcTransport =>
  new FirstSliceSettlementLoopLocalRpcTransport({
    [POST_SETTLEMENT_TICK_ROUTE]: (request) => handlers.tick.handlePostTick(request),
    [POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE]: (request) =>
      handlers.building_upgrade.handlePostUpgrade(request),
    [POST_SETTLEMENT_UNIT_TRAIN_ROUTE]: (request) => handlers.unit_train.handlePostTrain(request),
    [POST_WORLD_MAP_LIFECYCLE_ADVANCE_ROUTE]: (request) =>
      handlers.world_map_lifecycle_advance.handlePostLifecycleAdvance(request),
    [POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE]: (request) =>
      handlers.world_map_march_snapshot.handlePostSnapshot(request),
    [POST_WORLD_MAP_TILE_INTERACT_ROUTE]: (request) =>
      handlers.world_map_tile_interact.handlePostTileInteractContract(request),
    [POST_WORLD_MAP_GATHER_MARCH_START_ROUTE]: (request) =>
      handlers.world_map_gather_march_start.handlePostGatherStartContract(request),
    [POST_WORLD_MAP_GATHER_MARCH_POLL_ROUTE]: (request) =>
      handlers.world_map_gather_march_poll.handlePostGatherPollContract(request),
  });

export const createDeterministicFirstSliceSettlementLoopLocalRpcTransport = (
  options?: DeterministicFirstSliceSettlementLoopLocalRpcTransportOptions,
): FirstSliceSettlementLoopLocalRpcTransport => {
  const projectionService =
    options?.projection_service ?? new DeterministicSettlementResourceProjectionService();
  const economyTickStateRepository =
    options?.economy_tick_state_repository
    ?? new InMemoryFirstSliceEconomyTickStateRepository();
  const settlementResourceLedgerService =
    options?.settlement_resource_ledger_service
    ?? new DeterministicSettlementResourceLedgerService(
      economyTickStateRepository,
      {
        projection_service: projectionService,
      },
    );
  const worldMapLifecycleStateRepository =
    options?.world_map_lifecycle_state_repository
    ?? new InMemoryWorldMapLifecycleStateRepository([
      {
        world_id: DEFAULT_WORLD_ID,
        world_revision: 0,
        lifecycle_state: "world_lifecycle_open",
        season_number: 1,
        season_length_days: 1,
        season_started_at: new Date(DEFAULT_WORLD_SEASON_STARTED_AT_ISO),
        state_changed_at: new Date(DEFAULT_WORLD_SEASON_STARTED_AT_ISO),
        joinable_world_state: {
          joinable_player_ids: [],
          active_settlement_ids: [],
          active_march_ids: [],
        },
      },
    ]);
  const worldMapLifecycleSchedulerService =
    options?.world_map_lifecycle_scheduler_service
    ?? new DeterministicWorldMapLifecycleSchedulerService(
      worldMapLifecycleStateRepository,
    );
  const worldMapMarchStateRepository =
    options?.world_map_march_state_repository ?? new InMemoryWorldMapMarchStateRepository();
  const worldMapMarchSnapshotService =
    options?.world_map_march_snapshot_service
    ?? new DeterministicWorldMapMarchSnapshotService(worldMapMarchStateRepository);
  const worldMapTileStateRepository =
    options?.world_map_tile_state_repository ?? new InMemoryWorldMapTileStateRepository();
  const worldMapScoutSelectService =
    options?.world_map_scout_select_service
    ?? new DeterministicWorldMapScoutSelectService(worldMapTileStateRepository);
  const worldMapNeutralNodeStateRepository =
    options?.world_map_neutral_node_state_repository
    ?? new InMemoryWorldMapNeutralNodeStateRepository();
  const worldMapGatherMarchStateRepository =
    options?.world_map_gather_march_state_repository
    ?? new InMemoryWorldMapGatherMarchStateRepository();
  const worldMapNeutralGatheringService =
    options?.world_map_neutral_gathering_service
    ?? new DeterministicWorldMapNeutralGatheringService(
      worldMapNeutralNodeStateRepository,
      worldMapGatherMarchStateRepository,
      {
        settlement_resource_ledger_service: settlementResourceLedgerService,
      },
    );
  if (
    options?.world_map_neutral_gathering_service === undefined
    || options?.world_map_neutral_node_spawn_input !== undefined
  ) {
    worldMapNeutralGatheringService.spawnNeutralNodes(
      options?.world_map_neutral_node_spawn_input ?? DEFAULT_WORLD_MAP_NEUTRAL_NODE_SPAWN_INPUT,
    );
  }

  return createFirstSliceSettlementLoopLocalRpcTransport({
    tick: new SettlementTickEndpointHandler(projectionService),
    building_upgrade: new SettlementBuildingUpgradeEndpointHandler(
      options?.building_upgrade_command_handler
      ?? new DeterministicFirstSliceBuildingUpgradeCommandHandler(),
    ),
    unit_train: new SettlementUnitTrainEndpointHandler(
      options?.unit_train_command_handler ?? new DeterministicFirstSliceUnitTrainCommandHandler(),
    ),
    world_map_lifecycle_advance: new WorldMapLifecycleAdvanceEndpointHandler(
      worldMapLifecycleSchedulerService,
    ),
    world_map_march_snapshot: new WorldMapMarchSnapshotEndpointHandler(
      worldMapMarchSnapshotService,
    ),
    world_map_tile_interact: new WorldMapTileInteractEndpointHandler(
      worldMapScoutSelectService,
      {
        resolve_tile_available: options?.resolve_tile_available,
      },
    ),
    world_map_gather_march_start: new WorldMapGatherMarchStartEndpointHandler(
      worldMapNeutralGatheringService,
    ),
    world_map_gather_march_poll: new WorldMapGatherMarchPollEndpointHandler(
      worldMapNeutralGatheringService,
    ),
  });
};

const DEFAULT_WORLD_ID = "world_alpha";
const DEFAULT_WORLD_SEED = "seed_world_alpha";
const DEFAULT_WORLD_SEASON_STARTED_AT_ISO = "2026-02-26T00:00:00.000Z";
const DEFAULT_WORLD_MAP_NEUTRAL_NODE_SPAWN_INPUT: WorldMapNeutralNodeSpawnInput = {
  world_id: DEFAULT_WORLD_ID,
  world_seed: DEFAULT_WORLD_SEED,
  map_size: 16,
  spawn_table: [
    {
      node_type: "neutral_node_forage",
      node_label: "Forager's Grove",
      spawn_count: 1,
      yield_ranges: [
        {
          resource_id: "food",
          min_amount: 120,
          max_amount: 120,
        },
      ],
      gather_duration_seconds: 30,
      ambush_risk_pct: 35,
      ambush_base_strength: 20,
      depletion_cycles: 2,
    },
    {
      node_type: "neutral_node_lumber",
      node_label: "Abandoned Lumber Camp",
      spawn_count: 1,
      yield_ranges: [
        {
          resource_id: "wood",
          min_amount: 90,
          max_amount: 110,
        },
      ],
      gather_duration_seconds: 45,
      ambush_risk_pct: 20,
      ambush_base_strength: 25,
      depletion_cycles: 2,
    },
  ],
};

const DEFAULT_INTERNAL_ERROR_STATUS_CODE = 500;

function mapTransportFailure(
  error: unknown,
): FirstSliceSettlementLoopTransportFailure {
  if (error instanceof Error) {
    const typedError = error as Error & {
      readonly status_code?: unknown;
      readonly code?: unknown;
    };
    const statusCode =
      typeof typedError.status_code === "number" && Number.isFinite(typedError.status_code)
        ? Math.trunc(typedError.status_code)
        : DEFAULT_INTERNAL_ERROR_STATUS_CODE;
    const code =
      typeof typedError.code === "string" && typedError.code.length > 0
        ? typedError.code
        : "transport_handler_error";

    return {
      status_code: statusCode,
      body: {
        code,
        message: typedError.message,
      },
    };
  }

  return {
    status_code: DEFAULT_INTERNAL_ERROR_STATUS_CODE,
    body: {
      code: "transport_handler_error",
      message: "Transport handler execution failed.",
    },
  };
}
