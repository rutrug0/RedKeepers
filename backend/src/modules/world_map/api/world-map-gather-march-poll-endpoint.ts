import {
  type WorldMapNeutralGatheringService,
  WorldMapGatherMarchNotFoundError,
  WorldMapNeutralNodeNotFoundError,
} from "../application";
import {
  WORLD_MAP_NEUTRAL_GATHERING_FLOW,
  type WorldMapNeutralGatheringResolutionResponseDto,
} from "../domain";

export const POST_WORLD_MAP_GATHER_MARCH_POLL_ROUTE =
  "/world-map/gather-marches/{marchId}/poll" as const;

export interface PostWorldMapGatherMarchPollPathParamsDto {
  readonly marchId: string;
}

export interface PostWorldMapGatherMarchPollRequestBodyDto {
  readonly march_id: string;
  readonly flow_version: string;
  readonly observed_at?: string;
}

export interface PostWorldMapGatherMarchPollRequestDto {
  readonly path: PostWorldMapGatherMarchPollPathParamsDto;
  readonly body: PostWorldMapGatherMarchPollRequestBodyDto;
}

export type PostWorldMapGatherMarchPollResponseDto =
  WorldMapNeutralGatheringResolutionResponseDto;

export interface PostWorldMapGatherMarchPollAcceptedContractResponseDto
  extends WorldMapNeutralGatheringResolutionResponseDto
{
  readonly status: "accepted";
}

export type WorldMapGatherMarchPollOperationErrorCode =
  | "gather_march_not_found"
  | "neutral_node_not_found";

export interface PostWorldMapGatherMarchPollFailedContractResponseDto {
  readonly status: "failed";
  readonly flow: typeof WORLD_MAP_NEUTRAL_GATHERING_FLOW;
  readonly march_id: string;
  readonly error_code: WorldMapGatherMarchPollOperationErrorCode;
  readonly message: string;
}

export type PostWorldMapGatherMarchPollContractResponseDto =
  | PostWorldMapGatherMarchPollAcceptedContractResponseDto
  | PostWorldMapGatherMarchPollFailedContractResponseDto;

type WorldMapGatherMarchPollValidationErrorCode =
  | "missing_march_id"
  | "march_id_mismatch"
  | "flow_version_not_supported"
  | "invalid_observed_at";

export class WorldMapGatherMarchPollValidationError extends Error {
  readonly status_code = 400;

  constructor(
    readonly code: WorldMapGatherMarchPollValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorldMapGatherMarchPollValidationError";
  }
}

export class WorldMapGatherMarchPollEndpointHandler {
  constructor(
    private readonly neutralGatheringService: WorldMapNeutralGatheringService,
  ) {}

  handlePostGatherPoll(
    request: PostWorldMapGatherMarchPollRequestDto,
  ): PostWorldMapGatherMarchPollResponseDto {
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
      throw new WorldMapGatherMarchPollValidationError(
        "march_id_mismatch",
        "Path `marchId` must match request body `march_id`.",
      );
    }

    if (request.body.flow_version !== "v1") {
      throw new WorldMapGatherMarchPollValidationError(
        "flow_version_not_supported",
        "Only `flow_version: v1` is supported for M2.",
      );
    }

    return this.neutralGatheringService.advanceGatherMarch({
      march_id: bodyMarchId,
      observed_at: parseOptionalInstant(request.body.observed_at),
    });
  }

  handlePostGatherPollContract(
    request: PostWorldMapGatherMarchPollRequestDto,
  ): PostWorldMapGatherMarchPollContractResponseDto {
    try {
      return {
        status: "accepted",
        ...this.handlePostGatherPoll(request),
      };
    } catch (error: unknown) {
      if (
        error instanceof WorldMapGatherMarchNotFoundError
        || error instanceof WorldMapNeutralNodeNotFoundError
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
  code: WorldMapGatherMarchPollValidationErrorCode,
  message: string,
): string {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new WorldMapGatherMarchPollValidationError(code, message);
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
    throw new WorldMapGatherMarchPollValidationError(
      "invalid_observed_at",
      "Request body `observed_at` must be a valid ISO timestamp when provided.",
    );
  }
  return parsed;
}

function resolveMarchIdForFailureResponse(
  request: PostWorldMapGatherMarchPollRequestDto,
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
