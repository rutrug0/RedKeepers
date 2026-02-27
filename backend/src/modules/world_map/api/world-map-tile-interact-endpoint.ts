import type { WorldMapScoutSelectService } from "../application";
import type { WorldMapScoutSelectResponseDto } from "../domain";
import type { HeroAssignmentBoundContextType } from "../../heroes/ports";

export const POST_WORLD_MAP_TILE_INTERACT_ROUTE =
  "/world-map/tiles/{tileId}/interact" as const;

export interface PostWorldMapTileInteractPathParamsDto {
  readonly tileId: string;
}

export interface PostWorldMapTileInteractRequestBodyDto {
  readonly settlement_id: string;
  readonly tile_id: string;
  readonly interaction_type: string;
  readonly flow_version: string;
  readonly settlement_name?: string;
  readonly player_id?: string;
  readonly assignment_context_type?: HeroAssignmentBoundContextType;
  readonly assignment_context_id?: string;
}

export interface PostWorldMapTileInteractSessionContextDto {
  readonly player_id?: string;
  readonly assignment_context_type?: HeroAssignmentBoundContextType;
  readonly assignment_context_id?: string;
}

export interface PostWorldMapTileInteractRequestDto {
  readonly path: PostWorldMapTileInteractPathParamsDto;
  readonly body: PostWorldMapTileInteractRequestBodyDto;
  readonly session?: PostWorldMapTileInteractSessionContextDto;
}

export type PostWorldMapTileInteractResponseDto = WorldMapScoutSelectResponseDto;

export interface PostWorldMapTileInteractAcceptedContractResponseDto
  extends WorldMapScoutSelectResponseDto
{
  readonly status: "accepted";
}

export interface PostWorldMapTileInteractUnavailableTileContractResponseDto {
  readonly status: "failed";
  readonly flow: "world_map.scout_select_v1";
  readonly error_code: "unavailable_tile";
  readonly tile_id: string;
  readonly tile_state: "tile_state_unknown";
  readonly tile_revision: 0;
  readonly event: {
    readonly content_key: "event.scout.unavailable_tile";
    readonly content_key_aliases: readonly ["event.world.scout_unavailable_tile"];
    readonly tokens: {
      readonly target_tile_label: string;
    };
  };
}

export type PostWorldMapTileInteractContractResponseDto =
  | PostWorldMapTileInteractAcceptedContractResponseDto
  | PostWorldMapTileInteractUnavailableTileContractResponseDto;

type WorldMapTileInteractValidationErrorCode =
  | "missing_settlement_id"
  | "missing_tile_id"
  | "tile_id_mismatch"
  | "interaction_type_not_supported"
  | "flow_version_not_supported";

export type WorldMapTileInteractOperationErrorCode = "unavailable_tile";

const SCOUT_UNAVAILABLE_TILE_CANONICAL_CONTENT_KEY =
  "event.scout.unavailable_tile" as const;
const SCOUT_UNAVAILABLE_TILE_COMPATIBILITY_ALIAS_KEYS = [
  "event.world.scout_unavailable_tile",
] as const;

export class WorldMapTileInteractValidationError extends Error {
  readonly status_code = 400;

  constructor(
    readonly code: WorldMapTileInteractValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorldMapTileInteractValidationError";
  }
}

export class WorldMapTileInteractOperationError extends Error {
  readonly status_code = 409;

  constructor(
    readonly code: WorldMapTileInteractOperationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorldMapTileInteractOperationError";
  }
}

export class WorldMapTileInteractEndpointHandler {
  private readonly resolveTileAvailable: (input: {
    readonly settlement_id: string;
    readonly tile_id: string;
  }) => boolean;

  constructor(
    private readonly scoutSelectService: WorldMapScoutSelectService,
    options?: {
      readonly resolve_tile_available?: (input: {
        readonly settlement_id: string;
        readonly tile_id: string;
      }) => boolean;
    },
  ) {
    this.resolveTileAvailable = options?.resolve_tile_available ?? (() => true);
  }

