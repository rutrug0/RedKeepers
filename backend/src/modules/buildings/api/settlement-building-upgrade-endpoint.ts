import type {
  FirstSliceBuildingUpgradeCommandHandler,
  FirstSliceBuildingUpgradeCommandResult,
  FirstSliceBuildingUpgradeFailureCode,
} from "../application";

export const POST_SETTLEMENT_BUILDING_UPGRADE_ROUTE =
  "/settlements/{settlementId}/buildings/{buildingId}/upgrade" as const;
export const SETTLEMENT_BUILDING_UPGRADE_FLOW =
  "settlement.building_upgrade_v1" as const;

export interface PostSettlementBuildingUpgradePathParamsDto {
  readonly settlementId: string;
  readonly buildingId: string;
}

export interface PostSettlementBuildingUpgradeRequestBodyDto {
  readonly settlement_id: string;
  readonly building_id: string;
  readonly flow_version: string;
  readonly current_level: number;
  readonly requested_at: string;
  readonly settlement_name?: string;
  readonly resource_stock_by_id?: Readonly<Record<string, number | undefined>>;
  readonly cooldown_ends_at?: string;
  readonly active_upgrade_ends_at?: string;
  readonly correlation_id?: string;
}

export interface PostSettlementBuildingUpgradeRequestDto {
  readonly path: PostSettlementBuildingUpgradePathParamsDto;
  readonly body: PostSettlementBuildingUpgradeRequestBodyDto;
}

export interface PostSettlementBuildingUpgradeAcceptedResponseDto {
  readonly flow: typeof SETTLEMENT_BUILDING_UPGRADE_FLOW;
  readonly error_code?: undefined;
  readonly status: "accepted";
}

export interface PostSettlementBuildingUpgradeFailedResponseDto {
  readonly flow: typeof SETTLEMENT_BUILDING_UPGRADE_FLOW;
  readonly status: "failed";
  readonly error_code: SettlementLoopErrorCode;
}

export type SettlementLoopErrorCode =
  | "insufficient_resources"
  | "cooldown"
  | "unavailable_tile"
  | "invalid_state";

export type PostSettlementBuildingUpgradeResponseDto =
  | (FirstSliceBuildingUpgradeCommandResult &
      PostSettlementBuildingUpgradeAcceptedResponseDto)
  | (FirstSliceBuildingUpgradeCommandResult &
      PostSettlementBuildingUpgradeFailedResponseDto);

type SettlementBuildingUpgradeValidationErrorCode =
  | "missing_settlement_id"
  | "missing_building_id"
  | "settlement_id_mismatch"
  | "building_id_mismatch"
  | "flow_version_not_supported"
  | "missing_requested_at"
  | "invalid_requested_at"
  | "invalid_current_level";

export class SettlementBuildingUpgradeValidationError extends Error {
  readonly status_code = 400;

  constructor(
    readonly code: SettlementBuildingUpgradeValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SettlementBuildingUpgradeValidationError";
  }
}

export class SettlementBuildingUpgradeEndpointHandler {
  constructor(
    private readonly commandHandler: FirstSliceBuildingUpgradeCommandHandler,
  ) {}

  handlePostUpgrade(
    request: PostSettlementBuildingUpgradeRequestDto,
  ): PostSettlementBuildingUpgradeResponseDto {
    const pathSettlementId = normalizeRequiredId(
      request.path.settlementId,
      "missing_settlement_id",
      "Path `settlementId` is required.",
    );
    const bodySettlementId = normalizeRequiredId(
      request.body.settlement_id,
      "missing_settlement_id",
      "Request body `settlement_id` is required.",
    );
    if (pathSettlementId !== bodySettlementId) {
      throw new SettlementBuildingUpgradeValidationError(
        "settlement_id_mismatch",
        "Path `settlementId` must match request body `settlement_id`.",
      );
    }

    const pathBuildingId = normalizeRequiredId(
      request.path.buildingId,
      "missing_building_id",
      "Path `buildingId` is required.",
    );
    const bodyBuildingId = normalizeRequiredId(
      request.body.building_id,
      "missing_building_id",
      "Request body `building_id` is required.",
    );
    if (pathBuildingId !== bodyBuildingId) {
      throw new SettlementBuildingUpgradeValidationError(
        "building_id_mismatch",
        "Path `buildingId` must match request body `building_id`.",
      );
    }

    if (request.body.flow_version !== "v1") {
      throw new SettlementBuildingUpgradeValidationError(
        "flow_version_not_supported",
        "Only `flow_version: v1` is supported for M0.",
      );
    }

    if (!Number.isFinite(request.body.current_level)) {
      throw new SettlementBuildingUpgradeValidationError(
        "invalid_current_level",
        "Request body `current_level` must be finite.",
      );
    }

    const requestedAt = parseRequiredInstant(
      request.body.requested_at,
      "missing_requested_at",
      "invalid_requested_at",
      "Request body `requested_at` must be a valid ISO timestamp.",
    );
    const commandResult = this.commandHandler.handleUpgradeCommand({
      settlement_id: bodySettlementId,
      settlement_name: normalizeOptionalString(request.body.settlement_name),
      building_id: bodyBuildingId,
      current_level: request.body.current_level,
      requested_at: requestedAt,
      resource_stock: request.body.resource_stock_by_id,
      cooldown_ends_at: parseOptionalInstant(request.body.cooldown_ends_at),
      active_upgrade_ends_at: parseOptionalInstant(request.body.active_upgrade_ends_at),
      correlation_id: normalizeOptionalString(request.body.correlation_id),
    });

    if (commandResult.status === "accepted") {
      return {
        flow: SETTLEMENT_BUILDING_UPGRADE_FLOW,
        ...commandResult,
      };
    }

    return {
      flow: SETTLEMENT_BUILDING_UPGRADE_FLOW,
      error_code: mapBuildingFailureCodeToErrorCode(commandResult.failure_code),
      ...commandResult,
    };
  }
}

function mapBuildingFailureCodeToErrorCode(
  value: FirstSliceBuildingUpgradeFailureCode,
): SettlementLoopErrorCode {
  if (value === "insufficient_resources") {
    return "insufficient_resources";
  }
  if (value === "cooldown") {
    return "cooldown";
  }
  return "invalid_state";
}

function normalizeRequiredId(
  value: string,
  code: SettlementBuildingUpgradeValidationErrorCode,
  message: string,
): string {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new SettlementBuildingUpgradeValidationError(code, message);
  }
  return normalized;
}

function parseRequiredInstant(
  value: string,
  missingCode: SettlementBuildingUpgradeValidationErrorCode,
  invalidCode: SettlementBuildingUpgradeValidationErrorCode,
  invalidMessage: string,
): Date {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new SettlementBuildingUpgradeValidationError(
      missingCode,
      "Request body `requested_at` is required.",
    );
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new SettlementBuildingUpgradeValidationError(invalidCode, invalidMessage);
  }
  return parsed;
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
    return undefined;
  }
  return parsed;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
