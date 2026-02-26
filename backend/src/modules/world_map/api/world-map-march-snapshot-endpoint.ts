import type {
  WorldMapMarchSnapshotService,
} from "../application";
import type { WorldMapMarchSnapshotResponseDto } from "../domain";

export const POST_WORLD_MAP_MARCH_SNAPSHOT_ROUTE =
  "/world-map/marches/{marchId}/snapshot" as const;

export interface PostWorldMapMarchSnapshotPathParamsDto {
  readonly marchId: string;
}

export interface PostWorldMapMarchSnapshotRequestBodyDto {
  readonly march_id: string;
  readonly flow_version: string;
  readonly observed_at?: string;
}

export interface PostWorldMapMarchSnapshotRequestDto {
  readonly path: PostWorldMapMarchSnapshotPathParamsDto;
  readonly body: PostWorldMapMarchSnapshotRequestBodyDto;
}

export type PostWorldMapMarchSnapshotResponseDto = WorldMapMarchSnapshotResponseDto;

type WorldMapMarchSnapshotValidationErrorCode =
  | "missing_march_id"
  | "march_id_mismatch"
  | "flow_version_not_supported"
  | "invalid_observed_at";

export class WorldMapMarchSnapshotValidationError extends Error {
  readonly status_code = 400;

  constructor(
    readonly code: WorldMapMarchSnapshotValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorldMapMarchSnapshotValidationError";
  }
}

export class WorldMapMarchSnapshotEndpointHandler {
  constructor(
    private readonly marchSnapshotService: WorldMapMarchSnapshotService,
  ) {}

  handlePostSnapshot(
    request: PostWorldMapMarchSnapshotRequestDto,
  ): PostWorldMapMarchSnapshotResponseDto {
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
      throw new WorldMapMarchSnapshotValidationError(
        "march_id_mismatch",
        "Path `marchId` must match request body `march_id`.",
      );
    }

    if (request.body.flow_version !== "v1") {
      throw new WorldMapMarchSnapshotValidationError(
        "flow_version_not_supported",
        "Only `flow_version: v1` is supported for M1.",
      );
    }

    return this.marchSnapshotService.emitMarchSnapshot({
      march_id: bodyMarchId,
      observed_at: parseOptionalInstant(
        request.body.observed_at,
      ),
    });
  }
}

function normalizeRequiredId(
  value: string,
  code: WorldMapMarchSnapshotValidationErrorCode,
  message: string,
): string {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new WorldMapMarchSnapshotValidationError(code, message);
  }
  return normalized;
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
    throw new WorldMapMarchSnapshotValidationError(
      "invalid_observed_at",
      "Request body `observed_at` must be a valid ISO timestamp when provided.",
    );
  }
  return parsed;
}
