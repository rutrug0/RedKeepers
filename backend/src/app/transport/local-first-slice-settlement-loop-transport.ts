import {
  DeterministicFirstSliceBuildingUpgradeCommandHandler,
  type FirstSliceBuildingUpgradeCommandHandler,
  POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE,
  SettlementBuildingUpgradeEndpointHandler,
  type PostSettlementBuildingUpgradeRequestDto,
  type PostSettlementBuildingUpgradeResponseDto,
} from "../../modules/buildings";
import {
  DeterministicSettlementResourceProjectionService,
  POST_SETTLEMENT_TICK_ROUTE,
  SettlementTickEndpointHandler,
  type PostSettlementTickRequestDto,
  type PostSettlementTickResponseDto,
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
  DeterministicWorldMapMarchSnapshotService,
  InMemoryWorldMapMarchStateRepository,
  DeterministicWorldMapScoutSelectService,
  POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE,
  InMemoryWorldMapTileStateRepository,
  WorldMapMarchSnapshotEndpointHandler,
  type PostWorldMapMarchSnapshotRequestDto,
  type PostWorldMapMarchSnapshotResponseDto,
  POST_WORLD_MAP_TILE_INTERACT_ROUTE,
  WorldMapTileInteractEndpointHandler,
  type PostWorldMapTileInteractRequestDto,
  type PostWorldMapTileInteractContractResponseDto,
  type WorldMapMarchSnapshotService,
  type WorldMapMarchStateRepository,
  type WorldMapScoutSelectService,
  type WorldMapTileStateRepository,
} from "../../modules/world_map";

export type FirstSliceSettlementLoopRoute =
  | typeof POST_SETTLEMENT_TICK_ROUTE
  | typeof POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE
  | typeof POST_SETTLEMENT_UNIT_TRAIN_ROUTE
  | typeof POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE
  | typeof POST_WORLD_MAP_TILE_INTERACT_ROUTE;

export interface FirstSliceSettlementLoopRequestByRoute {
  readonly [POST_SETTLEMENT_TICK_ROUTE]: PostSettlementTickRequestDto;
  readonly [POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE]: PostSettlementBuildingUpgradeRequestDto;
  readonly [POST_SETTLEMENT_UNIT_TRAIN_ROUTE]: PostSettlementUnitTrainRequestDto;
  readonly [POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE]: PostWorldMapMarchSnapshotRequestDto;
  readonly [POST_WORLD_MAP_TILE_INTERACT_ROUTE]: PostWorldMapTileInteractRequestDto;
}

export interface FirstSliceSettlementLoopResponseByRoute {
  readonly [POST_SETTLEMENT_TICK_ROUTE]: PostSettlementTickResponseDto;
  readonly [POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE]: PostSettlementBuildingUpgradeResponseDto;
  readonly [POST_SETTLEMENT_UNIT_TRAIN_ROUTE]: PostSettlementUnitTrainResponseDto;
  readonly [POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE]: PostWorldMapMarchSnapshotResponseDto;
  readonly [POST_WORLD_MAP_TILE_INTERACT_ROUTE]: PostWorldMapTileInteractContractResponseDto;
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
  readonly [POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE]: (
    request: PostWorldMapMarchSnapshotRequestDto,
  ) => PostWorldMapMarchSnapshotResponseDto;
  readonly [POST_WORLD_MAP_TILE_INTERACT_ROUTE]: (
    request: PostWorldMapTileInteractRequestDto,
  ) => PostWorldMapTileInteractContractResponseDto;
}

export interface FirstSliceSettlementLoopTransportHandlers {
  readonly tick: SettlementTickEndpointHandler;
  readonly building_upgrade: SettlementBuildingUpgradeEndpointHandler;
  readonly unit_train: SettlementUnitTrainEndpointHandler;
  readonly world_map_march_snapshot: WorldMapMarchSnapshotEndpointHandler;
  readonly world_map_tile_interact: WorldMapTileInteractEndpointHandler;
}

export interface DeterministicFirstSliceSettlementLoopLocalRpcTransportOptions {
  readonly projection_service?: SettlementResourceProjectionService;
  readonly building_upgrade_command_handler?: FirstSliceBuildingUpgradeCommandHandler;
  readonly unit_train_command_handler?: FirstSliceUnitTrainCommandHandler;
  readonly world_map_march_snapshot_service?: WorldMapMarchSnapshotService;
  readonly world_map_march_state_repository?: WorldMapMarchStateRepository;
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
    [POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE]: (request) =>
      handlers.world_map_march_snapshot.handlePostSnapshot(request),
    [POST_WORLD_MAP_TILE_INTERACT_ROUTE]: (request) =>
      handlers.world_map_tile_interact.handlePostTileInteractContract(request),
  });

export const createDeterministicFirstSliceSettlementLoopLocalRpcTransport = (
  options?: DeterministicFirstSliceSettlementLoopLocalRpcTransportOptions,
): FirstSliceSettlementLoopLocalRpcTransport => {
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

  return createFirstSliceSettlementLoopLocalRpcTransport({
    tick: new SettlementTickEndpointHandler(
      options?.projection_service ?? new DeterministicSettlementResourceProjectionService(),
    ),
    building_upgrade: new SettlementBuildingUpgradeEndpointHandler(
      options?.building_upgrade_command_handler
      ?? new DeterministicFirstSliceBuildingUpgradeCommandHandler(),
    ),
    unit_train: new SettlementUnitTrainEndpointHandler(
      options?.unit_train_command_handler ?? new DeterministicFirstSliceUnitTrainCommandHandler(),
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
  });
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
