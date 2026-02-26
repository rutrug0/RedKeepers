import {
  type WorldMapHostileAttackOperationErrorCode,
  type WorldMapHostileAttackService,
  WorldMapHostileAttackOperationError,
} from "../application";
import {
  WORLD_MAP_HOSTILE_ATTACK_FLOW,
  type WorldMapHostileAttackResolvedResponseDto,
} from "../domain";

export const POST_WORLD_MAP_SETTLEMENT_ATTACK_ROUTE =
  "/world-map/settlements/{targetSettlementId}/attack" as const;

export interface PostWorldMapSettlementAttackPathParamsDto {
  readonly targetSettlementId: string;
}

export interface PostWorldMapSettlementAttackDispatchedUnitDto {
  readonly unit_id: string;
  readonly unit_count: number;
  readonly unit_attack: number;
}

export interface PostWorldMapSettlementAttackRequestBodyDto {
  readonly flow_version: string;
  readonly march_id: string;
  readonly source_settlement_id: string;
  readonly source_settlement_name?: string;
  readonly target_settlement_id: string;
  readonly target_settlement_name?: string;
  readonly target_tile_label?: string;
  readonly origin: {
    readonly x: number;
    readonly y: number;
  };
  readonly target: {
    readonly x: number;
    readonly y: number;
  };
  readonly defender_garrison_strength: number;
  readonly dispatched_units: readonly PostWorldMapSettlementAttackDispatchedUnitDto[];
  readonly departed_at?: string;
  readonly seconds_per_tile?: number;
  readonly army_name?: string;
}

export interface PostWorldMapSettlementAttackRequestDto {
  readonly path: PostWorldMapSettlementAttackPathParamsDto;
  readonly body: PostWorldMapSettlementAttackRequestBodyDto;
}

export type PostWorldMapSettlementAttackResponseDto = WorldMapHostileAttackResolvedResponseDto;

export interface PostWorldMapSettlementAttackAcceptedContractResponseDto
  extends WorldMapHostileAttackResolvedResponseDto
{
  readonly status: "accepted";
}

export interface PostWorldMapSettlementAttackFailedContractResponseDto {
  readonly status: "failed";
  readonly flow: typeof WORLD_MAP_HOSTILE_ATTACK_FLOW;
  readonly march_id: string;
  readonly error_code: WorldMapHostileAttackOperationErrorCode;
  readonly message: string;
}

export type PostWorldMapSettlementAttackContractResponseDto =
  | PostWorldMapSettlementAttackAcceptedContractResponseDto
  | PostWorldMapSettlementAttackFailedContractResponseDto;

type WorldMapSettlementAttackValidationErrorCode =
  | "missing_target_settlement_id"
  | "target_settlement_id_mismatch"
  | "missing_march_id"
  | "missing_source_settlement_id"
  | "flow_version_not_supported"
  | "missing_origin"
  | "missing_target"
  | "missing_dispatched_units"
  | "invalid_dispatched_units"
  | "invalid_defender_garrison_strength"
  | "invalid_departed_at"
  | "invalid_seconds_per_tile";

export class WorldMapSettlementAttackValidationError extends Error {
  readonly status_code = 400;

  constructor(
    readonly code: WorldMapSettlementAttackValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorldMapSettlementAttackValidationError";
  }
}

export class WorldMapSettlementAttackEndpointHandler {
  constructor(
    private readonly hostileAttackService: WorldMapHostileAttackService,
  ) {}

  handlePostSettlementAttack(
    request: PostWorldMapSettlementAttackRequestDto,
  ): PostWorldMapSettlementAttackResponseDto {
    const pathTargetSettlementId = normalizeRequiredId(
      request.path.targetSettlementId,
      "missing_target_settlement_id",
      "Path `targetSettlementId` is required.",
    );
    const bodyTargetSettlementId = normalizeRequiredId(
      request.body.target_settlement_id,
      "missing_target_settlement_id",
      "Request body `target_settlement_id` is required.",
    );
    if (pathTargetSettlementId !== bodyTargetSettlementId) {
      throw new WorldMapSettlementAttackValidationError(
        "target_settlement_id_mismatch",
        "Path `targetSettlementId` must match request body `target_settlement_id`.",
      );
    }

    if (request.body.flow_version !== "v1") {
      throw new WorldMapSettlementAttackValidationError(
        "flow_version_not_supported",
        "Only `flow_version: v1` is supported for M0.",
      );
    }

    const dispatchedUnits = parseDispatchedUnits(request.body.dispatched_units);
    const origin = parseCoordinate(request.body.origin, "missing_origin", "Request body `origin` is required.");
    const target = parseCoordinate(request.body.target, "missing_target", "Request body `target` is required.");

    return this.hostileAttackService.resolveHostileAttack({
      march_id: normalizeRequiredId(
        request.body.march_id,
        "missing_march_id",
        "Request body `march_id` is required.",
      ),
      source_settlement_id: normalizeRequiredId(
        request.body.source_settlement_id,
        "missing_source_settlement_id",
        "Request body `source_settlement_id` is required.",
      ),
      source_settlement_name: normalizeOptionalId(request.body.source_settlement_name),
      target_settlement_id: bodyTargetSettlementId,
      target_settlement_name: normalizeOptionalId(request.body.target_settlement_name),
      target_tile_label: normalizeOptionalId(request.body.target_tile_label),
      origin,
      target,
      defender_garrison_strength: parseRequiredNonNegativeInteger(
        request.body.defender_garrison_strength,
      ),
      dispatched_units: dispatchedUnits,
      departed_at: parseOptionalInstant(request.body.departed_at),
      seconds_per_tile: parseOptionalPositiveInteger(request.body.seconds_per_tile),
      army_name: normalizeOptionalId(request.body.army_name),
    });
  }

