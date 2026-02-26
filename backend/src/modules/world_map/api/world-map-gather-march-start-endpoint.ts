import {
  type WorldMapNeutralGatheringService,
  WorldMapGatherMarchConflictError,
  WorldMapNeutralNodeDepletedError,
  WorldMapNeutralNodeNotFoundError,
} from "../application";
import {
  WORLD_MAP_NEUTRAL_GATHERING_FLOW,
  type WorldMapNeutralGatheringResolutionResponseDto,
} from "../domain";

export const POST_WORLD_MAP_GATHER_MARCH_START_ROUTE =
  "/world-map/gather-marches/{marchId}/start" as const;

export interface PostWorldMapGatherMarchStartPathParamsDto {
  readonly marchId: string;
}

export interface PostWorldMapGatherMarchStartRequestBodyDto {
  readonly world_id: string;
  readonly world_seed: string;
  readonly march_id: string;
  readonly settlement_id: string;
  readonly node_id: string;
  readonly flow_version: string;
  readonly army_name?: string;
  readonly departed_at?: string;
  readonly travel_seconds_per_leg?: number;
  readonly escort_strength: number;
}

export interface PostWorldMapGatherMarchStartRequestDto {
  readonly path: PostWorldMapGatherMarchStartPathParamsDto;
  readonly body: PostWorldMapGatherMarchStartRequestBodyDto;
}

export type PostWorldMapGatherMarchStartResponseDto =
  WorldMapNeutralGatheringResolutionResponseDto;

export interface PostWorldMapGatherMarchStartAcceptedContractResponseDto
  extends WorldMapNeutralGatheringResolutionResponseDto
{
  readonly status: "accepted";
}

export type WorldMapGatherMarchStartOperationErrorCode =
  | "neutral_node_not_found"
  | "neutral_node_depleted"
  | "gather_march_already_exists";

export interface PostWorldMapGatherMarchStartFailedContractResponseDto {
  readonly status: "failed";
  readonly flow: typeof WORLD_MAP_NEUTRAL_GATHERING_FLOW;
  readonly march_id: string;
  readonly error_code: WorldMapGatherMarchStartOperationErrorCode;
  readonly message: string;
}

export type PostWorldMapGatherMarchStartContractResponseDto =
  | PostWorldMapGatherMarchStartAcceptedContractResponseDto
  | PostWorldMapGatherMarchStartFailedContractResponseDto;

type WorldMapGatherMarchStartValidationErrorCode =
  | "missing_world_id"
  | "missing_world_seed"
  | "missing_march_id"
  | "march_id_mismatch"
  | "missing_settlement_id"
  | "missing_node_id"
  | "flow_version_not_supported"
  | "invalid_departed_at"
  | "invalid_travel_seconds_per_leg"
  | "missing_escort_strength"
  | "invalid_escort_strength";

export class WorldMapGatherMarchStartValidationError extends Error {
  readonly status_code = 400;

  constructor(
    readonly code: WorldMapGatherMarchStartValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorldMapGatherMarchStartValidationError";
  }
}

export class WorldMapGatherMarchStartEndpointHandler {
  constructor(
    private readonly neutralGatheringService: WorldMapNeutralGatheringService,
  ) {}

  handlePostGatherStart(
    request: PostWorldMapGatherMarchStartRequestDto,
  ): PostWorldMapGatherMarchStartResponseDto {
    const pathMarchId = normalizeRequiredId(
      request.path.marchId,
      "missing_march_id",
      "Path `marchId` is required.",
    );
    const bodyMarchId = normalizeRequiredId(
      request.body.march_id,
      "missing_march_id",
      "Request body `march_id` is required.",
    );
    if (pathMarchId !== bodyMarchId) {
      throw new WorldMapGatherMarchStartValidationError(
        "march_id_mismatch",
        "Path `marchId` must match request body `march_id`.",
      );
    }

    if (request.body.flow_version !== "v1") {
      throw new WorldMapGatherMarchStartValidationError(
        "flow_version_not_supported",
        "Only `flow_version: v1` is supported for M2.",
      );
    }

    return this.neutralGatheringService.startGatherMarch({
      world_id: normalizeRequiredId(
        request.body.world_id,
        "missing_world_id",
        "Request body `world_id` is required.",
      ),
      world_seed: normalizeRequiredId(
        request.body.world_seed,
        "missing_world_seed",
        "Request body `world_seed` is required.",
      ),
      march_id: bodyMarchId,
      settlement_id: normalizeRequiredId(
        request.body.settlement_id,
        "missing_settlement_id",
        "Request body `settlement_id` is required.",
      ),
      army_name: normalizeOptionalId(request.body.army_name),
      node_id: normalizeRequiredId(
        request.body.node_id,
        "missing_node_id",
        "Request body `node_id` is required.",
      ),
      departed_at: parseOptionalInstant(request.body.departed_at),
      travel_seconds_per_leg: parseOptionalPositiveInteger(
        request.body.travel_seconds_per_leg,
      ),
      escort_strength: parseRequiredNonNegativeInteger(request.body.escort_strength),
    });
  }

  handlePostGatherStartContract(
    request: PostWorldMapGatherMarchStartRequestDto,
  ): PostWorldMapGatherMarchStartContractResponseDto {
    try {
      return {
        status: "accepted",
        ...this.handlePostGatherStart(request),
      };
    } catch (error: unknown) {
      if (
        error instanceof WorldMapNeutralNodeNotFoundError
        || error instanceof WorldMapNeutralNodeDepletedError
        || error instanceof WorldMapGatherMarchConflictError
      ) {
        return {
          status: "failed",
          flow: WORLD_MAP_NEUTRAL_GATHERING_FLOW,
          march_id: resolveMarchIdForFailureResponse(request),
          error_code: error.code,
          message: error.message,
        };
      }

      throw error;
    }
  }
}

function normalizeRequiredId(
  value: string,
  code: WorldMapGatherMarchStartValidationErrorCode,
  message: string,
): string {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new WorldMapGatherMarchStartValidationError(code, message);
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

function parseOptionalInstant(value: string | undefined): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length < 1) {
    return undefined;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new WorldMapGatherMarchStartValidationError(
      "invalid_departed_at",
      "Request body `departed_at` must be a valid ISO timestamp when provided.",
    );
  }
  return parsed;
}

function parseOptionalPositiveInteger(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new WorldMapGatherMarchStartValidationError(
      "invalid_travel_seconds_per_leg",
      "Request body `travel_seconds_per_leg` must be a positive integer when provided.",
    );
  }
  return Math.trunc(value);
}

function parseRequiredNonNegativeInteger(value: number): number {
  if (value === undefined) {
    throw new WorldMapGatherMarchStartValidationError(
      "missing_escort_strength",
      "Request body `escort_strength` is required.",
    );
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new WorldMapGatherMarchStartValidationError(
      "invalid_escort_strength",
      "Request body `escort_strength` must be a non-negative integer.",
    );
  }
  return Math.trunc(value);
}

function resolveMarchIdForFailureResponse(
  request: PostWorldMapGatherMarchStartRequestDto,
): string {
  const bodyMarchId = normalizeOptionalId(request.body.march_id);
  if (bodyMarchId !== undefined) {
    return bodyMarchId;
  }

  const pathMarchId = normalizeOptionalId(request.path.marchId);
  if (pathMarchId !== undefined) {
    return pathMarchId;
  }

  return "gather_march_unknown";
}