  handlePostTileInteract(
    request: PostWorldMapTileInteractRequestDto,
  ): PostWorldMapTileInteractResponseDto {
    const settlementId = normalizeRequiredId(
      request.body.settlement_id,
      "missing_settlement_id",
      "Request body `settlement_id` is required.",
    );
    const pathTileId = normalizeRequiredId(
      request.path.tileId,
      "missing_tile_id",
      "Path `tileId` is required.",
    );
    const bodyTileId = normalizeRequiredId(
      request.body.tile_id,
      "missing_tile_id",
      "Request body `tile_id` is required.",
    );

    if (pathTileId !== bodyTileId) {
      throw new WorldMapTileInteractValidationError(
        "tile_id_mismatch",
        "Path `tileId` must match request body `tile_id`.",
      );
    }

    if (request.body.interaction_type !== "scout") {
      throw new WorldMapTileInteractValidationError(
        "interaction_type_not_supported",
        "Only `interaction_type: scout` is supported for M0.",
      );
    }

    if (request.body.flow_version !== "v1") {
      throw new WorldMapTileInteractValidationError(
        "flow_version_not_supported",
        "Only `flow_version: v1` is supported for M0.",
      );
    }

    const playerId =
      normalizeOptionalId(request.body.player_id)
      ?? normalizeOptionalId(request.session?.player_id);
    const assignmentContextType =
      normalizeOptionalAssignmentContextType(
        request.body.assignment_context_type,
      )
      ?? normalizeOptionalAssignmentContextType(
        request.session?.assignment_context_type,
      );
    const assignmentContextId =
      normalizeOptionalId(request.body.assignment_context_id)
      ?? normalizeOptionalId(request.session?.assignment_context_id);

    if (
      !this.resolveTileAvailable({
        settlement_id: settlementId,
        tile_id: bodyTileId,
      })
    ) {
      throw new WorldMapTileInteractOperationError(
        "unavailable_tile",
        "Requested tile is currently unavailable for scout interaction.",
      );
    }

    return this.scoutSelectService.handleScoutSelect({
      settlement_id: settlementId,
      settlement_name: request.body.settlement_name,
      tile_id: bodyTileId,
      player_id: playerId,
      assignment_context_type: assignmentContextType,
      assignment_context_id: assignmentContextId,
    });
  }

  handlePostTileInteractContract(
    request: PostWorldMapTileInteractRequestDto,
  ): PostWorldMapTileInteractContractResponseDto {
    try {
      return {
        status: "accepted",
        ...this.handlePostTileInteract(request),
      };
    } catch (error: unknown) {
      if (
        error instanceof WorldMapTileInteractOperationError &&
        error.code === "unavailable_tile"
      ) {
        const tileId = resolveTileIdForUnavailableTileResponse(request);
        return {
          status: "failed",
          flow: "world_map.scout_select_v1",
          error_code: "unavailable_tile",
          tile_id: tileId,
          tile_state: "tile_state_unknown",
          tile_revision: 0,
          event: {
            content_key: SCOUT_UNAVAILABLE_TILE_CANONICAL_CONTENT_KEY,
            content_key_aliases: SCOUT_UNAVAILABLE_TILE_COMPATIBILITY_ALIAS_KEYS,
            tokens: {
              target_tile_label: `Frontier Tile ${tileId}`,
            },
          },
        };
      }

      throw error;
    }
  }
}

function normalizeRequiredId(
  value: string,
  code: WorldMapTileInteractValidationErrorCode,
  message: string,
): string {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new WorldMapTileInteractValidationError(code, message);
  }
  return normalized;
}

function normalizeOptionalId(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalAssignmentContextType(
  value: HeroAssignmentBoundContextType | undefined,
): HeroAssignmentBoundContextType | undefined {
  if (
    value === "army"
    || value === "scout_detachment"
    || value === "siege_column"
  ) {
    return value;
  }
  return undefined;
}

function resolveTileIdForUnavailableTileResponse(
  request: PostWorldMapTileInteractRequestDto,
): string {
  const bodyTileId = normalizeOptionalId(request.body.tile_id);
  if (bodyTileId !== undefined) {
    return bodyTileId;
  }

  const pathTileId = normalizeOptionalId(request.path.tileId);
  if (pathTileId !== undefined) {
    return pathTileId;
  }

  return "tile_unknown";
}