  handlePostSettlementAttackContract(
    request: PostWorldMapSettlementAttackRequestDto,
  ): PostWorldMapSettlementAttackContractResponseDto {
    try {
      return {
        status: "accepted",
        ...this.handlePostSettlementAttack(request),
      };
    } catch (error: unknown) {
      if (error instanceof WorldMapHostileAttackOperationError) {
        return {
          status: "failed",
          flow: WORLD_MAP_HOSTILE_ATTACK_FLOW,
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
  code: WorldMapSettlementAttackValidationErrorCode,
  message: string,
): string {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new WorldMapSettlementAttackValidationError(code, message);
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
    throw new WorldMapSettlementAttackValidationError(
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
    throw new WorldMapSettlementAttackValidationError(
      "invalid_seconds_per_tile",
      "Request body `seconds_per_tile` must be a positive integer when provided.",
    );
  }
  return Math.trunc(value);
}

function parseRequiredNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new WorldMapSettlementAttackValidationError(
      "invalid_defender_garrison_strength",
      "Request body `defender_garrison_strength` must be a non-negative integer.",
    );
  }
  return Math.trunc(value);
}

function parseCoordinate(
  value: { readonly x: number; readonly y: number } | undefined,
  code: Extract<WorldMapSettlementAttackValidationErrorCode, "missing_origin" | "missing_target">,
  message: string,
): { readonly x: number; readonly y: number } {
  if (value === undefined) {
    throw new WorldMapSettlementAttackValidationError(code, message);
  }
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new WorldMapSettlementAttackValidationError(
      code,
      `${message} Coordinates must be finite numbers.`,
    );
  }
  return {
    x: value.x,
    y: value.y,
  };
}

function parseDispatchedUnits(
  value: readonly PostWorldMapSettlementAttackDispatchedUnitDto[] | undefined,
): readonly PostWorldMapSettlementAttackDispatchedUnitDto[] {
  if (!Array.isArray(value) || value.length < 1) {
    throw new WorldMapSettlementAttackValidationError(
      "missing_dispatched_units",
      "Request body `dispatched_units` must contain at least one dispatched unit.",
    );
  }

  return value.map((unit, index) => {
    const unitId = normalizeOptionalId(unit.unit_id);
    if (unitId === undefined) {
      throw new WorldMapSettlementAttackValidationError(
        "invalid_dispatched_units",
        `Request body \`dispatched_units[${index}].unit_id\` is required.`,
      );
    }
    if (!Number.isFinite(unit.unit_count) || unit.unit_count < 0) {
      throw new WorldMapSettlementAttackValidationError(
        "invalid_dispatched_units",
        `Request body \`dispatched_units[${index}].unit_count\` must be a non-negative integer.`,
      );
    }
    if (!Number.isFinite(unit.unit_attack) || unit.unit_attack < 0) {
      throw new WorldMapSettlementAttackValidationError(
        "invalid_dispatched_units",
        `Request body \`dispatched_units[${index}].unit_attack\` must be a non-negative integer.`,
      );
    }
    return {
      unit_id: unitId,
      unit_count: Math.trunc(unit.unit_count),
      unit_attack: Math.trunc(unit.unit_attack),
    };
  });
}

function resolveMarchIdForFailureResponse(
  request: PostWorldMapSettlementAttackRequestDto,
): string {
  const marchId = normalizeOptionalId(request.body.march_id);
  if (marchId !== undefined) {
    return marchId;
  }
  return "march_unknown";
}
