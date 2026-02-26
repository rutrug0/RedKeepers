import type { WorldMapLifecycleSchedulerService } from "../application";
import type { WorldMapLifecycleAdvanceResponseDto } from "../domain";

export const POST_WORLD_MAP_LIFECYCLE_ADVANCE_ROUTE =
  "/world-map/worlds/{worldId}/lifecycle/advance" as const;

export interface PostWorldMapLifecycleAdvancePathParamsDto {
  readonly worldId: string;
}

export interface PostWorldMapLifecycleAdvanceRequestBodyDto {
  readonly world_id: string;
  readonly flow_version: string;
  readonly observed_at: string;
}

export interface PostWorldMapLifecycleAdvanceRequestDto {
  readonly path: PostWorldMapLifecycleAdvancePathParamsDto;
  readonly body: PostWorldMapLifecycleAdvanceRequestBodyDto;
}

export interface PostWorldMapLifecycleAdvanceAcceptedContractResponseDto
  extends WorldMapLifecycleAdvanceResponseDto
{
  readonly status: "accepted";
}

export type PostWorldMapLifecycleAdvanceContractResponseDto =
  PostWorldMapLifecycleAdvanceAcceptedContractResponseDto;

type WorldMapLifecycleAdvanceValidationErrorCode =
  | "missing_world_id"
  | "world_id_mismatch"
  | "flow_version_not_supported"
  | "missing_observed_at"
  | "invalid_observed_at";

export class WorldMapLifecycleAdvanceValidationError extends Error {
  readonly status_code = 400;

  constructor(
    readonly code: WorldMapLifecycleAdvanceValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorldMapLifecycleAdvanceValidationError";
  }
}

export class WorldMapLifecycleAdvanceEndpointHandler {
  constructor(
    private readonly lifecycleSchedulerService: WorldMapLifecycleSchedulerService,
  ) {}

  handlePostLifecycleAdvance(
    request: PostWorldMapLifecycleAdvanceRequestDto,
  ): PostWorldMapLifecycleAdvanceContractResponseDto {
    const pathWorldId = normalizeRequiredId(
      request.path.worldId,
      "missing_world_id",
      "Path `worldId` is required.",
    );
    const bodyWorldId = normalizeRequiredId(
      request.body.world_id,
      "missing_world_id",
      "Request body `world_id` is required.",
    );
    if (pathWorldId !== bodyWorldId) {
      throw new WorldMapLifecycleAdvanceValidationError(
        "world_id_mismatch",
        "Path `worldId` must match request body `world_id`.",
      );
    }

    if (request.body.flow_version !== "v1") {
      throw new WorldMapLifecycleAdvanceValidationError(
        "flow_version_not_supported",
        "Only `flow_version: v1` is supported for M1.",
      );
    }

    return {
      status: "accepted",
      ...this.lifecycleSchedulerService.advanceLifecycle({
        world_id: bodyWorldId,
        observed_at: parseRequiredInstant(request.body.observed_at),
      }),
    };
  }
}

function normalizeRequiredId(
  value: string,
  code: WorldMapLifecycleAdvanceValidationErrorCode,
  message: string,
): string {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new WorldMapLifecycleAdvanceValidationError(code, message);
  }
  return normalized;
}

function parseRequiredInstant(value: string): Date {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new WorldMapLifecycleAdvanceValidationError(
      "missing_observed_at",
      "Request body `observed_at` is required.",
    );
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new WorldMapLifecycleAdvanceValidationError(
      "invalid_observed_at",
      "Request body `observed_at` must be a valid ISO timestamp.",
    );
  }
  return parsed;
}
