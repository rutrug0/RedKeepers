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

type WorldMapTileInteractValidationErrorCode =
  | "missing_settlement_id"
  | "missing_tile_id"
  | "tile_id_mismatch"
  | "interaction_type_not_supported"
  | "flow_version_not_supported";

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

export class WorldMapTileInteractEndpointHandler {
  constructor(private readonly scoutSelectService: WorldMapScoutSelectService) {}

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

    return this.scoutSelectService.handleScoutSelect({
      settlement_id: settlementId,
      settlement_name: request.body.settlement_name,
      tile_id: bodyTileId,
      player_id: playerId,
      assignment_context_type: assignmentContextType,
      assignment_context_id: assignmentContextId,
    });
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
