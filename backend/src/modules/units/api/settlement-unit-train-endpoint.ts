import type {
  FirstSliceUnitTrainCommandHandler,
  FirstSliceUnitTrainCommandResult,
  FirstSliceUnitTrainFailureCode,
} from "../application";

export const POST_SETTLEMENT_UNIT_TRAIN_ROUTE =
  "/settlements/{settlementId}/units/{unitId}/train" as const;
export const SETTLEMENT_UNIT_TRAIN_FLOW = "settlement.unit_train_v1" as const;

export interface PostSettlementUnitTrainPathParamsDto {
  readonly settlementId: string;
  readonly unitId: string;
}

export interface PostSettlementUnitTrainRequestBodyDto {
  readonly settlement_id: string;
  readonly unit_id: string;
  readonly flow_version: string;
  readonly quantity: number;
  readonly requested_at: string;
  readonly barracks_level: number;
  readonly settlement_name?: string;
  readonly resource_stock_by_id?: Readonly<Record<string, number | undefined>>;
  readonly queue_available_at?: string;
  readonly training_time_multiplier?: number;
  readonly correlation_id?: string;
}

export interface PostSettlementUnitTrainRequestDto {
  readonly path: PostSettlementUnitTrainPathParamsDto;
  readonly body: PostSettlementUnitTrainRequestBodyDto;
}

export interface PostSettlementUnitTrainAcceptedResponseDto {
  readonly flow: typeof SETTLEMENT_UNIT_TRAIN_FLOW;
  readonly error_code?: undefined;
  readonly status: "accepted";
}

export interface PostSettlementUnitTrainFailedResponseDto {
  readonly flow: typeof SETTLEMENT_UNIT_TRAIN_FLOW;
  readonly status: "failed";
  readonly error_code: SettlementLoopErrorCode;
}

export type SettlementLoopErrorCode =
  | "insufficient_resources"
  | "cooldown"
  | "unavailable_tile"
  | "invalid_state";

export type PostSettlementUnitTrainResponseDto =
  | (FirstSliceUnitTrainCommandResult & PostSettlementUnitTrainAcceptedResponseDto)
  | (FirstSliceUnitTrainCommandResult & PostSettlementUnitTrainFailedResponseDto);

type SettlementUnitTrainValidationErrorCode =
  | "missing_settlement_id"
  | "missing_unit_id"
  | "settlement_id_mismatch"
  | "unit_id_mismatch"
  | "flow_version_not_supported"
  | "missing_requested_at"
  | "invalid_requested_at"
  | "invalid_quantity"
  | "invalid_barracks_level";

export class SettlementUnitTrainValidationError extends Error {
  readonly status_code = 400;

  constructor(
    readonly code: SettlementUnitTrainValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SettlementUnitTrainValidationError";
  }
}

export class SettlementUnitTrainEndpointHandler {
  constructor(
    private readonly commandHandler: FirstSliceUnitTrainCommandHandler,
  ) {}

  handlePostTrain(
    request: PostSettlementUnitTrainRequestDto,
  ): PostSettlementUnitTrainResponseDto {
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
      throw new SettlementUnitTrainValidationError(
        "settlement_id_mismatch",
        "Path `settlementId` must match request body `settlement_id`.",
      );
    }

    const pathUnitId = normalizeRequiredId(
      request.path.unitId,
      "missing_unit_id",
      "Path `unitId` is required.",
    );
    const bodyUnitId = normalizeRequiredId(
      request.body.unit_id,
      "missing_unit_id",
      "Request body `unit_id` is required.",
    );
    if (pathUnitId !== bodyUnitId) {
      throw new SettlementUnitTrainValidationError(
        "unit_id_mismatch",
        "Path `unitId` must match request body `unit_id`.",
      );
    }

    if (request.body.flow_version !== "v1") {
      throw new SettlementUnitTrainValidationError(
        "flow_version_not_supported",
        "Only `flow_version: v1` is supported for M0.",
      );
    }

    if (!Number.isFinite(request.body.quantity)) {
      throw new SettlementUnitTrainValidationError(
        "invalid_quantity",
        "Request body `quantity` must be finite.",
      );
    }

    if (!Number.isFinite(request.body.barracks_level)) {
      throw new SettlementUnitTrainValidationError(
        "invalid_barracks_level",
        "Request body `barracks_level` must be finite.",
      );
    }

    const requestedAt = parseRequiredInstant(
      request.body.requested_at,
      "missing_requested_at",
      "invalid_requested_at",
      "Request body `requested_at` must be a valid ISO timestamp.",
    );

    const commandResult = this.commandHandler.handleTrainCommand({
      settlement_id: bodySettlementId,
      settlement_name: normalizeOptionalString(request.body.settlement_name),
      unit_id: bodyUnitId,
      quantity: request.body.quantity,
      requested_at: requestedAt,
      resource_stock: request.body.resource_stock_by_id,
      barracks_level: request.body.barracks_level,
      queue_available_at: parseOptionalInstant(request.body.queue_available_at),
      training_time_multiplier: request.body.training_time_multiplier,
      correlation_id: normalizeOptionalString(request.body.correlation_id),
    });

    if (commandResult.status === "accepted") {
      return {
        flow: SETTLEMENT_UNIT_TRAIN_FLOW,
        ...commandResult,
      };
    }

    return {
      flow: SETTLEMENT_UNIT_TRAIN_FLOW,
      error_code: mapUnitFailureCodeToErrorCode(commandResult.failure_code),
      ...commandResult,
    };
  }
}

function mapUnitFailureCodeToErrorCode(
  value: FirstSliceUnitTrainFailureCode,
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
  code: SettlementUnitTrainValidationErrorCode,
  message: string,
): string {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new SettlementUnitTrainValidationError(code, message);
  }
  return normalized;
}

function parseRequiredInstant(
  value: string,
  missingCode: SettlementUnitTrainValidationErrorCode,
  invalidCode: SettlementUnitTrainValidationErrorCode,
  invalidMessage: string,
): Date {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new SettlementUnitTrainValidationError(
      missingCode,
      "Request body `requested_at` is required.",
    );
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new SettlementUnitTrainValidationError(invalidCode, invalidMessage);
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
